import { publishAgentsRequestSchema } from '@codebuff/common/types/api/agents/publish'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { publishAgentDefinitions } from './publish-agent-definitions'
import { authOptions } from '../../auth/[...nextauth]/auth-options'

import type { NextRequest } from 'next/server'

import { getUserInfoFromApiKey } from '@/db/user'
import { extractApiKeyFromHeader } from '@/util/auth'
import { logger } from '@/util/logger'

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const parseResult = publishAgentsRequestSchema.safeParse(body)
    if (!parseResult.success) {
      const errorMessages = parseResult.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
        return `${path}${issue.message}`
      })

      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: errorMessages.join('; '),
          validationErrors: parseResult.error.issues,
        },
        { status: 400 },
      )
    }

    // DEPRECATED: authToken in body is for backwards compatibility with older CLI versions.
    // New clients should use the Authorization header instead.
    const {
      data,
      authToken: bodyAuthToken,
      allLocalAgentIds,
    } = parseResult.data
    const agentDefinitions = data

    // Prefer Authorization header, fall back to body authToken for backwards compatibility
    const authToken = extractApiKeyFromHeader(request) ?? bodyAuthToken

    // Try cookie-based auth first, then fall back to authToken validation using proper function
    let userId: string | undefined
    const session = await getServerSession(authOptions)

    if (session?.user?.id) {
      userId = session.user.id
    } else if (authToken) {
      const user = await getUserInfoFromApiKey({
        apiKey: authToken,
        fields: ['id'],
        logger,
      })
      if (user) {
        userId = user.id
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await publishAgentDefinitions({
      agentDefinitions,
      allLocalAgentIds,
      userId,
      logger,
    })

    return NextResponse.json(result.body, { status: result.status })
  } catch (error: any) {
    logger.error(
      { name: error.name, message: error.message, stack: error.stack },
      'Error handling /api/agents/publish request',
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
