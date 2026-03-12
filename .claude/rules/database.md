---
description: "Supabase Postgres and RLS rules"
paths: ["**/*.ts", "**/*.tsx", "supabase/**"]
---

# Database

- Use `createClient()` from `@/lib/supabase/server` for server-side access, `@/lib/supabase/client` for browser
- Always call `getUser()` to validate auth before mutations — do not rely on `getSession()` alone
- RLS enforces data isolation — no application-level authorization checks needed beyond passing `user_id`
- Schema changes go in `supabase/migrations/` and are applied via `supabase db push`
- Use `TIMESTAMPTZ` for timestamps — day-boundary grouping uses `AT TIME ZONE 'Europe/Stockholm'`
