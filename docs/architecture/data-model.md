# Data Model Documentation

> Generated on: 2025-12-18
> Project: codebuff-project
> Tech Stack: Bun workspaces, Next.js 15 (App Router), NextAuth (DrizzleAdapter), PostgreSQL, Drizzle ORM + drizzle-kit, Postgres.js, @tanstack/react-query v5, Zustand, Stripe

## Table of Contents
1. Database Schema ERD
2. Service Layer Models
3. UI Data Structures
4. End-to-End Data Flow

---

## 1. Database Schema ERD

### Overview
- **Primary database:** PostgreSQL (single logical DB for auth, billing, orgs, agents, and traces)
- **ORM / migrations:** Drizzle ORM + drizzle-kit
- **Schema source of truth:** `packages/internal/src/db/schema.ts`
- **Migrations:** `packages/internal/src/db/migrations/` (Drizzle-generated SQL + snapshots in `.../migrations/meta/`)
- **High-cardinality event storage:** `message` table (LLM request/response envelopes + cost/tokens for billing and trace views)
- **Agent publishing storage:** `agent_config.data` (`jsonb`) stores validated agent definitions/templates

### Entity Relationship Diagram

```mermaid
erDiagram
    user ||--o{ account : has
    user ||--o{ session : has
    fingerprint ||--o{ session : ties
    user ||--o{ encrypted_api_keys : stores
    user ||--o{ credit_ledger : grants
    org ||--o{ credit_ledger : org_grants
    user ||--o{ referral : referrer
    user ||--o{ referral : referred
    user ||--o{ org : owns
    org ||--o{ org_member : members
    user ||--o{ org_member : membership
    org ||--o{ org_repo : repos
    user ||--o{ org_repo : approved_by
    org ||--o{ org_invite : invites
    user ||--o{ org_invite : invited_by
    user ||--o{ org_invite : accepted_by
    org ||--o{ org_feature : features
    user ||--o{ publisher : owns_user
    org ||--o{ publisher : owns_org
    user ||--o{ publisher : created_by
    publisher ||--o{ agent_config : publishes
    user ||--o{ agent_run : runs
    agent_run ||--o{ agent_step : steps
    user ||--o{ message : produces
    org ||--o{ message : billed
    user {
        text id PK
        text name
        text email UK
        text password
        timestamp emailVerified
        text image
        text stripe_customer_id UK
        text stripe_price_id
        timestamp next_quota_reset
        timestamp created_at
        text referral_code UK
        int referral_limit
        text discord_id UK
        text handle UK
        boolean auto_topup_enabled
        int auto_topup_threshold
        int auto_topup_amount
        boolean banned
    }
    account {
        text userId FK
        text type
        text provider PK
        text providerAccountId PK
        text refresh_token
        text access_token
        int expires_at
        text token_type
        text scope
        text id_token
        text session_state
    }
    session {
        text sessionToken PK
        text userId FK
        timestamp expires
        text fingerprint_id FK
        session_type type
    }
    fingerprint {
        text id PK
        text sig_hash
        timestamp created_at
    }
    verificationToken {
        text identifier PK
        text token PK
        timestamp expires
    }
    encrypted_api_keys {
        text user_id PK FK
        api_key_type type PK
        text api_key
    }
    credit_ledger {
        text operation_id PK
        text user_id FK
        int principal
        int balance
        grant_type type
        text description
        int priority
        timestamptz expires_at
        timestamptz created_at
        text org_id FK
    }
    referral {
        text referrer_id PK FK
        text referred_id PK FK
        referral_status status
        int credits
        timestamp created_at
        timestamp completed_at
    }
    sync_failure {
        text id PK
        text provider
        timestamptz created_at
        timestamptz last_attempt_at
        int retry_count
        text last_error
    }
    org {
        text id PK
        text name
        text slug UK
        text description
        text owner_id FK
        text stripe_customer_id UK
        text stripe_subscription_id
        timestamptz current_period_start
        timestamptz current_period_end
        boolean auto_topup_enabled
        int auto_topup_threshold
        int auto_topup_amount
        int credit_limit
        boolean billing_alerts
        boolean usage_alerts
        boolean weekly_reports
        timestamptz created_at
        timestamptz updated_at
    }
    org_member {
        text org_id PK FK
        text user_id PK FK
        org_role role
        timestamptz joined_at
    }
    org_repo {
        text id PK
        text org_id FK
        text repo_url
        text repo_name
        text repo_owner
        text approved_by FK
        timestamptz approved_at
        boolean is_active
    }
    org_invite {
        text id PK
        text org_id FK
        text email
        org_role role
        text token UK
        text invited_by FK
        timestamptz expires_at
        timestamptz created_at
        timestamptz accepted_at
        text accepted_by FK
    }
    org_feature {
        text org_id PK FK
        text feature PK
        jsonb config
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    publisher {
        text id PK
        text name
        text email
        boolean verified
        text bio
        text avatar_url
        text user_id FK
        text org_id FK
        text created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    agent_config {
        text publisher_id PK FK
        text id PK
        text version PK
        int major "generated"
        int minor "generated"
        int patch "generated"
        jsonb data
        timestamptz created_at
        timestamptz updated_at
    }
    agent_run {
        text id PK
        text user_id FK
        text agent_id
        text publisher_id "generated"
        text agent_name "generated"
        text agent_version "generated"
        text[] ancestor_run_ids
        text root_run_id "generated"
        text parent_run_id "generated"
        int depth "generated"
        int duration_ms "generated"
        int total_steps
        numeric direct_credits
        numeric total_credits
        agent_run_status status
        text error_message
        timestamptz created_at
        timestamptz completed_at
    }
    agent_step {
        text id PK
        text agent_run_id FK
        int step_number
        int duration_ms "generated"
        numeric credits
        text[] child_run_ids
        int spawned_count "generated"
        text message_id
        agent_step_status status
        text error_message
        timestamptz created_at
        timestamptz completed_at
    }
    message {
        text id PK
        timestamp finished_at
        text client_id
        text client_request_id
        text model
        text agent_id
        jsonb request
        jsonb last_message "generated"
        text reasoning_text
        jsonb response
        int input_tokens
        int cache_creation_input_tokens
        int cache_read_input_tokens
        int reasoning_tokens
        int output_tokens
        numeric cost
        int credits
        boolean byok
        int latency_ms
        text user_id FK
        text org_id FK
        text repo_url
    }
    git_eval_results {
        text id PK
        text cost_mode
        text reasoner_model
        text agent_model
        jsonb metadata
        int cost
        boolean is_public
        timestamptz created_at
    }
```

### Enumerations
- `referral_status`: `pending | completed`
- `agent_run_status`: `running | completed | failed | cancelled`
- `agent_step_status`: `running | completed | skipped`
- `api_key_type`: `anthropic | gemini | openai`
- `grant_type`: `free | referral | purchase | admin | organization`
- `org_role`: `owner | admin | member`
- `session_type`: `web | pat | cli`

### Table Definitions (constraints, indexes, special columns)
| Table | Primary key | Foreign keys | Unique | Indexes / special notes |
|---|---|---|---|---|
| `user` | `id` | - | `email`, `stripe_customer_id`, `referral_code`, `discord_id`, `handle` | Billing + identity fields; `next_quota_reset` defaults ~+1 month; `referral_code` defaults `ref-<uuid>` |
| `account` | (`provider`, `providerAccountId`) | `userId → user.id` (cascade) | - | NextAuth provider accounts |
| `session` | `sessionToken` | `userId → user.id` (cascade), `fingerprint_id → fingerprint.id` | - | Unified storage for `web`/`cli`/`pat` sessions |
| `fingerprint` | `id` | - | - | CLI device identity; `sig_hash` used to claim/unclaim |
| `verificationToken` | (`identifier`, `token`) | - | - | NextAuth verification tokens |
| `encrypted_api_keys` | (`user_id`, `type`) | `user_id → user.id` (cascade) | - | BYOK provider keys; enum `api_key_type` |
| `credit_ledger` | `operation_id` | `user_id → user.id` (cascade), `org_id → org.id` (cascade) | - | `idx_credit_ledger_active_balance` (partial: `balance != 0 AND expires_at IS NULL`), `idx_credit_ledger_org`; `operation_id` is idempotency key |
| `referral` | (`referrer_id`, `referred_id`) | `referrer_id → user.id`, `referred_id → user.id` | - | Tracks referral credits + status |
| `sync_failure` | `id` | - | - | `idx_sync_failure_retry` (partial: `retry_count < 5`); used for Stripe sync failures |
| `org` | `id` | `owner_id → user.id` (cascade) | `slug`, `stripe_customer_id` | Stripe cycle + alert/top-up settings |
| `org_member` | (`org_id`, `user_id`) | `org_id → org.id` (cascade), `user_id → user.id` (cascade) | - | Membership + `org_role` |
| `org_repo` | `id` | `org_id → org.id` (cascade), `approved_by → user.id` | - | `idx_org_repo_active`, `idx_org_repo_unique` (note: not marked unique) |
| `org_invite` | `id` | `org_id → org.id` (cascade), `invited_by → user.id`, `accepted_by → user.id` | `token` | `idx_org_invite_token`, `idx_org_invite_email`, `idx_org_invite_expires` |
| `org_feature` | (`org_id`, `feature`) | `org_id → org.id` (cascade) | - | `idx_org_feature_active`; `config` is `jsonb` |
| `publisher` | `id` | `user_id → user.id` (nullable), `org_id → org.id` (nullable), `created_by → user.id` | - | Check: `publisher_single_owner` (exactly one owner type set) |
| `agent_config` | (`publisher_id`, `id`, `version`) | `publisher_id → publisher.id` | - | `idx_agent_config_publisher`; generated `major/minor/patch` from semver |
| `agent_run` | `id` | `user_id → user.id` (cascade) | - | Indexes: `idx_agent_run_user_id`, `idx_agent_run_parent`, `idx_agent_run_root`, `idx_agent_run_agent_id`, `idx_agent_run_publisher`, `idx_agent_run_status` (partial `running`), `idx_agent_run_ancestors_gin`, `idx_agent_run_completed_publisher_agent` (partial `completed`), `idx_agent_run_completed_recent` (partial `completed`), `idx_agent_run_completed_version` (partial `completed`), `idx_agent_run_completed_user` (partial `completed`) |
| `agent_step` | `id` | `agent_run_id → agent_run.id` (cascade) | - | `unique_step_number_per_run`, `idx_agent_step_run_id`, `idx_agent_step_children_gin` (GIN) |
| `message` | `id` | `user_id → user.id` (cascade), `org_id → org.id` (cascade) | - | `last_message` generated; `message_user_id_idx`, `message_finished_at_user_id_idx`, `message_org_id_idx`, `message_org_id_finished_at_idx` |
| `git_eval_results` | `id` | - | - | `metadata` is `jsonb` (see `GitEvalMetadata` in `packages/internal/src/db/schema.ts`) |

---

## 2. Service Layer Models

### Overview
The “backend” is primarily implemented as Next.js App Router API routes (`web/src/app/api/**/route.ts`) plus reusable packages:
- **DB access:** `@codebuff/internal/db` (Drizzle client)
- **Billing logic:** `@codebuff/billing` (credit ledger, auto top-up, org billing)
- **Agent publishing + validation:** `@codebuff/internal/templates/*` + shared Zod schemas in `@codebuff/common`

Validation is mostly done with **Zod v4** (request DTOs + agent definition schemas), and persistence uses Drizzle inserts/updates.

### Key DTOs (Request/Response)
All of these are validated with Zod in their route modules:
- **CLI auth (fingerprint login):** `web/src/app/api/auth/cli/code/route.ts`, `web/src/app/api/auth/cli/status/route.ts`, `web/src/app/api/auth/cli/logout/route.ts`
  - Request fields: `fingerprintId` (+ optional `referralCode`); status query requires `fingerprintId`, `fingerprintHash`, `expiresAt`
  - Tables: `fingerprint`, `session`
- **CLI usage:** `web/src/app/api/v1/usage/_post.ts`
  - Body: `fingerprintId`, optional `orgId`; API key via Authorization header (body `authToken` is deprecated)
  - Tables: `session` (auth), `credit_ledger` (balance), `org_member`/`org` (org checks when `orgId` is present)
- **Agent run tracking:** `web/src/app/api/v1/agent-runs/_post.ts`, `web/src/app/api/v1/agent-runs/[runId]/steps/_post.ts`
  - Tables: `agent_run`, `agent_step`
- **Agent publishing:** `common/src/types/api/agents/publish.ts`, `web/src/app/api/agents/publish/route.ts`
  - Tables: `publisher`, `org_member` (permissions), `agent_config`
- **Billing:** `packages/billing/src/*`, `web/src/app/api/stripe/buy-credits/route.ts`, `web/src/app/api/user/auto-topup/route.ts`
  - Tables: `credit_ledger` (grants/consumption), `message` (billing fact), `user` / `org` (Stripe + settings)

### Domain Models (selected)

#### Credit balance + usage (billing package)
```ts
type GrantType = 'free' | 'referral' | 'purchase' | 'admin' | 'organization'

interface CreditBalance {
  totalRemaining: number
  totalDebt: number
  netBalance: number
  breakdown: Record<GrantType, number>
  principals: Record<GrantType, number>
}
```
**Key rule:** credits are consumed by updating `credit_ledger.balance` in a serializable transaction; a `message` row is inserted as the billing/audit fact for the invocation.

#### Published agent definition (stored in `agent_config.data`)
```ts
interface DynamicAgentDefinition {
  id: string // /^[a-z0-9-]+$/
  version?: string
  publisher?: string
  displayName: string
  model: string
  toolNames?: string[]
  spawnableAgents?: string[]
  inputSchema?: { prompt?: { type: 'string' }; params?: { type: 'object'; properties?: Record<string, unknown> } }
  outputMode?: 'last_message' | 'all_messages' | 'structured_output'
  systemPrompt?: string
  instructionsPrompt?: string
  stepPrompt?: string
}
```
**Validation:** Zod schemas live in `common/src/types/dynamic-agent-template.ts`.

---

## 3. UI Data Structures

### Overview
- **Web app (`web/`)**: Next.js App Router + React Query for server-state; local UI state via React state + limited Zustand stores
- **CLI (`cli/`)**: React/OpenTUI + Zustand stores for most UI state; streams agent output and tool calls into a structured message tree

### Web (selected types)

**User profile data** (`web/src/types/user.ts`)
```ts
interface UserProfile {
  id: string
  email: string
  handle: string | null
  referral_code: string | null
  auto_topup_enabled: boolean
  auto_topup_threshold: number | null
  auto_topup_amount: number | null
  auto_topup_blocked_reason: string | null
  created_at: Date | null
}
```
**Patterns:**
- React Query server-state: `useUserProfile`, `useOrganizationData`, profile sections (`usageData`, sessions, PATs)
- Zustand local UI state: `web/src/hooks/use-install-dialog.ts`, `web/src/app/store/store-client.tsx`

### CLI (selected types)

**Chat message tree** (`cli/src/types/chat.ts`)
```ts
type ContentBlock =
  | { type: 'text'; content: string; textType?: 'reasoning' | 'text' }
  | { type: 'tool'; toolCallId: string; toolName: string; input: unknown; output?: string }
  | { type: 'agent'; agentId: string; agentType: string; status: 'running' | 'complete' | 'failed'; blocks?: ContentBlock[] }
  | { type: 'ask-user'; toolCallId: string; questions: Array<{ question: string; options: Array<{ label: string }> }> }
```

**Primary CLI store (Zustand)** (`cli/src/state/chat-store.ts`)
```ts
interface ChatStoreState {
  messages: ChatMessage[]
  runState: unknown | null
  sessionCreditsUsed: number
  agentMode: 'agent' | 'ask' | 'plan' | string
  inputMode: string
}
```

---

## 4. End-to-End Data Flow

### Overview
Two primary client entry points (Web and CLI) interact with the same Next.js backend and PostgreSQL database.

```mermaid
flowchart TD
  subgraph Clients
    WEB[Web UI]
    CLI[CLI TUI]
  end

  subgraph API[Next.js API Routes]
    AUTH[Auth & Sessions]
    ORGS[Orgs & Publishers]
    BILL[Billing & Usage]
    RUNS[Agent Runs]
    PUB[Agent Publish]
    LLMAPI[Chat Completions]
  end

  subgraph Services
    DBLAYER[@codebuff/internal/db (Drizzle)]
    BILLPKG[@codebuff/billing]
    AGENTVAL[Agent validation/versioning]
    STRIPE[Stripe API]
    LLM[OpenRouter/OpenAI]
  end

  DB[(PostgreSQL)]

  WEB --> API
  CLI --> API

  AUTH --> DBLAYER
  ORGS --> DBLAYER
  PUB --> AGENTVAL --> DBLAYER
  RUNS --> DBLAYER
  BILL --> BILLPKG --> DBLAYER
  LLMAPI --> BILLPKG
  LLMAPI --> LLM
  BILL --> STRIPE
  ORGS --> STRIPE

  DBLAYER --> DB
```

### Example Flow: CLI agent run lifecycle
1. `POST /api/v1/agent-runs` (`START`) → insert `agent_run` (`status = running`)
2. `POST /api/v1/chat/completions` → verify `agent_run` is `running`, verify credits, call LLM provider
3. Billing transaction → update `credit_ledger.balance` and insert `message` (tokens/cost/credits)
4. `POST /api/v1/agent-runs/:runId/steps` → insert `agent_step` (step credits + spawned child runs)
5. `POST /api/v1/agent-runs` (`FINISH`) → update `agent_run` (`status`, `completed_at`, `total_steps`, rollup credits)

### Example Flow: Publish an agent
1. Client submits `PublishAgentsRequest.data[]` to `POST /api/agents/publish`
2. Server validates agent definitions and resolves `spawnableAgents` references
3. Server checks publisher ownership/permissions (`publisher` + `org_member` when org-owned)
4. Insert new `agent_config` rows (one per agent/version) with `data` jsonb payload

---

## Data Validation Strategy
- **Client-side:** UI-level checks (e.g., min/max amounts, required fields) + TypeScript types
- **Server-side:** Zod request DTO validation; agent definition validation via shared Zod schemas
- **Database:** Primary keys, FKs, unique constraints, partial indexes; semantic invariants enforced via check constraints where necessary (e.g., publisher single owner)

## Notes and Considerations
- **Indexes live in schema:** Drizzle schema defines indexes; migrations are generated from schema + diffs.
- **Security:** Session tokens and PATs live in `session.sessionToken`; BYOK provider keys live in `encrypted_api_keys`.
- **Performance:** `message` is an append-heavy table; indexes target common filters (user/org + time).
