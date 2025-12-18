import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getEffectiveAgentModel } from '../effective-model'

import type { CiEnv } from '@codebuff/common/types/contracts/env'

const baseCiEnv: CiEnv = {
  CI: undefined,
  GITHUB_ACTIONS: undefined,
  RENDER: undefined,
  IS_PULL_REQUEST: undefined,
  CODEBUFF_GITHUB_TOKEN: undefined,
  CODEBUFF_API_KEY: 'test-api-key',
  CODEBUFF_MODEL_OVERRIDE: undefined,
  CODEBUFF_PROVIDER_OVERRIDE: undefined,
  EVAL_RESULTS_EMAIL: undefined,
}

describe('getEffectiveAgentModel', () => {
  it('returns template model when no override is set', () => {
    const model = getEffectiveAgentModel({
      templateModel: 'anthropic/claude-sonnet-4.5',
      ciEnv: baseCiEnv,
    })
    assert.equal(model, 'anthropic/claude-sonnet-4.5')
  })

  it('uses CODEBUFF_MODEL_OVERRIDE when it includes a provider prefix', () => {
    const model = getEffectiveAgentModel({
      templateModel: 'anthropic/claude-sonnet-4.5',
      ciEnv: {
        ...baseCiEnv,
        CODEBUFF_MODEL_OVERRIDE: 'openai/gpt-5.1-codex-max',
      },
    })
    assert.equal(model, 'openai/gpt-5.1-codex-max')
  })

  it('prefixes CODEBUFF_MODEL_OVERRIDE with CODEBUFF_PROVIDER_OVERRIDE when missing a provider', () => {
    const model = getEffectiveAgentModel({
      templateModel: 'anthropic/claude-sonnet-4.5',
      ciEnv: {
        ...baseCiEnv,
        CODEBUFF_MODEL_OVERRIDE: 'gpt-5.1-codex-max',
        CODEBUFF_PROVIDER_OVERRIDE: 'openai',
      },
    })
    assert.equal(model, 'openai/gpt-5.1-codex-max')
  })

  it('trims and ignores whitespace-only overrides', () => {
    const model = getEffectiveAgentModel({
      templateModel: 'anthropic/claude-sonnet-4.5',
      ciEnv: {
        ...baseCiEnv,
        CODEBUFF_MODEL_OVERRIDE: '   ',
        CODEBUFF_PROVIDER_OVERRIDE: 'openai',
      },
    })
    assert.equal(model, 'anthropic/claude-sonnet-4.5')
  })

  it('removes trailing slashes from provider override', () => {
    const model = getEffectiveAgentModel({
      templateModel: 'anthropic/claude-sonnet-4.5',
      ciEnv: {
        ...baseCiEnv,
        CODEBUFF_MODEL_OVERRIDE: 'gpt-5.1-codex-max',
        CODEBUFF_PROVIDER_OVERRIDE: 'openai/',
      },
    })
    assert.equal(model, 'openai/gpt-5.1-codex-max')
  })
})

