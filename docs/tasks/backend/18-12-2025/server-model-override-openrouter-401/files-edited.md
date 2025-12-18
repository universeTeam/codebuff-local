# Files edited

- File path: `packages/internal/src/env-schema.ts`
  - Line ranges modified: 4-13, 43-54
  - Description: Added optional `CODEBUFF_MODEL_OVERRIDE` and `CODEBUFF_PROVIDER_OVERRIDE` to the server env schema and process env snapshot.

- File path: `web/src/app/api/v1/chat/completions/_post.ts`
  - Line ranges modified: 112-127
  - Description: Implemented server-side model rewriting using `CODEBUFF_MODEL_OVERRIDE` / `CODEBUFF_PROVIDER_OVERRIDE` so local dev can force GPT and avoid OpenRouter.

- File path: `CONTRIBUTING.md`
  - Line ranges modified: 65-70
  - Description: Documented that `No cookie auth credentials found` is an OpenRouter auth error and how to fix it (either set a real `OPEN_ROUTER_API_KEY` or force a local OpenAI-compatible model override).

- File path: `docs/tasks/backend/18-12-2025/server-model-override-openrouter-401/notes.md`
  - Line ranges modified: 11-26
  - Description: Added root-cause explanation and clarified that the error is OpenRouter auth, not GitHub OAuth.
