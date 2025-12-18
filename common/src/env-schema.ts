import z from 'zod/v4'

export const CLIENT_ENV_PREFIX = 'NEXT_PUBLIC_'

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_CB_ENVIRONMENT: z.enum(['dev', 'test', 'prod']),
  NEXT_PUBLIC_CODEBUFF_APP_URL: z.url().min(1),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.email().min(1),
  NEXT_PUBLIC_POSTHOG_API_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST_URL: z.url().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: z.url().min(1),
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID: z.string().optional(),
  NEXT_PUBLIC_WEB_PORT: z.coerce.number().min(1000),
} satisfies Record<`${typeof CLIENT_ENV_PREFIX}${string}`, unknown>)
export const clientEnvVars = clientEnvSchema.keyof().options
export type ClientEnvVar = (typeof clientEnvVars)[number]
export type ClientInput = {
  [K in (typeof clientEnvVars)[number]]: string | undefined
}
export type ClientEnv = z.infer<typeof clientEnvSchema>

type CodebuffEnvironment = ClientEnv['NEXT_PUBLIC_CB_ENVIRONMENT']

function inferEnvironmentFromAppUrl(
  appUrl?: string,
): CodebuffEnvironment | undefined {
  if (!appUrl) return undefined

  if (!URL.canParse(appUrl)) return undefined

  const hostname = new URL(appUrl).hostname.toLowerCase()
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  ) {
    return 'dev'
  }

  const labels = hostname.split('.')
  if (labels.includes('dev')) {
    return 'dev'
  }
  if (labels.includes('test') || labels.includes('staging')) {
    return 'test'
  }
  return 'prod'
}

/**
 * Create a `ClientInput` snapshot from a ProcessEnv.
 *
 * Supports runtime overrides for CLI/binaries:
 * - `CODEBUFF_APP_URL` overrides `NEXT_PUBLIC_CODEBUFF_APP_URL`
 * - `CODEBUFF_ENVIRONMENT` overrides `NEXT_PUBLIC_CB_ENVIRONMENT`
 * - If `CODEBUFF_APP_URL` is set and `CODEBUFF_ENVIRONMENT` is not, environment is inferred.
 *
 * @param env Process environment to read.
 * @returns A `ClientInput` map suitable for `clientEnvSchema` parsing.
 */
export function createClientProcessEnv(env: NodeJS.ProcessEnv): ClientInput {
  const codebuffAppUrl = env.CODEBUFF_APP_URL
  const codebuffEnvironment = env.CODEBUFF_ENVIRONMENT
  const inferredEnvironment = inferEnvironmentFromAppUrl(codebuffAppUrl)
  const resolvedEnvironment = codebuffEnvironment ?? inferredEnvironment

  return {
    NEXT_PUBLIC_CB_ENVIRONMENT:
      resolvedEnvironment ?? env.NEXT_PUBLIC_CB_ENVIRONMENT,
    NEXT_PUBLIC_CODEBUFF_APP_URL:
      codebuffAppUrl ?? env.NEXT_PUBLIC_CODEBUFF_APP_URL,
    NEXT_PUBLIC_SUPPORT_EMAIL: env.NEXT_PUBLIC_SUPPORT_EMAIL,
    NEXT_PUBLIC_POSTHOG_API_KEY: env.NEXT_PUBLIC_POSTHOG_API_KEY,
    NEXT_PUBLIC_POSTHOG_HOST_URL: env.NEXT_PUBLIC_POSTHOG_HOST_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL,
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID:
      env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID,
    NEXT_PUBLIC_WEB_PORT: env.NEXT_PUBLIC_WEB_PORT,
  }
}

// Bun will inject all these values, so we need to reference them individually (no for-loops)
const codebuffAppUrl = process.env.CODEBUFF_APP_URL
const codebuffEnvironment = process.env.CODEBUFF_ENVIRONMENT
const inferredEnvironment = inferEnvironmentFromAppUrl(codebuffAppUrl)
const resolvedEnvironment = codebuffEnvironment ?? inferredEnvironment

export const clientProcessEnv: ClientInput = {
  NEXT_PUBLIC_CB_ENVIRONMENT:
    resolvedEnvironment ?? process.env.NEXT_PUBLIC_CB_ENVIRONMENT,
  NEXT_PUBLIC_CODEBUFF_APP_URL:
    codebuffAppUrl ?? process.env.NEXT_PUBLIC_CODEBUFF_APP_URL,
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXT_PUBLIC_POSTHOG_API_KEY: process.env.NEXT_PUBLIC_POSTHOG_API_KEY,
  NEXT_PUBLIC_POSTHOG_HOST_URL: process.env.NEXT_PUBLIC_POSTHOG_HOST_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL,
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID:
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID,
  NEXT_PUBLIC_WEB_PORT: process.env.NEXT_PUBLIC_WEB_PORT,
}
