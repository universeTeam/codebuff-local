# Global agent model override

## Goal

Allow developers to force **all agents + subagents** to use a single model without editing each `.agents/*` template.

Additionally, support using a **custom OpenAI-compatible endpoint** via `OPENAI_BASE_URL`.

## Configuration

Environment variables:

- `CODEBUFF_MODEL_OVERRIDE`
  - If set, overrides the model used by agent templates.
  - Accepts either a full model id (e.g. `openai/gpt-5.1-codex-max`) or a provider-less model id (e.g. `gpt-5.1-codex-max`).
- `CODEBUFF_PROVIDER_OVERRIDE`
  - Optional provider prefix applied when `CODEBUFF_MODEL_OVERRIDE` does not include a `/`.
  - Example: `openai` + `gpt-5.1-codex-max` → `openai/gpt-5.1-codex-max`.

OpenAI-compatible routing:

- `OPENAI_BASE_URL`
  - If set to a non-default URL (not `https://api.openai.com/v1`), the server routes `openai/*` models directly to this endpoint for both streaming and non-streaming.
- `OPENAI_API_KEY`
  - Used as the `Authorization: Bearer ...` key for OpenAI-compatible requests.

## Notes

- The agent runtime resolves the effective model per step using the injected `ciEnv` snapshot (no direct `process.env` reads).
- For custom OpenAI-compatible models, upstream cost is treated as `0` unless the model is in `OPENAI_SUPPORTED_MODELS`.

