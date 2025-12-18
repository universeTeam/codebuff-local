import { env } from '@codebuff/internal/env'

import {
  consumeCreditsForMessage,
  extractRequestMetadata,
  insertMessageToBigQuery,
} from './helpers'

import type { UsageData } from './helpers'
import type { InsertMessageBigqueryFn } from '@codebuff/common/types/contracts/bigquery'
import type { Logger } from '@codebuff/common/types/contracts/logger'

export const OPENAI_SUPPORTED_MODELS = ['gpt-5', 'gpt-5.1'] as const
export type OpenAIModel = (typeof OPENAI_SUPPORTED_MODELS)[number]

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '')

const getOpenAIChatCompletionsUrl = (): string => {
  const baseUrl = normalizeBaseUrl(env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL)
  return `${baseUrl}/chat/completions`
}

const shouldAllowAnyOpenAIModel = (): boolean => {
  const baseUrl = normalizeBaseUrl(env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL)
  return baseUrl !== DEFAULT_OPENAI_BASE_URL
}

const INPUT_TOKEN_COSTS: Record<OpenAIModel, number> = {
  'gpt-5': 1.25,
  'gpt-5.1': 1.25,
} as const
const CACHED_INPUT_TOKEN_COSTS: Record<OpenAIModel, number> = {
  'gpt-5': 0.125,
  'gpt-5.1': 0.125,
} as const
const OUTPUT_TOKEN_COSTS: Record<OpenAIModel, number> = {
  'gpt-5': 10,
  'gpt-5.1': 10,
} as const

type OpenAIUsage = {
  prompt_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number } | null
  completion_tokens?: number
  completion_tokens_details?: { reasoning_tokens?: number } | null
  total_tokens?: number
  // We will inject cost fields below
  cost?: number
  cost_details?: { upstream_inference_cost?: number | null } | null
}

type OpenAIStreamChunk = {
  id: string
  model?: string
  choices?: Array<{
    delta?: {
      content?: string
      reasoning?: string
    }
  }>
  usage?: OpenAIUsage | null
  error?: unknown
}

function extractUsageAndCost(usage: OpenAIUsage, model: string): UsageData {
  const isSupportedModel = OPENAI_SUPPORTED_MODELS.includes(model as OpenAIModel)
  const inputTokenCost = isSupportedModel
    ? INPUT_TOKEN_COSTS[model as OpenAIModel]
    : 0
  const cachedInputTokenCost = isSupportedModel
    ? CACHED_INPUT_TOKEN_COSTS[model as OpenAIModel]
    : 0
  const outputTokenCost = isSupportedModel
    ? OUTPUT_TOKEN_COSTS[model as OpenAIModel]
    : 0

  const inTokens = usage.prompt_tokens ?? 0
  const cachedInTokens = usage.prompt_tokens_details?.cached_tokens ?? 0
  const outTokens = usage.completion_tokens ?? 0
  const cost =
    (inTokens / 1_000_000) * inputTokenCost +
    (cachedInTokens / 1_000_000) * cachedInputTokenCost +
    (outTokens / 1_000_000) * outputTokenCost

  return {
    inputTokens: inTokens,
    outputTokens: outTokens,
    cacheReadInputTokens: cachedInTokens,
    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
    cost,
  }
}

export async function handleOpenAINonStream({
  body,
  userId,
  agentId,
  fetch,
  logger,
  insertMessageBigquery,
}: {
  body: any
  userId: string
  agentId: string
  fetch: typeof globalThis.fetch
  logger: Logger
  insertMessageBigquery: InsertMessageBigqueryFn
}) {
  const startTime = new Date()
  const { clientId, clientRequestId, n } = extractRequestMetadata({
    body,
    logger,
  })

  const { model } = body
  const requestedModel = typeof model === 'string' ? model : undefined
  const upstreamModel = requestedModel?.startsWith('openai/')
    ? requestedModel.slice('openai/'.length)
    : undefined
  if (!upstreamModel) {
    throw new Error(`Missing or invalid OpenAI model: ${model}`)
  }

  const allowAnyModel = shouldAllowAnyOpenAIModel()
  if (!allowAnyModel && !OPENAI_SUPPORTED_MODELS.includes(upstreamModel as any)) {
    throw new Error(
      `Unsupported OpenAI model: ${requestedModel} (supported models include only: ${OPENAI_SUPPORTED_MODELS.map((m) => `'${m}'`).join(', ')})`,
    )
  }

  // Build OpenAI-compatible body
  const openaiBody: Record<string, unknown> = {
    ...body,
    model: upstreamModel,
    stream: false,
    ...(n && { n }),
  }

  // Transform max_tokens to max_completion_tokens
  openaiBody.max_completion_tokens =
    openaiBody.max_completion_tokens ?? openaiBody.max_tokens
  delete (openaiBody as any).max_tokens

  // Transform reasoning to reasoning_effort
  if (openaiBody.reasoning && typeof openaiBody.reasoning === 'object') {
    const reasoning = openaiBody.reasoning as {
      enabled?: boolean
      effort?: 'high' | 'medium' | 'low'
    }
    const enabled = reasoning.enabled ?? true

    if (enabled) {
      openaiBody.reasoning_effort = reasoning.effort ?? 'medium'
    }
  }
  delete (openaiBody as any).reasoning

  // Remove fields that OpenAI doesn't support
  delete (openaiBody as any).stop
  delete (openaiBody as any).usage
  delete (openaiBody as any).provider
  delete (openaiBody as any).transforms
  delete (openaiBody as any).codebuff_metadata

  const response = await fetch(getOpenAIChatCompletionsUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(openaiBody),
  })

  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText} ${await response.text()}`,
    )
  }

  const data = await response.json()

  // Extract usage and content from all choices
  const usage: OpenAIUsage = data.usage ?? {}
  const usageData = extractUsageAndCost(usage, upstreamModel)

  // Inject cost into response
  data.usage.cost = usageData.cost
  data.usage.cost_details = { upstream_inference_cost: null }

  // Collect all response content from all choices into an array
  const responseContents: string[] = []
  if (data.choices && Array.isArray(data.choices)) {
    for (const choice of data.choices) {
      responseContents.push(choice.message?.content ?? '')
    }
  }
  const responseText = JSON.stringify(responseContents)
  const reasoningText = ''

  // BigQuery insert (do not await)
  insertMessageToBigQuery({
    messageId: data.id,
    userId,
    startTime,
    request: body,
    reasoningText,
    responseText,
    usageData,
    logger,
    insertMessageBigquery,
  }).catch((error) => {
    logger.error({ error }, 'Failed to insert message into BigQuery (OpenAI)')
  })

  await consumeCreditsForMessage({
    messageId: data.id,
    userId,
    agentId,
    clientId,
    clientRequestId,
    startTime,
    model: data.model,
    reasoningText,
    responseText,
    usageData,
    byok: false,
    logger,
  })

  return {
    ...data,
    choices: [
      {
        index: 0,
        message: { content: responseText, role: 'assistant' },
        finish_reason: 'stop',
      },
    ],
  }
}

export async function handleOpenAIStream({
  body,
  userId,
  agentId,
  fetch,
  logger,
  insertMessageBigquery,
}: {
  body: any
  userId: string
  agentId: string
  fetch: typeof globalThis.fetch
  logger: Logger
  insertMessageBigquery: InsertMessageBigqueryFn
}): Promise<ReadableStream> {
  // Ensure streaming usage is included (OpenAI-style)
  const startTime = new Date()
  const { clientId, clientRequestId } = extractRequestMetadata({ body, logger })

  const requestedModel =
    typeof body?.model === 'string' ? (body.model as string) : undefined
  const upstreamModel = requestedModel?.startsWith('openai/')
    ? requestedModel.slice('openai/'.length)
    : undefined
  if (!upstreamModel) {
    throw new Error(`Missing or invalid OpenAI model: ${body?.model}`)
  }

  const allowAnyModel = shouldAllowAnyOpenAIModel()
  if (!allowAnyModel && !OPENAI_SUPPORTED_MODELS.includes(upstreamModel as any)) {
    throw new Error(
      `Unsupported OpenAI model: ${requestedModel} (supported models include only: ${OPENAI_SUPPORTED_MODELS.map((m) => `'${m}'`).join(', ')})`,
    )
  }

  const openaiBody: Record<string, unknown> = {
    ...body,
    model: upstreamModel,
    stream: true,
    stream_options: {
      // Ensure we receive a final usage object for billing.
      // If the upstream doesn't support this, we will still forward the stream.
      ...((body as any).stream_options ?? {}),
      include_usage: true,
    },
  }

  // Transform max_tokens to max_completion_tokens
  openaiBody.max_completion_tokens =
    openaiBody.max_completion_tokens ?? openaiBody.max_tokens
  delete (openaiBody as any).max_tokens

  // Transform reasoning to reasoning_effort
  if (openaiBody.reasoning && typeof openaiBody.reasoning === 'object') {
    const reasoning = openaiBody.reasoning as {
      enabled?: boolean
      effort?: 'high' | 'medium' | 'low'
    }
    const enabled = reasoning.enabled ?? true

    if (enabled) {
      openaiBody.reasoning_effort = reasoning.effort ?? 'medium'
    }
  }
  delete (openaiBody as any).reasoning

  // Remove fields that OpenAI doesn't support
  delete (openaiBody as any).stop
  delete (openaiBody as any).usage
  delete (openaiBody as any).provider
  delete (openaiBody as any).transforms
  delete (openaiBody as any).codebuff_metadata

  const response = await fetch(getOpenAIChatCompletionsUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(openaiBody),
  })

  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText} ${await response.text()}`,
    )
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Failed to get response reader')
  }

  let heartbeatInterval: NodeJS.Timeout
  let responseText = ''
  let reasoningText = ''
  let clientDisconnected = false
  let billed = false

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder()
      let buffer = ''

      controller.enqueue(
        new TextEncoder().encode(`: connected ${new Date().toISOString()}\n`),
      )

      heartbeatInterval = setInterval(() => {
        if (!clientDisconnected) {
          try {
            controller.enqueue(
              new TextEncoder().encode(
                `: heartbeat ${new Date().toISOString()}\n\n`,
              ),
            )
          } catch {
            // client disconnected, ignore error
          }
        }
      }, 30000)

      try {
        let done = false
        while (!done) {
          const result = await reader.read()
          done = result.done
          const value = result.value

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          let lineEnd = buffer.indexOf('\n')

          while (lineEnd !== -1) {
            const line = buffer.slice(0, lineEnd + 1)
            buffer = buffer.slice(lineEnd + 1)

            const updated = await handleOpenAIStreamLine({
              line,
              upstreamModel,
              request: body,
              startTime,
              userId,
              agentId,
              clientId,
              clientRequestId,
              responseText,
              reasoningText,
              billed,
              logger,
              insertMessageBigquery,
            })
            responseText = updated.responseText
            reasoningText = updated.reasoningText
            billed = updated.billed

            if (!clientDisconnected) {
              try {
                controller.enqueue(new TextEncoder().encode(line))
              } catch {
                logger.warn(
                  'Client disconnected during stream, continuing for billing',
                )
                clientDisconnected = true
              }
            }

            lineEnd = buffer.indexOf('\n')
          }
        }

        if (!clientDisconnected) {
          controller.close()
        }
      } catch (error) {
        if (!clientDisconnected) {
          controller.error(error)
        } else {
          logger.warn(
            { error: String(error ?? '') },
            'Error after client disconnect in OpenAI stream',
          )
        }
      } finally {
        clearInterval(heartbeatInterval)
      }
    },
    cancel() {
      clearInterval(heartbeatInterval)
      clientDisconnected = true
      logger.warn(
        { clientDisconnected, billed },
        'Client cancelled stream, continuing OpenAI consumption for billing',
      )
    },
  })

  return stream
}

async function handleOpenAIStreamLine(params: {
  line: string
  upstreamModel: string
  request: unknown
  startTime: Date
  userId: string
  agentId: string
  clientId: string | null
  clientRequestId: string | null
  responseText: string
  reasoningText: string
  billed: boolean
  logger: Logger
  insertMessageBigquery: InsertMessageBigqueryFn
}): Promise<{ responseText: string; reasoningText: string; billed: boolean }> {
  const {
    line,
    upstreamModel,
    request,
    startTime,
    userId,
    agentId,
    clientId,
    clientRequestId,
    billed,
    logger,
    insertMessageBigquery,
  } = params

  if (!line.startsWith('data: ')) {
    return {
      responseText: params.responseText,
      reasoningText: params.reasoningText,
      billed,
    }
  }

  const raw = line.slice('data: '.length)
  if (raw === '[DONE]\n') {
    return {
      responseText: params.responseText,
      reasoningText: params.reasoningText,
      billed,
    }
  }

  let obj: OpenAIStreamChunk
  try {
    obj = JSON.parse(raw) as OpenAIStreamChunk
  } catch {
    return {
      responseText: params.responseText,
      reasoningText: params.reasoningText,
      billed,
    }
  }

  const delta = obj.choices?.[0]?.delta
  const nextResponseText =
    params.responseText + (typeof delta?.content === 'string' ? delta.content : '')
  const nextReasoningText =
    params.reasoningText +
    (typeof delta?.reasoning === 'string' ? delta.reasoning : '')

  if (!billed && obj.usage) {
    const usageData = extractUsageAndCost(obj.usage, upstreamModel)

    insertMessageToBigQuery({
      messageId: obj.id,
      userId,
      startTime,
      request,
      reasoningText: nextReasoningText,
      responseText: nextResponseText,
      usageData,
      logger,
      insertMessageBigquery,
    }).catch((error) => {
      logger.error(
        { error },
        'Failed to insert message into BigQuery (OpenAI stream)',
      )
    })

    await consumeCreditsForMessage({
      messageId: obj.id,
      userId,
      agentId,
      clientId,
      clientRequestId,
      startTime,
      model: obj.model ?? upstreamModel,
      reasoningText: nextReasoningText,
      responseText: nextResponseText,
      usageData,
      byok: false,
      logger,
    })

    return {
      responseText: nextResponseText,
      reasoningText: nextReasoningText,
      billed: true,
    }
  }

  return {
    responseText: nextResponseText,
    reasoningText: nextReasoningText,
    billed,
  }
}
