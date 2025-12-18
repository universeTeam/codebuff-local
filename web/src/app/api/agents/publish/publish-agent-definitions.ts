import {
  determineNextVersion,
  stringifyVersion,
  versionExists,
} from '@codebuff/internal'
import db from '@codebuff/internal/db'
import * as schema from '@codebuff/internal/db/schema'
import { validateAgentsWithSpawnableAgents } from '@codebuff/internal/templates/agent-validation'
import { and, desc, eq, or } from 'drizzle-orm'

import {
  resolveAndValidateSubagents,
  SubagentResolutionError,
  type AgentVersionEntry,
} from './subagent-resolution'

import type { Logger } from '@codebuff/common/types/contracts/logger'
import type { Version } from '@codebuff/internal'

type PublishAgentDefinitionsBody = {
  success: true
  publisherId: string
  agents: Array<{
    id: string
    version: string
    displayName: string
  }>
}

type PublishAgentDefinitionsErrorBody = {
  error: string
  details?: string
  hint?: string
  validationErrors?: unknown
}

export type PublishAgentDefinitionsResult =
  | {
      ok: true
      status: 201
      body: PublishAgentDefinitionsBody
    }
  | {
      ok: false
      status: number
      body: PublishAgentDefinitionsErrorBody
    }

type RawAgentDefinition = Record<string, unknown>

async function getPublishedAgentIds(publisherId: string): Promise<Set<string>> {
  const agents = await db
    .select({
      id: schema.agentConfig.id,
      version: schema.agentConfig.version,
    })
    .from(schema.agentConfig)
    .where(eq(schema.agentConfig.publisher_id, publisherId))

  return new Set(agents.map((a) => `${publisherId}/${a.id}@${a.version}`))
}

/**
 * Publish validated agent definitions into the agent store.
 *
 * Validates incoming definitions, enforces publisher constraints, resolves spawnable subagents,
 * determines versions, and inserts all rows transactionally.
 *
 * @param params - Publish parameters.
 * @param params.agentDefinitions - Raw agent definitions to validate and publish.
 * @param params.allLocalAgentIds - Optional list of local agent IDs to allow during spawnable agent validation.
 * @param params.userId - The authenticated user performing the publish.
 * @param params.logger - Logger instance.
 * @returns A structured result containing either the published agents or an error.
 */
export async function publishAgentDefinitions(params: {
  agentDefinitions: RawAgentDefinition[]
  allLocalAgentIds?: string[]
  userId: string
  logger: Logger
}): Promise<PublishAgentDefinitionsResult> {
  const { agentDefinitions, allLocalAgentIds = [], userId, logger } = params

  try {
    // Convert list of agent definitions to map.
    const agentMap = agentDefinitions.reduce<Record<string, unknown>>(
      (acc, agent) => {
        if (typeof agent.id === 'string' && agent.id.trim().length > 0) {
          acc[agent.id] = agent
        }
        return acc
      },
      {},
    )

    const { validationErrors, dynamicTemplates } =
      await validateAgentsWithSpawnableAgents({
        agentTemplates: agentMap,
        allLocalAgentIds,
        logger,
      })

    if (validationErrors.length > 0) {
      const errorDetails = validationErrors.map((err) => err.message).join('\n')

      return {
        ok: false,
        status: 400,
        body: {
          error: 'Agent config validation failed',
          details: errorDetails,
          validationErrors,
        },
      }
    }

    const agents = Object.values(dynamicTemplates)

    // Check that all agents have publisher field set
    const agentsWithoutPublisher = agents.filter((agent) => !agent.publisher)
    if (agentsWithoutPublisher.length > 0) {
      const agentIds = agentsWithoutPublisher
        .map((agent) => agent.id)
        .join(', ')
      return {
        ok: false,
        status: 400,
        body: {
          error: 'Publisher field required',
          details: `All agents must have the "publisher" field set. Missing for agents: ${agentIds}`,
        },
      }
    }

    // Check that all agents use the same publisher
    const publisherIds = [...new Set(agents.map((agent) => agent.publisher))]
    if (publisherIds.length > 1) {
      return {
        ok: false,
        status: 400,
        body: {
          error: 'Multiple publishers not allowed',
          details: `All agents in a single request must use the same publisher. Found: ${publisherIds.join(', ')}`,
        },
      }
    }

    const requestedPublisherId = publisherIds[0]!

    // Verify user has access to the requested publisher
    const publisherResult = await db
      .select({
        publisher: schema.publisher,
        organization: schema.org,
      })
      .from(schema.publisher)
      .leftJoin(schema.org, eq(schema.publisher.org_id, schema.org.id))
      .leftJoin(
        schema.orgMember,
        and(
          eq(schema.orgMember.org_id, schema.publisher.org_id),
          eq(schema.orgMember.user_id, userId),
        ),
      )
      .where(
        and(
          eq(schema.publisher.id, requestedPublisherId),
          or(
            eq(schema.publisher.user_id, userId),
            and(
              eq(schema.orgMember.user_id, userId),
              or(
                eq(schema.orgMember.role, 'owner'),
                eq(schema.orgMember.role, 'admin'),
              ),
            ),
          ),
        ),
      )
      .limit(1)

    if (publisherResult.length === 0) {
      return {
        ok: false,
        status: 403,
        body: {
          error: 'Publisher not found or not accessible',
          details: `Publisher '${requestedPublisherId}' not found or you don't have permission to publish to it`,
        },
      }
    }

    const publisher = publisherResult[0].publisher

    // Process all agents atomically
    const agentVersions: { id: string; version: Version; data: unknown }[] = []

    // First, determine versions for all agents and check for conflicts
    for (const agent of agents) {
      try {
        const version = await determineNextVersion({
          agentId: agent.id,
          publisherId: publisher.id,
          providedVersion: agent.version,
          db,
        })

        // Check if this version already exists
        const versionAlreadyExists = await versionExists({
          agentId: agent.id,
          version,
          publisherId: publisher.id,
          db,
        })
        if (versionAlreadyExists) {
          return {
            ok: false,
            status: 409,
            body: {
              error: 'Version already exists',
              details: `Agent '${agent.id}' version '${stringifyVersion(version)}' already exists for publisher '${publisher.id}'`,
            },
          }
        }

        agentVersions.push({
          id: agent.id,
          version,
          data: { ...agent, version: stringifyVersion(version) },
        })
      } catch (error) {
        return {
          ok: false,
          status: 400,
          body: {
            error: 'Version determination failed',
            details: `Failed for agent '${agent.id}': ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        }
      }
    }

    // Verify that all spawnable agents are either published or part of this request
    const publishingAgentIds = new Set(
      agentVersions.map(
        (agent) =>
          `${requestedPublisherId}/${agent.id}@${stringifyVersion(agent.version)}`,
      ),
    )
    const publishedAgentIds = await getPublishedAgentIds(requestedPublisherId)

    const existsInSamePublisher = (full: string) =>
      publishingAgentIds.has(full) || publishedAgentIds.has(full)

    const getLatestPublishedVersion = async (
      publisherId: string,
      agentId: string,
    ): Promise<string | null> => {
      const latest = await db
        .select({ version: schema.agentConfig.version })
        .from(schema.agentConfig)
        .where(
          and(
            eq(schema.agentConfig.publisher_id, publisherId),
            eq(schema.agentConfig.id, agentId),
          ),
        )
        .orderBy(
          desc(schema.agentConfig.major),
          desc(schema.agentConfig.minor),
          desc(schema.agentConfig.patch),
        )
        .limit(1)
        .then((rows) => rows[0])
      return latest?.version ?? null
    }

    const agentEntries: AgentVersionEntry[] = agentVersions.map((av) => ({
      id: av.id,
      version: stringifyVersion(av.version),
      data: av.data,
    }))

    try {
      await resolveAndValidateSubagents({
        agents: agentEntries,
        requestedPublisherId,
        existsInSamePublisher,
        getLatestPublishedVersion,
      })
    } catch (err) {
      if (err instanceof SubagentResolutionError) {
        return {
          ok: false,
          status: 400,
          body: {
            error: 'Invalid spawnable agent',
            details: err.message,
            hint: "To fix this, also publish the referenced agent (include it in the same request's data array, or publish it first for the same publisher).",
          },
        }
      }

      logger.error(
        {
          userId,
          publisherId: publisher.id,
          error: err,
        },
        'Unexpected error while resolving subagents',
      )

      return {
        ok: false,
        status: 500,
        body: {
          error: 'Internal server error',
        },
      }
    }

    // If we get here, all agents can be published. Insert them all in a transaction
    const newAgents = await db.transaction(async (tx) => {
      const results = []
      for (const { id, version, data } of agentVersions) {
        const newAgent = await tx
          .insert(schema.agentConfig)
          .values({
            id,
            version: stringifyVersion(version),
            publisher_id: publisher.id,
            data,
          })
          .returning()
          .then((rows) => rows[0])
        results.push(newAgent)
      }
      return results
    })

    logger.info(
      {
        userId,
        publisherId: publisher.id,
        agentIds: newAgents.map((a) => a.id),
        agentCount: newAgents.length,
      },
      'Agents published successfully',
    )

    return {
      ok: true,
      status: 201,
      body: {
        success: true,
        publisherId: publisher.id,
        agents: newAgents.map((agent) => ({
          id: agent.id,
          version: agent.version,
          displayName:
            typeof (agent.data as { displayName?: unknown } | null)?.
              displayName === 'string'
              ? (agent.data as { displayName: string }).displayName
              : agent.id,
        })),
      },
    }
  } catch (error) {
    logger.error(
      {
        userId,
        allLocalAgentIdsCount: allLocalAgentIds.length,
        agentDefinitionsCount: agentDefinitions.length,
        error,
      },
      'Unexpected error while publishing agents',
    )

    return {
      ok: false,
      status: 500,
      body: {
        error: 'Internal server error',
      },
    }
  }
}
