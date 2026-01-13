import path from 'path'

import { defineConfig } from 'drizzle-kit'

const DEFAULT_LOCAL_DATABASE_URL =
  'postgresql://manicode_user_local:secretpassword_local@localhost:5432/manicode_db_local'

const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_LOCAL_DATABASE_URL

export default defineConfig({
  dialect: 'postgresql',
  schema: path.join(__dirname, 'schema.ts').replace(/\\/g, '/'),
  out: 'src/db/migrations',
  dbCredentials: {
    url: databaseUrl,
  },
  tablesFilter: ['*', '!pg_stat_statements', '!pg_stat_statements_info'],
})
