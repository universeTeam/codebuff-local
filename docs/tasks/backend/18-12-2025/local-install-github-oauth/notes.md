# Local install + GitHub OAuth login

## Goal

Make the local development setup self-serve by documenting the exact GitHub OAuth app settings required for logging into the local web stack.

## Key points

- Local login requires a GitHub OAuth app (`CODEBUFF_GITHUB_ID` + `CODEBUFF_GITHUB_SECRET`).
- The **web port** must match the **public app URL** and the **OAuth callback URL**.
- Example values in docs use `http://localhost:3101` (replace the port if you run on a different one).

## Changes

- Updated `CONTRIBUTING.md` to include exact GitHub OAuth app fields and a small port-consistency checklist.
- Updated `README.md` to point local developers to the contributing guide for the full local setup.
- Updated `.env.example` so its default `PORT` matches the default public URL.

