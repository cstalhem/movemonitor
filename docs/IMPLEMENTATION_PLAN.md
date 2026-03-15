# Movemonitor — Implementation Plan

Each step produces a working application. Steps build on each other sequentially.

## Tech decisions

- **Hosting:** Vercel (replaces Docker self-hosting)
- **Database:** Supabase Postgres (replaces SQLite/better-sqlite3)
- **Auth:** Supabase Auth with email OTP (6-digit code)
- **Email:** Custom SMTP via Resend (Supabase built-in SMTP is demo-only, 4 emails/hour)
- **Data access:** Supabase JS client (`@supabase/ssr`) — no ORM (one-table app, codegen types suffice)
- **Session handling:** `proxy.ts` (Next.js 16 deprecates `middleware.ts`)
- **Timestamps:** `occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()` — day-boundary grouping via `AT TIME ZONE 'Europe/Stockholm'`
- **Multi-user:** RLS policies enforce `auth.uid() = user_id` at the database level

---

## Step 1: Skeleton + Log screen + persistence (DONE)

Set up the project foundation and the primary user interaction.

- Initialize Next.js 16.1 project with TypeScript, Tailwind CSS, and Bun (`src/` directory)
- Set up Vitest for TDD (red/green approach used throughout all steps)
- Define semantic Tailwind color tokens with placeholder values (swapped in Step 9)
- Set up SQLite database with better-sqlite3 (schema: id, intensity, created_at)
- Log buttons as a Client Component calling a Server Action — returns movement ID for later undo support
- Build the Log screen with three buttons: Mycket, Mellan, Lite
- Add floating action bar for navigation between Log and History screens
- History screen exists as a placeholder

> **Note:** SQLite/better-sqlite3 code from this step is replaced in Step 2.

**Working state:** User can tap a button and a movement is persisted to the database.

---

## Step 2: Supabase + auth + Vercel deployment

Replace SQLite with Supabase Postgres, add multi-user auth, and deploy to Vercel.

**Prerequisites (manual, before coding):**
- Create Supabase project
- Configure custom SMTP in Supabase dashboard (Resend, using project domain)
- Set up Vercel project linked to the repo

**Database:**
- Create `movements` table: `id UUID DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES auth.users(id)`, `intensity TEXT NOT NULL CHECK (...)`, `occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Index on `(user_id, occurred_at)`
- RLS policy: `auth.uid() = user_id` for SELECT, INSERT, DELETE

**Auth:**
- Install `@supabase/ssr`, configure Supabase client (server + browser)
- `proxy.ts` for session token refresh on every request
- Sign-in page with email OTP (Supabase `signInWithOtp`)
- Protected routes — unauthenticated users redirected to sign-in
- Configure Supabase redirect URLs (including Vercel preview deployment wildcards)

**Service layer migration:**
- Replace `better-sqlite3` calls with Supabase client queries
- Update `createMovement` to use authenticated Supabase client (user_id from session)
- Update Server Action `logMovement` to pass auth context
- Remove `src/lib/db.ts`, `better-sqlite3` dependency, `DB_PATH` env var

**Deployment:**
- Remove `output: 'standalone'` from `next.config.ts`
- Deploy to Vercel with env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Optional: GitHub Actions cron to prevent Supabase free-tier project pausing

**Tests:**
- Replace SQLite-specific tests with Supabase integration tests
- Add auth flow tests and RLS enforcement tests

**Working state:** Authenticated user can log a movement on a live Vercel URL. Data persists in Supabase with RLS enforced.

---

## Step 3: Basic timeline

Build the History screen with a timeline for today.

- History screen as a Server Component querying Supabase directly
- Build the left-aligned vertical timeline component (00:00 top, 23:59 bottom)
- Show each movement as a dot with timestamp and intensity label
- Day-boundary grouping uses `AT TIME ZONE 'Europe/Stockholm'`
- Display today's movements by default
- Show empty-state message when no movements exist

**Working state:** User can log movements and see them on a timeline for today.

---

## Step 4: Day carousel

Add the day-selection bar chart above the timeline.

- Selected day driven by `searchParams` — updates the timeline via Suspense
- Carousel summary strip: range-based fetch of 14-30 days of movement counts, seeded on initial render, prefetched at edges
- Build the horizontally scrollable stacked bar chart component
- Implement snap-to-center behavior with smooth scrolling
- Swipe animation in client state, URL updates on gesture settle
- Show selected day indicator (arrow/highlight on centered bar)
- Add legend below the bars showing per-type counts for the selected day

**Working state:** User can browse between days via the carousel and see that day's timeline.

---

## Step 5: Undo toast

Add the ability to undo an accidental log.

- Show a toast for 3 seconds after logging a movement
- Tapping undo on the toast deletes the just-logged movement (RLS-scoped)
- Delete via Supabase client (no separate Route Handler needed — RLS enforces ownership)
- Undo does not survive page refresh or navigation

**Working state:** User can undo an accidental tap within 3 seconds.

---

## Step 6: Delete flow

Add the ability to delete any movement from the timeline.

- Tapping a timeline entry opens a popover with a delete button
- Tapping delete shows a confirmation dialog
- On confirm, the movement is deleted (RLS-scoped, reuses delete pattern from Step 5)
- The bar chart, legend, and timeline update to reflect the deletion

**Working state:** User can delete any movement from the history.

---

## Step 7: Timeline polish

Refine the timeline's spacing, scroll behavior, and visual cues.

- Implement proportional spacing between entries with min/max clamps
- Position hour markers according to the same proportional logic
- On load for today: scroll to center on the current time
- On load for past days: scroll to center on the first entry
- Add a live-updating "now" marker on the timeline (today only)
- Add visual fade-out at the top and bottom edges
- Add off-screen indicators ("X earlier" / "X later") that update on scroll

**Working state:** The timeline feels polished with natural spacing and clear context.

---

## Step 8: PWA

Make the app installable on mobile home screens.

- Add web app manifest (name: "Movemonitor", standalone display mode)
- Create an app icon
- Verify install-to-home-screen flow on iOS and Android
- Install-to-home-screen only — no offline support, network required
- Verify Sonner toast positioning with iOS top safe area inset (`env(safe-area-inset-top)`); use Sonner's `mobileOffset` prop if needed

**Working state:** User can install the app to their home screen and use it without browser chrome.

---

## Step 9: Visual polish

Apply the final visual design pass.

- Replace placeholder semantic color tokens with the final warm, soft palette (soft pastels)
- Add rounded shapes and comfortable spacing
- Add button animations (pulse, ripple, or color change) on the Log screen
- Choose colors for the three bar chart segments (one per intensity type)
- Overall typography and layout refinement for mobile

> Semantic Tailwind tokens defined in Step 1 — this step only updates the token values, no component changes needed.

**Working state:** The app looks and feels finished — calming, friendly, and polished.
