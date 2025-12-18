# Codebuff

Codebuff is an open-source AI coding assistant.

- The CLI runs in your terminal.
- A local web server handles authentication, billing, and agent publishing.

This repository is a Bun monorepo. The instructions below are for running the full stack locally.

## Local development quickstart

### Prerequisites

- Bun (see `package.json` engines)
- Docker (for the local Postgres database)
- A GitHub account (for local login)

### 1) Configure `.env.local`

```bash
cp .env.example .env.local
```

Pick a port and keep these values consistent:

```bash
PORT=3101
NEXT_PUBLIC_WEB_PORT=3101
NEXT_PUBLIC_CODEBUFF_APP_URL=http://localhost:3101
NEXTAUTH_URL=http://localhost:3101
```



### 2) Create a GitHub OAuth App (required for login)

Go to GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**

Use these values (replace the port if you chose a different one):

- Application name: `codebuff-local`
- Homepage URL: `http://localhost:3101`
- Application description: `codebuff-local`
- Authorization callback URL: `http://localhost:3101/api/auth/callback/github`
- Enable Device Flow: enabled

Copy the **Client ID** and generate a **Client secret**, then set:

```bash
CODEBUFF_GITHUB_ID=<your-client-id>
CODEBUFF_GITHUB_SECRET=<your-client-secret>
```


### 3) Install dependencies

```bash
bun install
```

### 4) Start the stack

Option A (recommended): start services and the CLI together.

```bash
bun run dev
```

Option B: background services + separate CLI.

```bash
bun run up
bun run start-cli
```

Stop background services:

```bash
bun run down
```

### 5) Log in

Open `http://localhost:<port>/login` and sign in with GitHub.

The CLI will also prompt you with a login URL when it needs authentication.

### 6) Add credits (local dev)

Local runs still use billing, so your user needs credits.

Start Drizzle Studio:

```bash
bun run start-studio
```

Then open `https://local.drizzle.studio/` and edit the `credit_ledger` table for your user.
Set a large `principal` and `balance` on an active (non-expired) row.

### 7) Use local models (OpenAI-compatible server)

Run an OpenAI-compatible server locally.

Codebuff expects an OpenAI-compatible API with a `/v1` base URL and a chat completions endpoint:

- `POST /v1/chat/completions`

Example base URL:

- `http://localhost:8317/v1`

Verify your server works (replace the model id with one your server supports):

```bash
curl -s http://localhost:8317/v1/chat/completions \
  -H 'Authorization: Bearer factory-api-key' \
  -H 'Content-Type: application/json' \
  -d '{"model":"gpt-5.1-codex-max","messages":[{"role":"user","content":"hi"}]}'
```


To force Codebuff to use your local model for all agent runs, add this to `.env.local`:

```bash
OPENAI_BASE_URL=http://localhost:8317/v1
OPENAI_API_KEY=factory-api-key

CODEBUFF_MODEL_OVERRIDE=gpt-5.1-codex-max
CODEBUFF_PROVIDER_OVERRIDE=openai
```

#### Add new custom models

There are two common ways to add/switch models.

**A) Global override (recommended for local model servers)**

- Set `CODEBUFF_MODEL_OVERRIDE` to the model id your server supports.
- Restart the stack after changing env.

Examples:

```bash
# If your server expects a bare model id
CODEBUFF_MODEL_OVERRIDE=gpt-5.1-codex-max
CODEBUFF_PROVIDER_OVERRIDE=openai

# Or specify the full provider/model string
CODEBUFF_MODEL_OVERRIDE=openai/gpt-5.1-codex-max
```

Notes:

- You do not need to “register” the model anywhere in Codebuff as long as the upstream provider accepts the `model` string.
- If you set the override to an `anthropic/*`, `google/*`, etc. model, the request will go to OpenRouter and you must set a valid `OPEN_ROUTER_API_KEY`.

**B) Per-agent defaults (edit agent templates in this repo)**

Each agent definition has a `model` field. To change what an agent uses by default:

- Base agents: `.agents/base/*` (example: `.agents/base/base.ts`)
- Other agents: `.agents/<agent-name>/*`

If you are using a local OpenAI-compatible server, set the model to `openai/<model-id>`.

Restart after changing env:

```bash
bun run down
bun run up
```

Troubleshooting

- If you see `No cookie auth credentials found`, that is an OpenRouter 401.
  It means the request is still being routed to OpenRouter (for example, the model is `anthropic/*`).
  Fix it by either setting a real `OPEN_ROUTER_API_KEY` or forcing the local model override above.

### 8) Publish/import local agents so the CLI works in other directories

When running the CLI outside this repo, agent templates must be present in the database.

1) Create a publisher profile at `http://localhost:<port>/publishers`.
   Use publisher id `codebuff`.

2) Publish agents (repeat and add more agent ids if you get an "Invalid agent ID" error):

```bash
bun run start-cli -- publish base context-pruner file-explorer file-picker researcher thinker reviewer
```

3) Run the CLI against any directory:

```bash
bun run start-cli -- --cwd /path/to/other/repo
```
