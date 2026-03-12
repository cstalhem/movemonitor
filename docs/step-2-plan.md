# Step 2: Supabase + Auth + Vercel deployment

Detailed plan for implementing Step 2 from the implementation plan.

---

## Goal

Replace SQLite with Supabase Postgres, add multi-user authentication with email OTP, and deploy to Vercel. After this step, the app runs on production infrastructure with real auth — every subsequent step builds on Supabase, not throwaway SQLite code.

**Working state:** Authenticated user can log a movement on a live Vercel URL. Data persists in Supabase with RLS enforced.

---

## What changes from Step 1

Step 1 delivered the project skeleton, log screen, and SQLite persistence. Step 2 replaces the entire data layer and adds auth:

1. **Database:** SQLite (`better-sqlite3`) → Supabase Postgres with RLS
2. **Auth:** None → Supabase Auth with email OTP (6-digit code)
3. **Session handling:** None → `proxy.ts` (Next.js 16 convention, replaces `middleware.ts`)
4. **Service layer:** Direct SQLite calls → Supabase JS client (`@supabase/ssr`)
5. **Deployment:** Local-only → Vercel
6. **Email:** Supabase Auth emails via custom SMTP (Resend)
7. **Schema management:** None → Supabase CLI with migration files

**Removed:** `src/lib/db.ts`, `better-sqlite3` dependency, `DB_PATH` env var, `output: "standalone"`, `serverExternalPackages`

---

## Prerequisites (manual, before coding)

These are one-time setup tasks done in dashboards and locally, not in application code:

1. **Create Supabase project** — note the project URL and anon key
2. **Configure custom SMTP in Supabase dashboard** — use Resend with the project domain. Supabase's built-in SMTP is demo-only (4 emails/hour limit), unusable for real auth flows
3. **Configure Supabase Auth settings:**
   - Enable email OTP (6-digit code, not magic link) in Authentication → Email Templates
   - Set OTP expiry (default 60s is fine)
   - Add redirect URLs: the Vercel production URL and a wildcard for preview deployments (e.g., `https://*-cstalhem.vercel.app/**`)
4. **Set up Vercel project** linked to the GitHub repo
5. **Add env vars in Vercel:**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. **Install Supabase CLI:**
   ```bash
   brew install supabase/tap/supabase
   ```
7. **Initialize Supabase locally and link to the remote project:**
   ```bash
   supabase init
   supabase link --project-ref <project-ref>
   ```
8. **Create `.env.local` for local development** (not committed):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   ```
   Also create `.env.local.example` (committed) with placeholder values as documentation.

---

## Database

### Schema (migration file)

Create the migration:

```bash
supabase migration new create_movements
```

This creates `supabase/migrations/<timestamp>_create_movements.sql`. Contents:

```sql
CREATE TABLE movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  intensity TEXT NOT NULL CHECK (intensity IN ('mycket', 'mellan', 'lite')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_user_occurred ON movements (user_id, occurred_at);

ALTER TABLE movements ENABLE ROW LEVEL SECURITY;

-- Users can only read their own movements
CREATE POLICY "Users can select own movements"
ON movements FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can only insert their own movements
CREATE POLICY "Users can insert own movements"
ON movements FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own movements (needed for Step 5 undo)
CREATE POLICY "Users can delete own movements"
ON movements FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

Apply to the remote database:

```bash
supabase db push
```

### Key schema changes from Step 1

| Aspect | Step 1 (SQLite) | Step 2 (Supabase) |
|---|---|---|
| Primary key | `INTEGER AUTOINCREMENT` | `UUID gen_random_uuid()` |
| Timestamp | `created_at TEXT` (local ISO 8601) | `occurred_at TIMESTAMPTZ` (Postgres-native) |
| User scoping | None (single-user) | `user_id UUID` with RLS |
| Index | `created_at` only | `(user_id, occurred_at)` composite |

**Why `occurred_at` instead of `created_at`?** The column represents when the movement happened, not when the row was inserted. `TIMESTAMPTZ` stores UTC internally — day-boundary grouping uses `AT TIME ZONE 'Europe/Stockholm'` in queries (Step 3).

**Why UUID instead of auto-increment?** Supabase convention. UUIDs are the default for `auth.users(id)`, and using the same type for `movements.id` avoids type mismatches. Also safe for distributed inserts (no sequence conflicts).

### Row Level Security (RLS)

RLS is the security boundary — even if the client-side code has a bug, the database enforces that users can only access their own data. No application-level authorization checks needed.

The policies are included in the migration file above. Three policies cover the operations needed through Step 5:
- **SELECT** — read own movements (history timeline)
- **INSERT** — create own movements (log screen)
- **DELETE** — remove own movements (undo in Step 5)

---

## Supabase client setup

### Install dependencies

```bash
bun add @supabase/supabase-js @supabase/ssr
```

### Browser client (`src/lib/supabase/client.ts`)

For use in Client Components:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Server client (`src/lib/supabase/server.ts`)

For use in Server Components, Server Actions, and Route Handlers:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore
            // because proxy.ts handles session refresh.
          }
        },
      },
    }
  );
}
```

**Why the `try/catch` in `setAll`?** Server Components are read-only — they can't set cookies. The `setAll` will throw when called from a Server Component context. This is expected and safe because `proxy.ts` handles the actual session refresh on every request.

---

## Auth flow

### Proxy (`src/proxy.ts`)

Next.js 16 uses `proxy.ts` instead of `middleware.ts`. The exported function must be named `proxy`. It runs on every matched request and refreshes the Supabase session:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // CRITICAL: call getUser() immediately after creating the client.
  // Do not run any code between createServerClient and getUser().
  // This prevents users from being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Why `getUser()` and not `getSession()`?** `getUser()` validates the JWT against Supabase's auth server on every request. `getSession()` only reads the local JWT without validation — a tampered or expired token would pass. For a proxy that gates access, `getUser()` is the correct choice.

### Sign-in page (`src/app/(auth)/login/page.tsx`)

A Client Component with two states:

1. **Email input** — user enters their email, submits
2. **OTP input** — user enters the 6-digit code from their email, submits

```
State machine:
  [email_input] --submit--> signInWithOtp({ email }) --> [otp_input]
  [otp_input]   --submit--> verifyOtp({ email, token, type: 'email' }) --> redirect to /log
```

**UX details:**
- **Resend cooldown:** After sending the OTP, disable the resend button for 60 seconds (matches Supabase's default OTP expiry). Show a countdown.
- **Error messages:** Show inline errors for wrong/expired OTP codes. Supabase returns specific error codes for these cases.
- **Already authenticated:** If a logged-in user visits `/login`, redirect to `/log` immediately. Check auth state on mount using the browser Supabase client.

**Self-registration:** `signInWithOtp` auto-creates the user if they don't exist (default Supabase behavior). Step 2 intentionally allows any email to self-register. This is acceptable for the initial 1–2 user rollout. Lock down with `shouldCreateUser: false` and pre-create users in the Supabase dashboard before sharing the URL more broadly.

### Auth callback route (`src/app/(auth)/auth/confirm/route.ts`)

Handles the email confirmation redirect. Supabase sends a link with a `token_hash` and `type` parameter. This Route Handler exchanges the token for a session:

```ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "email" | "recovery" | null;
  const next = searchParams.get("next") ?? "/log";

  // Open redirect guard: only allow relative paths
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/log";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, request.url));
    }
  }

  // If verification fails, redirect to login with error
  return NextResponse.redirect(new URL("/login?error=auth", request.url));
}
```

**Why do we need this if we're using 6-digit OTP?** The 6-digit code is verified client-side via `verifyOtp`. This callback route is a fallback for if Supabase sends a magic link email instead (depends on template config). Belt and suspenders — it's a few lines and prevents a broken flow.

**Open redirect guard:** The `next` parameter is user-controlled via the URL. Without validation, an attacker could craft a link like `/auth/confirm?next=https://evil.com`. The guard ensures `next` is a relative path (starts with `/`, doesn't start with `//`).

### Sign-out action (`src/app/(auth)/login/actions.ts`)

A minimal Server Action for signing out:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

This is called from a sign-out button. No UI polish needed in Step 2 — a simple text button in the nav bar or a temporary dev-only button is sufficient. The primary purpose is enabling the RLS smoke test (sign in as user A, sign out, sign in as user B, verify data isolation).

### Route group for auth pages (`src/app/(auth)/`)

The login page should not show the app's NavBar. Use a Next.js route group to give auth pages their own layout:

```
src/app/
  (auth)/
    login/
      page.tsx            # Sign-in page (Client Component)
      actions.ts          # Sign-out action
    auth/
      confirm/
        route.ts          # Auth callback
    layout.tsx            # Auth layout — no NavBar, centered content
  (app)/
    log/
      actions.ts
      page.tsx
    history/
      page.tsx
    components/
      nav-bar.tsx
    layout.tsx            # App layout — includes NavBar
  layout.tsx              # Root layout — shared html/body, font, globals.css
  page.tsx                # Redirect to /log
```

The root `layout.tsx` keeps the shared shell (html, body, font, globals.css). The `(app)/layout.tsx` adds the NavBar. The `(auth)/layout.tsx` provides a centered layout without navigation — just the login form.

---

## Service layer migration

### `src/lib/movements.ts`

Replace the SQLite-based `createMovement` with a Supabase version:

```ts
import { createClient } from "@/lib/supabase/server";

export async function createMovement(
  intensity: string
): Promise<{ id: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("movements")
    .insert({ intensity, user_id: user.id })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id };
}
```

**Key changes from Step 1:**
- Returns `{ id: string }` (UUID) instead of `{ id: number }` (auto-increment)
- Calls `getUser()` and passes `user_id` explicitly in the insert — makes data flow visible in the code, and the RLS `WITH CHECK` policy validates `auth.uid() = user_id` anyway
- No `nowLocalISO()` — `occurred_at` defaults to `now()` server-side
- No `db` parameter — the Supabase client is created internally
- Function is now `async` (Supabase client is async)

### `src/app/(app)/log/actions.ts`

The Server Action becomes async-aware and adds `revalidatePath`:

```ts
"use server";

import { createMovement } from "@/lib/movements";
import { revalidatePath } from "next/cache";

export async function logMovement(
  intensity: string
): Promise<{ id: string }> {
  const result = await createMovement(intensity);
  revalidatePath("/history");
  return result;
}
```

**Why `revalidatePath` instead of `refresh()`?** `refresh()` (from `next/cache`) refreshes the client-side router cache. `revalidatePath` invalidates the server-side cache for a specific path, which is the correct mechanism for Server Actions that mutate data. When the user navigates to `/history`, it will fetch fresh data.

### `src/app/(app)/log/page.tsx`

The Log page needs minimal changes:
- The return type from `logMovement` changes from `{ id: number }` to `{ id: string }`, but the page doesn't use the ID yet (that's Step 5 for undo), so no functional change needed

---

## Files to remove

| File | Reason |
|---|---|
| `src/lib/db.ts` | SQLite setup — replaced by Supabase |
| `src/lib/db.test.ts` | Tests for SQLite setup |
| `src/lib/movements.test.ts` | Tests for SQLite-based `createMovement` — replaced by new tests |

Also remove from `package.json`:
- `better-sqlite3` (dependency)
- `@types/better-sqlite3` (devDependency)
- `better-sqlite3` from `trustedDependencies`

---

## `next.config.ts` changes

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/", destination: "/log", permanent: false }];
  },
};

export default nextConfig;
```

**Removed:**
- `output: "standalone"` — not needed for Vercel (Vercel handles its own build output)
- `serverExternalPackages: ["better-sqlite3"]` — no longer using better-sqlite3

---

## Project structure after Step 2

```
src/
  app/
    (auth)/
      auth/
        confirm/
          route.ts          # NEW: auth callback for email verification
      login/
        page.tsx            # NEW: email OTP sign-in page
        actions.ts          # NEW: sign-out action
      layout.tsx            # NEW: auth layout (no NavBar)
    (app)/
      components/
        nav-bar.tsx         # UNCHANGED
      history/
        page.tsx            # UNCHANGED (still placeholder)
      log/
        actions.ts          # MODIFY: async, revalidatePath, string ID
        page.tsx            # UNCHANGED (or minimal type adjustment)
      layout.tsx            # NEW: app layout (with NavBar, extracted from root)
    favicon.ico             # UNCHANGED
    globals.css             # UNCHANGED
    layout.tsx              # MODIFY: becomes shared shell only (no NavBar)
    page.tsx                # UNCHANGED (redirect to /log)
  lib/
    supabase/
      client.ts             # NEW: browser Supabase client
      server.ts             # NEW: server Supabase client
    movements.ts            # MODIFY: Supabase instead of SQLite
  proxy.ts                  # NEW: session refresh + route protection
supabase/
  migrations/
    <timestamp>_create_movements.sql  # NEW: schema + RLS migration
  config.toml               # NEW: Supabase CLI config (generated by supabase init)
.env.local.example          # NEW: documented env var template
```

**Note:** `proxy.ts` lives at `src/proxy.ts` (inside the `src/` directory, since the project uses the `src/` directory convention).

---

## Testing

### Strategy: mock the code, smoke-test the security boundary

The testing approach splits into two concerns:

1. **Service layer correctness** — does the code call Supabase with the right arguments? Testable with mocked Supabase client in CI. Fast, no network needed.
2. **Security boundary correctness** — do RLS policies actually work? Requires real JWTs against the real Supabase instance. Tested via a repeatable `curl`-based smoke test checklist (not the Supabase dashboard, which uses the service role key and bypasses RLS).

### Unit tests (`src/lib/movements.test.ts`)

Mock the Supabase server client:

1. **`createMovement` inserts with correct intensity and user_id** — mock `getUser()` to return a user, mock `from().insert().select().single()`, verify the insert payload is `{ intensity: "mycket", user_id: "mock-uid" }`
2. **`createMovement` returns the movement ID** — mock returns `{ data: { id: "test-uuid" }, error: null }`, verify `{ id: "test-uuid" }` is returned
3. **`createMovement` throws on Supabase error** — mock returns `{ data: null, error: { message: "..." } }`, verify it throws
4. **`createMovement` throws when not authenticated** — mock `getUser()` to return `{ data: { user: null } }`, verify it throws `"Not authenticated"`

### RLS smoke test checklist

Run after deployment, using `curl` against the Supabase REST API with real user access tokens (not the service role key):

```bash
# Get these from the Supabase dashboard or by logging in via the app
SUPABASE_URL="https://<ref>.supabase.co"
ANON_KEY="<anon-key>"
USER_A_TOKEN="<access-token-for-user-A>"
USER_B_TOKEN="<access-token-for-user-B>"
```

1. **User A can insert own movement:**
   ```bash
   curl -X POST "$SUPABASE_URL/rest/v1/movements" \
     -H "apikey: $ANON_KEY" \
     -H "Authorization: Bearer $USER_A_TOKEN" \
     -H "Content-Type: application/json" \
     -H "Prefer: return=representation" \
     -d '{"intensity": "mycket", "user_id": "<user-a-id>"}'
   # Expect: 201 with the created movement
   ```

2. **User A can read own movements:**
   ```bash
   curl "$SUPABASE_URL/rest/v1/movements?select=*" \
     -H "apikey: $ANON_KEY" \
     -H "Authorization: Bearer $USER_A_TOKEN"
   # Expect: array containing user A's movements only
   ```

3. **User B gets empty results (cannot see user A's data):**
   ```bash
   curl "$SUPABASE_URL/rest/v1/movements?select=*" \
     -H "apikey: $ANON_KEY" \
     -H "Authorization: Bearer $USER_B_TOKEN"
   # Expect: empty array []
   ```

4. **User B cannot insert with user A's user_id:**
   ```bash
   curl -X POST "$SUPABASE_URL/rest/v1/movements" \
     -H "apikey: $ANON_KEY" \
     -H "Authorization: Bearer $USER_B_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"intensity": "mycket", "user_id": "<user-a-id>"}'
   # Expect: 403 or empty response (RLS blocks the insert)
   ```

5. **Unauthenticated request is rejected:**
   ```bash
   curl "$SUPABASE_URL/rest/v1/movements?select=*" \
     -H "apikey: $ANON_KEY"
   # Expect: empty array or 401 (no authenticated role)
   ```

### Auth flow — manual verification

1. Navigate to `/log` while unauthenticated → redirected to `/login`
2. Enter email → receive 6-digit OTP code via email
3. Enter wrong OTP → see error message
4. Enter correct OTP → redirected to `/log`
5. Log a movement → persisted in Supabase (verify via dashboard)
6. Sign out → redirected to `/login`
7. Sign in as a different user → cannot see first user's movements (RLS)
8. Visit `/login` while already authenticated → redirected to `/log`

### Deployment verification

1. Push to GitHub → Vercel auto-deploys
2. Visit the Vercel URL → redirected to `/login`
3. Complete auth flow → can log movements
4. Check Supabase dashboard → movements appear with correct `user_id`

---

## Decision points

### 1. `user_id` in insert: explicit vs database default

**Option A: Explicit `user_id` from `getUser()`**
```ts
const { data: { user } } = await supabase.auth.getUser();
await supabase.from("movements").insert({ intensity, user_id: user!.id });
```

**Option B: Database default with `auth.uid()`**
```sql
ALTER TABLE movements ALTER COLUMN user_id SET DEFAULT auth.uid();
```
Then the insert omits `user_id` — the database fills it in.

**Decision: Option A (explicit).** It's more readable, doesn't require schema changes, and makes the data flow visible in the code. The RLS `WITH CHECK` policy validates `auth.uid() = user_id` anyway, so a mismatched `user_id` would be rejected.

### 2. OTP type: 6-digit code vs magic link

**Decision: 6-digit code.** Configured in the Supabase dashboard (Email Templates → set to OTP instead of magic link). A 6-digit code is better UX on mobile — the user stays in the app and types the code, instead of being bounced to their email app and back. The auth callback route is kept as a fallback.

### 3. Login page: Server Component vs Client Component

**Decision: Client Component.** The login page has interactive state (email input → OTP input transition, form submission, error display, resend cooldown). This requires `useState` and event handlers. A Server Component can't handle this.

### 4. ID type: UUID vs auto-increment

**Decision: UUID.** Supabase convention. `auth.users(id)` is UUID, so `movements.user_id` must be UUID. Using UUID for `movements.id` too keeps the types consistent. The return type changes from `number` to `string` throughout.

### 5. Timestamp: `occurred_at TIMESTAMPTZ` vs `created_at TEXT`

**Decision: `occurred_at TIMESTAMPTZ`.** Postgres-native timestamp with timezone. Stores UTC internally, converts to local time via `AT TIME ZONE` in queries. No custom ISO 8601 formatting needed — `now()` handles it. The column name `occurred_at` better describes semantics (when the movement happened, not when the row was created).

### 6. Testing approach for Supabase

**Decision: Mock the code, smoke-test the security boundary.** Mocked unit tests verify the service layer calls Supabase correctly. A `curl`-based RLS smoke test checklist verifies the security boundary against the real Supabase instance with real JWTs. This avoids expensive CI integration tests while still validating the most critical concern (data isolation).

### 7. Env var naming

**Decision: Use `NEXT_PUBLIC_SUPABASE_ANON_KEY`** (not `PUBLISHABLE_KEY`). The Supabase dashboard currently labels it "anon/public key" and most existing docs/examples use `ANON_KEY`. The newer `PUBLISHABLE_KEY` name appears in some updated docs but isn't universally adopted yet. Either works — the value is the same.

### 8. Validation of intensity values

**Decision: Trust the database `CHECK` constraint.** The Step 1 log page only sends `'mycket' | 'mellan' | 'lite'` from hardcoded button values. The database `CHECK` constraint is the authoritative validation boundary. No need for duplicate validation in the service layer. If we add an API later, we validate there.

### 9. NavBar on login page

**Decision: Route groups.** Use `(auth)` and `(app)` route groups so the login page has its own layout without NavBar. This is cleaner than conditional rendering in the root layout and avoids auth checks in the layout component.

### 10. Self-registration

**Decision: Allow for now, lock down before wider rollout.** Step 2 intentionally allows any email to self-register via `signInWithOtp`. This is acceptable for the initial 1–2 user rollout. Lock down with `shouldCreateUser: false` and pre-create users in the Supabase dashboard before sharing the URL more broadly. This is an explicit risk acceptance, not a forgotten item.

### 11. Schema management

**Decision: Supabase CLI with migration files.** Schema and RLS policies are version-controlled in `supabase/migrations/`. Applied via `supabase db push`. This gives us reproducible schema, diffable changes in git, and the foundation for `supabase gen types` (TypeScript type generation) in later steps.
