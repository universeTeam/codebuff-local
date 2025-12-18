# Local account endpoint overrides

## Problem

The CLI and SDK derive their “website/app URL” from `env.NEXT_PUBLIC_CODEBUFF_APP_URL`. In packaged/binary builds this value is often baked in for production (`https://codebuff.com`), which makes the CLI use online credentials and online APIs even when a local web stack is running.

Separately, credential storage is namespaced by `NEXT_PUBLIC_CB_ENVIRONMENT` (`~/.config/manicode` for `prod`, `~/.config/manicode-dev` for `dev`). If we only override the base URL at runtime but keep the environment as `prod`, local auth would reuse the prod credentials path and risk credential collisions.

## Implementation

We added runtime overrides at the `common/src/env-schema.ts` layer so all consumers (CLI, SDK, web) resolve consistently:

- `CODEBUFF_APP_URL` overrides `NEXT_PUBLIC_CODEBUFF_APP_URL`.
- `CODEBUFF_ENVIRONMENT` overrides `NEXT_PUBLIC_CB_ENVIRONMENT`.
- If `CODEBUFF_APP_URL` is set and `CODEBUFF_ENVIRONMENT` is not, the environment is inferred from the parsed hostname (e.g. `localhost` → `dev`, `staging.*` → `test`).

This makes it possible to point the CLI at a local server without modifying build-time `NEXT_PUBLIC_*` values, and ensures local credentials are written to the `-dev` config directory by default.

## Verification

- Unit tests cover precedence and inference (`common/src/__tests__/env-schema.test.ts`).
