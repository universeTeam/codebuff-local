# Server model override for OpenRouter 401

## Problem

Local runs were still sending template models like `anthropic/claude-opus-4.5` to `POST /api/v1/chat/completions`, which routes through OpenRouter. With no valid OpenRouter API key, OpenRouter returns:

- `401 {"error":{"message":"No cookie auth credentials found","code":401}}`

Even if `OPENAI_BASE_URL` / `OPENAI_API_KEY` are set for a local OpenAI-compatible server, those values are only used when the incoming model is `openai/*`.

This is why the error can persist even after setting local OpenAI-compatible config: the client may still be sending template models like `anthropic/*`.

## Fix

Add a **server-side model override** in the chat completions route so local dev can force all requests onto a single model regardless of what the client/SDK sends.

Env vars:

- `CODEBUFF_MODEL_OVERRIDE` (e.g. `gpt-5.1-codex-max` or `openai/gpt-5.1-codex-max`)
- `CODEBUFF_PROVIDER_OVERRIDE` (e.g. `openai`) when `CODEBUFF_MODEL_OVERRIDE` has no provider prefix

This makes the server rewrite `body.model` before routing to OpenRouter/OpenAI.

## Key detail

`No cookie auth credentials found` is an OpenRouter error message for an unauthenticated API call. It is not related to GitHub OAuth / NextAuth session cookies.

## Result

With:

- `OPENAI_BASE_URL=http://localhost:8317/v1`
- `OPENAI_API_KEY=factory-api-key`
- `CODEBUFF_MODEL_OVERRIDE=gpt-5.1-codex-max`
- `CODEBUFF_PROVIDER_OVERRIDE=openai`

the server will route completions to the local OpenAI-compatible endpoint and avoid OpenRouter entirely.
