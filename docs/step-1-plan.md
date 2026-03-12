# Step 1: Skeleton + Log screen + persistence

Detailed plan for implementing Step 1 from the implementation plan.

---

## Technology decisions

### Next.js 16.1 (latest stable)

- Scaffold with `bunx create-next-app@latest`
- App Router (default), TypeScript (default), Tailwind CSS (default), Turbopack (default)
- Use `src/` directory for cleaner separation from config files
- React 19.2 comes bundled

### Tailwind CSS v4 for styling

- Included in the default create-next-app scaffold — zero setup cost
- Mobile-first by default (unprefixed styles apply to mobile, `sm:` / `md:` for larger)
- Tailwind v4 uses CSS-first configuration — semantic color tokens are defined via `@theme` in `globals.css`, not in `tailwind.config.ts`
- Define semantic tokens (`--color-primary`, `--color-accent`, `--color-surface`, etc.) with placeholder values — components use `bg-primary`, `text-accent`, etc. so the palette can be swapped in Step 9 without touching any components
- Define safe area utilities via `@utility` directive (e.g., `pb-safe` for `env(safe-area-inset-bottom)`)
- Use `h-dvh` instead of `h-screen` — Safari's `100vh` is taller than the visible area; `dvh` adapts correctly

No component library (shadcn/ui, Radix, etc.) — the app has ~5 components and doesn't need the abstraction.

### better-sqlite3 for the database

- Proven native Node.js addon, works with Next.js standalone output
- Chose this over `bun:sqlite` because the Docker production server runs `node server.js`, not Bun
- Already in Next.js's default external packages list — explicit `serverExternalPackages` entry optional but recommended for clarity
- Also works identically in Vitest (Node.js runtime), unlike `bun:sqlite` which can't run in Vitest
- Synchronous API — simple, no async wrappers needed

### Server Actions for mutations

- Recommended Next.js pattern for form-like interactions
- The log buttons call a Server Action via `useTransition` — provides `isPending` to disable the button during the round-trip and prevent accidental double-logs
- The buttons must be in a Client Component (`"use client"`) to use `useTransition` and handle the Server Action response (the created movement ID, for undo support in Step 4)
- The Server Action itself lives in a separate `actions.ts` file with `"use server"` — it is a thin wrapper that delegates to the service layer in `src/lib/movements.ts`

### Data fetching strategy (affects Steps 2–3)

- **Step 2 (basic timeline):** The History screen shows today's data on load — a Server Component can query the database directly, no Route Handler needed
- **Step 3 (carousel):** Selecting a different day is a client-side interaction that needs to fetch new data dynamically — this is when Route Handlers are introduced

---

## Database

### Schema

Single table:

```sql
CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intensity TEXT NOT NULL CHECK (intensity IN ('mycket', 'mellan', 'lite')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at);
```

- `intensity` stored as lowercase text with a CHECK constraint
- `created_at` is an app-generated ISO 8601 timestamp with offset and millisecond precision (e.g., `2026-10-25T02:30:15.123+02:00`) — no `DEFAULT` clause, always provided by application code
- Local time with offset preserves day-boundary query simplicity (`substr(created_at, 1, 10)`) while eliminating DST ambiguity
- Index on `created_at` for efficient day-range queries in Steps 2–3
- Schema version tracked via `PRAGMA user_version = 1` — checked on startup to detect future schema changes
- No migration tool — `CREATE TABLE IF NOT EXISTS` on startup is sufficient for a single table

### Connection

- Singleton via `globalThis` to survive hot module reloading in dev
- WAL mode enabled on connection (`PRAGMA journal_mode=WAL`)
- DB path from `process.env.DB_PATH`, defaulting to `./data/movemonitor.db`
- On startup: auto-create the parent directory if it doesn't exist, fail fast with a clear error if the path is unwritable
- `data/` directory added to `.gitignore`

### Timezone

- The app assumes a single timezone, configured via the `TZ` environment variable (e.g., `TZ=Europe/Stockholm`)
- Timestamps are generated in application code using `new Date().toISOString()`-style formatting with the local offset
- The `TZ` value must be set in the Dockerfile for production — if unset, Node.js defaults to UTC

---

## Project structure

```
src/
  app/
    layout.tsx          # Root layout, viewport meta, font
    globals.css         # Tailwind v4 @theme tokens + @utility definitions
    log/
      page.tsx          # Log screen — three buttons
      actions.ts        # Server Action: thin wrapper around service layer
    history/
      page.tsx          # Placeholder for now
    components/
      nav-bar.tsx       # Floating bottom navigation bar
  lib/
    db.ts               # Database singleton + schema init
    movements.ts        # Service layer: createMovement() and future query functions
```

---

## Components

### Floating nav bar (`nav-bar.tsx`)

- Fixed to the bottom of the viewport (`fixed bottom-0`)
- Two items: Log (active by default) and History
- Uses `usePathname()` from `next/navigation` to highlight the active tab
- Respects safe area insets via custom `pb-safe` utility
- Main content area gets bottom padding to avoid being hidden behind the bar
- This is a Client Component (`"use client"`) since it uses `usePathname`

### Log screen (`log/page.tsx`)

- Three large buttons stacked vertically, centered on screen
- Labels: "Mycket", "Mellan", "Lite"
- Each button calls the `createMovement` Server Action via `useTransition` — button disabled while `isPending` to prevent double-logs
- Client-side debounce: ignore taps within 500ms of the last successful log to prevent accidental double-taps on fast connections (a simple timestamp check in the click handler, no library needed)
- Minimum tap target: 48px height, but designed much larger (80-120px+)
- `touch-manipulation` (Tailwind v4 built-in) to eliminate double-tap-to-zoom delay
- Basic press feedback via Tailwind (`active:scale-95` or similar)
- No counters, stats, or other information on this screen

### History placeholder (`history/page.tsx`)

- Simple centered text: "Historik" or similar
- Replaced in Step 2

---

## Configuration

### next.config.ts

```ts
{
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  async redirects() {
    return [{ source: '/', destination: '/log', permanent: false }]
  },
}
```

- `standalone` needed for Docker deployment (Step 8), harmless to enable now
- `serverExternalPackages` prevents Turbopack from bundling the native addon
- Root redirect handled at config level (no component render) — more efficient than `redirect()` in a page

### Viewport meta

In `layout.tsx`, set `viewport-fit=cover` to enable safe area insets:

```tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
```

Note: `maximumScale` is intentionally omitted — pinch-to-zoom remains enabled for accessibility. The double-tap delay is eliminated by `touch-manipulation` on interactive elements instead.

---

## Dependencies

### Production
- `next` (16.1.x) — framework
- `react`, `react-dom` (19.2.x) — comes with Next.js
- `better-sqlite3` — SQLite driver

### Development
- `@types/better-sqlite3` — TypeScript definitions
- `vitest` — test runner
- `@vitejs/plugin-react` — JSX/TSX transformation for Vitest
- `vite-tsconfig-paths` — path alias resolution (`@/*`) in Vitest
- `tailwindcss`, `postcss`, etc. — included by create-next-app
- `eslint`, `eslint-config-next` — included by create-next-app

---

## Testing

### Setup

- Vitest as the test runner — fast, native TypeScript support, works with Bun
- Add a `vitest.config.mts` at the project root with `@vitejs/plugin-react` and `vite-tsconfig-paths`
- Add `"test": "vitest"` and `"test:run": "vitest run"` to `package.json` scripts
- Tests live alongside source files as `*.test.ts` (e.g., `src/lib/db.test.ts`)
- Use in-memory SQLite (`:memory:`) for test databases — fast, isolated, auto-cleaned on connection close

### What to test in Step 1

Using red/green TDD — write the failing test first, then implement:

1. **Database initialization** — schema creates the `movements` table on first connection
2. **Create movement** — inserting a movement with each intensity persists correctly and returns an ID with a valid ISO 8601 timestamp
3. **Input validation** — invalid intensity values are rejected (CHECK constraint)
4. **Service layer** — `createMovement` in `movements.ts` persists correctly and returns the movement ID
5. **Server Action** — `createMovement` action delegates to the service layer and returns the movement ID

### What NOT to test yet

- UI components (no meaningful UI logic to test in Step 1)
- React Testing Library / component tests (introduce when UI logic warrants it, likely Step 2+)
- E2E / Playwright (introduce when there's a user flow worth testing end-to-end)

---

## Decision points

### 1. `src/` directory — yes or no?

**Decision: Yes.** Keeps application code separate from config files (`next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, etc.) at the project root. Standard convention for Next.js projects.

### 2. Route structure — `/log` as a route or render at `/`?

**Decision: `/log` as the default route.** The root `/` redirects to `/log` via `redirects` in `next.config.ts` (no component render needed). Both screens have clean URLs (`/log`, `/history`) and the nav bar maps directly to routes.

### 3. Server Actions vs Route Handlers for logging

**Decision: Server Action for Step 1.** The log button is a UI mutation with no external consumers. A Server Action keeps it simple — no need to define request/response shapes or handle HTTP methods. Route Handlers will be introduced in Step 3 for data fetching (carousel day-switching).

### 4. better-sqlite3 vs bun:sqlite

**Decision: better-sqlite3.** The Docker production image runs `node server.js` (Next.js standalone output). `bun:sqlite` only works under the Bun runtime. better-sqlite3 works in both Node and Bun, and critically also works in Vitest (which runs on Node.js) — `bun:sqlite` cannot be imported in Vitest.

### 5. Tailwind v4 CSS-first config vs backwards-compatible `tailwind.config.ts`

**Decision: CSS-first.** New project, no legacy to support. Semantic tokens defined via `@theme` in `globals.css`. This is the recommended approach for Tailwind v4.

### 6. Root redirect approach

**Decision: `redirects` in `next.config.ts`.** Handles the `/` → `/log` redirect at the config level without rendering a component. Slightly more efficient and keeps the app directory clean.

### 7. `maximumScale: 1` in viewport

**Decision: No.** Pinch-to-zoom remains enabled for accessibility. The double-tap delay is eliminated by `touch-manipulation` on interactive elements, which is already in the plan. `maximumScale: 1` is not needed.

### 8. Timestamp format

**Decision: App-generated ISO 8601 with offset and milliseconds** (e.g., `2026-10-25T02:30:15.123+02:00`). Timestamps are generated in Node.js application code, not by SQLite's `datetime()` function. This preserves simple day-boundary queries (`substr(created_at, 1, 10)`) while eliminating DST ambiguity and providing millisecond precision for ordering.

### 9. Service layer

**Decision: Yes.** Business logic lives in `src/lib/movements.ts`. The Server Action in `actions.ts` is a thin wrapper. This makes the core logic testable without mocking Next.js internals and provides a clean separation that later steps (Route Handlers in Step 3, delete in Step 5) can reuse.

### 10. Tap debounce

**Decision: 500ms client-side debounce.** Two taps within 500ms are treated as accidental. Implemented as a simple timestamp check in the click handler — no external library. This works alongside `useTransition`'s `isPending` which handles the server round-trip window.
