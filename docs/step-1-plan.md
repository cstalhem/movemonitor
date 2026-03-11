# Step 1: Skeleton + Log screen + persistence

Detailed plan for implementing Step 1 from the implementation plan.

---

## Technology decisions

### Next.js 16.1 (latest stable)

- Scaffold with `bunx create-next-app@latest`
- App Router (default), TypeScript (default), Tailwind CSS (default), Turbopack (default)
- Use `src/` directory for cleaner separation from config files
- React 19.2 comes bundled

### Tailwind CSS for styling

- Included in the default create-next-app scaffold — zero setup cost
- Mobile-first by default (unprefixed styles apply to mobile, `sm:` / `md:` for larger)
- Define semantic color tokens (`primary`, `accent`, `surface`, etc.) in `tailwind.config.ts` from the start with rough placeholder colors — components use `bg-primary`, `text-accent`, etc. so the palette can be swapped in Step 9 without touching any components
- Handles safe area insets for notched phones via `env(safe-area-inset-bottom)`

No component library (shadcn/ui, Radix, etc.) — the app has ~5 components and doesn't need the abstraction.

### better-sqlite3 for the database

- Proven native Node.js addon, works with Next.js standalone output
- Chose this over `bun:sqlite` because the Docker production server runs `node server.js`, not Bun
- Add to `serverExternalPackages` in `next.config.ts` to prevent bundling issues
- Synchronous API — simple, no async wrappers needed

### Server Actions for mutations

- Recommended Next.js pattern for form-like interactions
- The log buttons call a Server Action and use the return value (the created movement ID) for undo support in Step 4
- The buttons must be in a Client Component (`"use client"`) to handle the Server Action response — build it this way from the start to avoid refactoring later
- The Server Action itself lives in a separate `actions.ts` file with `"use server"`

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
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
```

- `intensity` stored as lowercase text with a CHECK constraint
- `created_at` uses local time (single-timezone assumption per requirements)
- No migration tool — `CREATE TABLE IF NOT EXISTS` on startup is sufficient for a single table

### Connection

- Singleton via `globalThis` to survive hot module reloading in dev
- WAL mode enabled on connection (`PRAGMA journal_mode=WAL`)
- DB path from `process.env.DB_PATH`, defaulting to `./data/movemonitor.db`
- `data/` directory added to `.gitignore`

---

## Project structure

```
src/
  app/
    layout.tsx          # Root layout, viewport meta, font
    page.tsx            # Redirects to /log (or renders Log as default)
    log/
      page.tsx          # Log screen — three buttons
      actions.ts        # Server Action: createMovement(intensity)
    history/
      page.tsx          # Placeholder for now
    components/
      nav-bar.tsx       # Floating bottom navigation bar
  lib/
    db.ts               # Database singleton + schema init
```

---

## Components

### Floating nav bar (`nav-bar.tsx`)

- Fixed to the bottom of the viewport (`fixed bottom-0`)
- Two items: Log (active by default) and History
- Uses `usePathname()` from `next/navigation` to highlight the active tab
- Respects safe area insets: `pb-[env(safe-area-inset-bottom)]`
- Main content area gets bottom padding to avoid being hidden behind the bar
- This is a Client Component (`"use client"`) since it uses `usePathname`

### Log screen (`log/page.tsx`)

- Three large buttons stacked vertically, centered on screen
- Labels: "Mycket", "Mellan", "Lite"
- Each button calls the `createMovement` Server Action with the corresponding intensity
- Minimum tap target: 48px height, but designed much larger (80-120px+)
- `touch-action: manipulation` to eliminate double-tap-to-zoom delay
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
}
```

- `standalone` needed for Docker deployment (Step 8), harmless to enable now
- `serverExternalPackages` prevents webpack/turbopack from bundling the native addon

### Viewport meta

In `layout.tsx`, set `viewport-fit=cover` to enable safe area inset environment variables on iOS:

```tsx
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
```

---

## Dependencies

### Production
- `next` (16.1.x) — framework
- `react`, `react-dom` (19.2.x) — comes with Next.js
- `better-sqlite3` — SQLite driver

### Development
- `@types/better-sqlite3` — TypeScript definitions
- `vitest` — test runner
- `tailwindcss`, `postcss`, etc. — included by create-next-app
- `eslint`, `eslint-config-next` — included by create-next-app

---

## Testing

### Setup

- Vitest as the test runner — fast, native TypeScript support, works with Bun
- Add a `vitest.config.ts` at the project root
- Add `"test": "vitest"` and `"test:run": "vitest run"` to `package.json` scripts
- Tests live alongside source files as `*.test.ts` (e.g., `src/lib/db.test.ts`)

### What to test in Step 1

Using red/green TDD — write the failing test first, then implement:

1. **Database initialization** — schema creates the `movements` table on first connection
2. **Create movement** — inserting a movement with each intensity persists correctly and returns an ID
3. **Input validation** — invalid intensity values are rejected (CHECK constraint)
4. **Server Action** — `createMovement` calls the DB layer and returns the movement ID

### What NOT to test yet

- UI components (no meaningful UI logic to test in Step 1)
- React Testing Library / component tests (introduce when UI logic warrants it, likely Step 2+)
- E2E / Playwright (introduce when there's a user flow worth testing end-to-end)

---

## Decision points

### 1. `src/` directory — yes or no?

**Decision: Yes.** Keeps application code separate from config files (`next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, etc.) at the project root. Standard convention for Next.js projects.

### 2. Route structure — `/log` as a route or render at `/`?

**Decision: `/log` as the default route.** The root `/` redirects to `/log`. This gives both screens clean URLs (`/log`, `/history`) and the nav bar always maps to a route. Simple `next/navigation` redirect in the root page.

### 3. Server Actions vs Route Handlers for logging

**Decision: Server Action for Step 1.** The log button is a UI mutation with no external consumers. A Server Action keeps it simple — no need to define request/response shapes or handle HTTP methods. Route Handlers will be introduced in Step 2 for data fetching.

### 4. better-sqlite3 vs bun:sqlite

**Decision: better-sqlite3.** The Docker production image runs `node server.js` (Next.js standalone output). `bun:sqlite` only works under the Bun runtime. better-sqlite3 works in both Node and Bun, making it the safer choice.
