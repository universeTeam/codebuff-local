import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createClientProcessEnv } from '../env-schema'

test('common/env-schema createClientProcessEnv prefers NEXT_PUBLIC_* values when no CODEBUFF_* overrides are set', () => {
  const env = createClientProcessEnv({
    NEXT_PUBLIC_CB_ENVIRONMENT: 'prod',
    NEXT_PUBLIC_CODEBUFF_APP_URL: 'https://codebuff.com',
    NEXT_PUBLIC_SUPPORT_EMAIL: 'support@codebuff.com',
    NEXT_PUBLIC_POSTHOG_API_KEY: 'phc_test',
    NEXT_PUBLIC_POSTHOG_HOST_URL: 'https://us.i.posthog.com',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test',
    NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: 'https://billing.stripe.com/p/login/test',
    NEXT_PUBLIC_WEB_PORT: '3000',
  })

  assert.equal(env.NEXT_PUBLIC_CB_ENVIRONMENT, 'prod')
  assert.equal(env.NEXT_PUBLIC_CODEBUFF_APP_URL, 'https://codebuff.com')
})

test('common/env-schema createClientProcessEnv CODEBUFF_APP_URL overrides NEXT_PUBLIC_CODEBUFF_APP_URL and infers dev for localhost', () => {
  const env = createClientProcessEnv({
    NEXT_PUBLIC_CB_ENVIRONMENT: 'prod',
    NEXT_PUBLIC_CODEBUFF_APP_URL: 'https://codebuff.com',
    CODEBUFF_APP_URL: 'http://localhost:3000',
  })

  assert.equal(env.NEXT_PUBLIC_CODEBUFF_APP_URL, 'http://localhost:3000')
  assert.equal(env.NEXT_PUBLIC_CB_ENVIRONMENT, 'dev')
})

test('common/env-schema createClientProcessEnv CODEBUFF_ENVIRONMENT overrides inference', () => {
  const env = createClientProcessEnv({
    NEXT_PUBLIC_CB_ENVIRONMENT: 'prod',
    NEXT_PUBLIC_CODEBUFF_APP_URL: 'https://codebuff.com',
    CODEBUFF_APP_URL: 'http://localhost:3000',
    CODEBUFF_ENVIRONMENT: 'prod',
  })

  assert.equal(env.NEXT_PUBLIC_CODEBUFF_APP_URL, 'http://localhost:3000')
  assert.equal(env.NEXT_PUBLIC_CB_ENVIRONMENT, 'prod')
})

test('common/env-schema createClientProcessEnv does not infer test from hostname substrings', () => {
  const env = createClientProcessEnv({
    NEXT_PUBLIC_CB_ENVIRONMENT: 'prod',
    NEXT_PUBLIC_CODEBUFF_APP_URL: 'https://codebuff.com',
    CODEBUFF_APP_URL: 'https://contest.codebuff.com',
  })

  assert.equal(env.NEXT_PUBLIC_CB_ENVIRONMENT, 'prod')
})
