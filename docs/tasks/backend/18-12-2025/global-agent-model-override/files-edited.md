# Files edited

- File path: `.env.example`
  - Line ranges modified: 1-15
  - Description: Added `OPENAI_BASE_URL`, `CODEBUFF_MODEL_OVERRIDE`, and `CODEBUFF_PROVIDER_OVERRIDE` examples for global agent model overrides.

- File path: `CONTRIBUTING.md`
  - Line ranges modified: 49-63
  - Description: Documented how to force a single model for all agents and how to point to a local OpenAI-compatible endpoint.

- File path: `common/src/types/contracts/env.ts`
  - Line ranges modified: 86-103
  - Description: Extended `CiEnv` with optional `CODEBUFF_MODEL_OVERRIDE` and `CODEBUFF_PROVIDER_OVERRIDE` for dependency-injected config.

- File path: `common/src/env-ci.ts`
  - Line ranges modified: 14-23, 42-52
  - Description: Plumbed `CODEBUFF_MODEL_OVERRIDE` and `CODEBUFF_PROVIDER_OVERRIDE` through `getCiEnv()` and `createTestCiEnv()`.

- File path: `packages/internal/src/env-schema.ts`
  - Line ranges modified: 4-11, 41-50
  - Description: Added optional `OPENAI_BASE_URL` to the server env schema and process env snapshot.

- File path: `packages/agent-runtime/src/util/effective-model.ts`
  - Line ranges modified: 1-45
  - Description: Implemented `getEffectiveAgentModel()` to apply the global model override consistently.

- File path: `packages/agent-runtime/src/util/__tests__/effective-model.test.ts`
  - Line ranges modified: 1-75
  - Description: Added unit tests covering provider-prefixing, whitespace handling, and trailing-slash normalization.

- File path: `packages/agent-runtime/src/run-agent-step.ts`
  - Line ranges modified: 28-64, 101-102, 239-363, 442
  - Description: Applied `getEffectiveAgentModel()` so template-driven agent steps use the overridden model for both `n` and streaming paths.

- File path: `packages/agent-runtime/src/__tests__/n-parameter.test.ts`
  - Line ranges modified: 163-186, 233-238, 251-256
  - Description: Added coverage ensuring `CODEBUFF_MODEL_OVERRIDE` affects both `promptAiSdk` (n path) and `promptAiSdkStream` (streaming).

- File path: `web/src/llm-api/openai.ts`
  - Line ranges modified: 16-28, 54-236, 244-558
  - Description: Added `OPENAI_BASE_URL` support, relaxed model gating for custom endpoints, and implemented streaming OpenAI-compatible proxying with billing hooks.

- File path: `web/src/app/api/v1/chat/completions/_post.ts`
  - Line ranges modified: 10, 270-333
  - Description: Routed `openai/*` streaming + non-streaming requests to the OpenAI handler when a custom `OPENAI_BASE_URL` is configured.

- File path: `docs/tasks/backend/18-12-2025/global-agent-model-override/notes.md`
  - Line ranges modified: 1-30
  - Description: Recorded implementation notes and the environment-variable contract for this task.

