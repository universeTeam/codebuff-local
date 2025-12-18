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

Run an OpenAI-compatible server locally using CLI Proxy.

Codebuff expects an OpenAI-compatible API with a `/v1` base URL and a chat completions endpoint:

- `POST /v1/chat/completions`

Example base URL:

- `http://localhost:8317/v1`


To force Codebuff to use your local model for all agent runs, add this to `.env.local`:

```bash
OPENAI_BASE_URL=http://localhost:8317/v1
OPENAI_API_KEY=factory-api-key

CODEBUFF_MODEL_OVERRIDE=gpt-5.1-codex-max
CODEBUFF_PROVIDER_OVERRIDE=openai
```

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

