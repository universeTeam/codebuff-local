# Data model documentation generation

Date: 2025-12-18

## Goal
Generate a single, comprehensive data model document at `docs/architecture/data-model.md` covering:
- Database schema (tables, relationships, constraints, indexes)
- Service layer models (DTOs + core domain structures)
- UI data structures (web + CLI state/data shapes)

## Discovery summary

### Database
- PostgreSQL via Drizzle ORM + drizzle-kit (`packages/internal/src/db/drizzle.config.ts`)
- Schema source of truth: `packages/internal/src/db/schema.ts`
- Migrations: `packages/internal/src/db/migrations/*` with snapshots in `packages/internal/src/db/migrations/meta/*`
- Key domains in schema: auth (NextAuth tables), billing (credit ledger + message facts), orgs, publishers/agent configs, agent runs/steps, eval results.

### Backend
- Next.js App Router API routes in `web/src/app/api/**/route.ts` and versioned API under `web/src/app/api/v1/**`
- Auth: NextAuth + DrizzleAdapter (`web/src/app/api/auth/[...nextauth]/auth-options.ts`)
- Validation pattern: Zod schemas in route handlers + shared Zod schemas in `common/src/types/*`

### Frontend / UI
- Web: React Query for server state; a small amount of Zustand for local UI state (e.g., install dialog, agent store filtering)
- CLI: Zustand for primary UI state (chat, login, publish, feedback) and structured message trees (`cli/src/types/chat.ts`)
