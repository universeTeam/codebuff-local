import fs from 'fs'
import path from 'path'

import { parseAgentId } from '@codebuff/common/util/agent-id-parsing'
import { loadLocalAgents } from '@codebuff/sdk'
import db from '@codebuff/internal/db'
import * as schema from '@codebuff/internal/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { publishAgentDefinitions } from '@/app/api/agents/publish/publish-agent-definitions'
import { checkPublisherPermission } from '@/lib/publisher-permissions'
import { logger } from '@/util/logger'

import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

type LocalAgentsImportResponse =
  | {
      success: true
      publisherId: string
      agents: Array<{ id: string; version: string; displayName: string }>
    }
  | {
      error: string
      details?: string
    }

function rewriteSpawnableAgentsForImport(params: {
  agentDefinitions: Array<Record<string, unknown>>
  localAgentIds: Set<string>
  publisherId: string
}): Array<Record<string, unknown>> {
  const { agentDefinitions, localAgentIds, publisherId } = params

  return agentDefinitions.map((definition) => {
    const spawnableAgents = definition.spawnableAgents
    if (!Array.isArray(spawnableAgents)) {
      return definition
    }

    const rewritten = spawnableAgents
      .map((value) => {
        if (typeof value !== 'string') {
          return value
        }

        const parsed = parseAgentId(value)
        if (!parsed.publisherId || !parsed.agentId) {
          return value
        }

        // If a definition references an agent that we are importing, treat it as a
        // local reference so it can be resolved to the imported version.
        if (parsed.publisherId !== publisherId && localAgentIds.has(parsed.agentId)) {
          return parsed.agentId
        }

        return value
      })
      .filter((value): value is string => typeof value === 'string')

    return {
      ...definition,
      spawnableAgents: rewritten,
    }
  })
}

function findNearestAgentsDirectory(startDir: string): string | null {
  let currentDir = startDir
  const filesystemRoot = path.parse(currentDir).root

  while (true) {
    const candidate = path.join(currentDir, '.agents')
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate
    }

    if (currentDir === filesystemRoot) {
      break
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }

    currentDir = parentDir
  }

  return null
}

/**
 * Import and publish the nearest local `.agents/` directory into the given publisher.
 *
 * @param _request - The incoming Next.js request (unused).
 * @param context - Route params context.
 * @returns A JSON response containing publish results or an error.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<LocalAgentsImportResponse>> {
  const { id: publisherId } = await params

  const permission = await checkPublisherPermission(publisherId)
  if (!permission.success || !permission.userId) {
    return NextResponse.json(
      { error: permission.error || 'Unauthorized' },
      { status: permission.status || 401 },
    )
  }

  const agentsDir = findNearestAgentsDirectory(process.cwd())
  if (!agentsDir) {
    return NextResponse.json(
      {
        error: 'Local .agents directory not found',
        details: `Could not find a .agents directory starting from ${process.cwd()}`,
      },
      { status: 404 },
    )
  }

  const loadResult = await loadLocalAgents({
    agentsPath: agentsDir,
    validate: true,
    verbose: false,
  })
  const loadedAgents = loadResult.agents

  const agentDefinitions = Object.values(loadedAgents).map((agent) => {
    const { _sourceFilePath: _ignored, ...definition } = agent
    return {
      ...definition,
      publisher: publisherId,
    }
  })

  const allLocalAgentIds = agentDefinitions.map((agent) => agent.id)

  const rewrittenAgentDefinitions = rewriteSpawnableAgentsForImport({
    agentDefinitions,
    localAgentIds: new Set(allLocalAgentIds),
    publisherId,
  })

  const existingAgentIds = await db
    .selectDistinct({ id: schema.agentConfig.id })
    .from(schema.agentConfig)
    .where(eq(schema.agentConfig.publisher_id, publisherId))
    .then((rows) => new Set(rows.map((r) => r.id)))

  const newAgentDefinitions = rewrittenAgentDefinitions.filter((agent) => {
    const id = agent.id
    return typeof id === 'string' && !existingAgentIds.has(id)
  })

  if (newAgentDefinitions.length === 0) {
    return NextResponse.json(
      {
        success: true,
        publisherId,
        agents: [],
      },
      { status: 200 },
    )
  }

  const result = await publishAgentDefinitions({
    agentDefinitions: newAgentDefinitions,
    allLocalAgentIds,
    userId: permission.userId,
    logger,
  })

  if (!result.ok) {
    logger.warn(
      {
        publisherId,
        userId: permission.userId,
        agentsDir,
        status: result.status,
        error: result.body.error,
      },
      'Failed importing local .agents to publisher',
    )
  }

  return NextResponse.json(result.body, { status: result.status })
}
