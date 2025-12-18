# Add large admin credits (local dev)

## Goal

Make `http://localhost:3101/profile?tab=usage` show an additional **199,999,999,999** credits for the currently logged-in user.

## Where the UI reads credits

- `web/src/app/profile/components/usage-section.tsx` fetches `GET /api/user/usage`.
- `web/src/app/api/user/usage/route.ts` calls `getUserUsageData({ userId })` from `@codebuff/billing`.
- `packages/billing/src/usage-service.ts` delegates to `calculateUsageAndBalance(...)`.
- `packages/billing/src/balance-calculator.ts` computes `balance.totalRemaining` by summing **active grants**.

## Where the balance lives in the DB

Credits are **ledger-based**, stored in the `credit_ledger` table.

Each row represents a grant (or debt) with:

- `principal`: original granted amount
- `balance`: remaining amount
- `type`: `free | referral | purchase | admin | organization`

## Implementation details

### 1) Widen numeric types (needed for this amount)

`199,999,999,999` does not fit in Postgres `integer`, so `credit_ledger.principal` and `credit_ledger.balance` were widened to `bigint`.

- Drizzle schema updated in `packages/internal/src/db/schema.ts`
- Migration generated: `packages/internal/src/db/migrations/0033_fat_phil_sheldon.sql`

### 2) Add the credit grant row

Inserted a single **non-expiring** grant into `credit_ledger`:

- `type = 'admin'`
- `priority = 60` (matches `GRANT_PRIORITIES.admin`)
- `principal = balance = 199999999999`

Example SQL shape:

```sql
insert into credit_ledger (
  operation_id,
  user_id,
  principal,
  balance,
  type,
  description,
  priority,
  expires_at,
  created_at,
  org_id
) values (
  'admin-<userId>-<timestamp>',
  '<userId>',
  199999999999,
  199999999999,
  'admin',
  'Dev grant: 199,999,999,999 credits',
  60,
  null,
  now(),
  null
);
```

## Verification

- DB-level: `sum(balance)` for the user’s active grants includes `199999999999` under `type = 'admin'`.
- Service-level: `getUserUsageData(...)` returns `balance.totalRemaining = 199999999999`.

