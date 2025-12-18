import type { CiEnv } from '@codebuff/common/types/contracts/env'
import type { Model } from '@codebuff/common/old-constants'

const normalizeEnvValue = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Resolve the model to use for an agent step.
 *
 * Precedence:
 * 1) `ciEnv.CODEBUFF_MODEL_OVERRIDE` if present
 * 2) the template model
 *
 * If `CODEBUFF_MODEL_OVERRIDE` has no provider prefix and
 * `ciEnv.CODEBUFF_PROVIDER_OVERRIDE` is set, the provider prefix is applied.
 *
 * @param params.templateModel - The model specified by the agent template
 * @param params.ciEnv - Typed CI env snapshot
 * @returns The effective model string to use
 */
export function getEffectiveAgentModel(params: {
  templateModel: Model
  ciEnv: CiEnv
}): Model {
  const modelOverride = normalizeEnvValue(params.ciEnv.CODEBUFF_MODEL_OVERRIDE)
  if (!modelOverride) {
    return params.templateModel
  }

  if (modelOverride.includes('/')) {
    return modelOverride
  }

  const providerOverrideRaw = normalizeEnvValue(
    params.ciEnv.CODEBUFF_PROVIDER_OVERRIDE,
  )
  if (!providerOverrideRaw) {
    return modelOverride
  }

  const providerOverride = providerOverrideRaw.replace(/\/+$/, '')
  return `${providerOverride}/${modelOverride}`
}

