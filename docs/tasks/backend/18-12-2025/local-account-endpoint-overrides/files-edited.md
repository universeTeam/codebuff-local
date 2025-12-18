# Files Edited

- File path: `common/src/env-schema.ts`
  - Line ranges modified: 5-93
  - Description: Added `CODEBUFF_APP_URL` and `CODEBUFF_ENVIRONMENT` runtime overrides (with hostname-based inference), kept `clientProcessEnv` as explicit `process.env.*` reads for Bun env inlining, and removed the `any` type from the schema typing.

- File path: `common/src/__tests__/env-schema.test.ts`
  - Line ranges modified: 1-53
  - Description: Added unit tests for override precedence and localhost inference, using the `node:test` API (compatible with Bun's runner).

- File path: `.env.example`
  - Line ranges modified: 38-38
  - Description: Added `NEXT_PUBLIC_WEB_PORT=3000` to match the validated client env schema.

- File path: `docs/tasks/backend/18-12-2025/local-account-endpoint-overrides/notes.md`
  - Line ranges modified: 1-21
  - Description: Captured the problem statement, design choices, and verification notes for local endpoint overrides.

- File path: `docs/tasks/backend/18-12-2025/local-account-endpoint-overrides/files-edited.md`
  - Line ranges modified: 1-19
  - Description: Added the required per-task change log.
