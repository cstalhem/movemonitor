# Step 3: Basic timeline

Detailed plan for implementing Step 3 from the implementation plan.

---

## Goal

Build the History screen with a left-aligned vertical timeline showing today's movements. After this step, the app has both its core interactions: logging movements and reviewing them.

**Working state:** User can log movements and see them on a timeline for today.

---

## What changes from Step 2

Step 2 delivered Supabase Postgres, auth, route groups, and Vercel deployment. Step 3 adds the read path:

1. **Service layer:** Add `getMovementsByDay` query to `src/lib/movements.ts`
2. **History page:** Replace placeholder with a Server Component that fetches and displays today's movements
3. **Timeline component:** New Client Component for the vertical timeline UI
4. **Timezone handling:** Day-boundary computation in TypeScript using `Intl`, passed to Supabase query builder

**No changes to:** auth, proxy, login, log page, NavBar, database schema, RLS policies, deployment config

---

## Data fetching

### Approach: TypeScript day-boundary computation + Supabase query builder

Instead of a Postgres function with `AT TIME ZONE`, we compute the Stockholm day boundaries in TypeScript using the `Intl` API and pass them as UTC ISO strings to the Supabase query builder. This keeps everything in TypeScript, gives full type inference from the query builder, and avoids a SQL migration.

The query builder produces the same half-open range scan that a Postgres function would:

```
WHERE occurred_at >= '2026-03-11T23:00:00.000Z'   -- midnight Stockholm in UTC
  AND occurred_at <  '2026-03-12T23:00:00.000Z'   -- next midnight Stockholm in UTC
```

The composite index on `(user_id, occurred_at)` is used as a tight range scan — same performance as the Postgres function approach.

### Date helpers (`src/lib/date.ts`)

```ts
const TZ = "Europe/Stockholm";

export function todayInStockholm(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function stockholmDayRange(day: string): { start: string; end: string } {
  const date = new Date(`${day}T00:00:00`);
  const next = new Date(date);
  next.setDate(next.getDate() + 1);

  const toUTC = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(d);
    // ... resolve the UTC instant for Stockholm midnight
  };

  return { start: toUTC(date), end: toUTC(next) };
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("sv-SE", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

- `todayInStockholm()` — returns `YYYY-MM-DD` for the current Stockholm date (used by History page)
- `stockholmDayRange(day)` — returns UTC ISO strings for the start/end of a Stockholm calendar day, DST-correct via `Intl`
- `formatTime()` — converts a UTC ISO string to `HH:mm` Stockholm local time (used by Timeline component)
- `sv-SE` locale gives `YYYY-MM-DD` date format and `HH:mm` time format (no AM/PM)
- Timezone is hardcoded as per the design assumption in CLAUDE.md

**Note:** The exact implementation of `stockholmDayRange` will be refined during TDD — the sketch above shows the intent. The key contract is: given a date string like `"2026-03-12"`, return the UTC instants for midnight-to-midnight in Stockholm.

### Service layer (`src/lib/movements.ts`)

Add a new function alongside the existing `createMovement`. The `Movement` type uses the `Intensity` literal union (`"mycket" | "mellan" | "lite"`) from the shared constants in `src/lib/constants.ts`:

```ts
import { type Intensity } from "./constants";
import { stockholmDayRange } from "./date";

export type Movement = {
  id: string;
  intensity: Intensity;
  occurred_at: string;
};

export async function getMovementsByDay(day: string): Promise<Movement[]> {
  const supabase = await createClient();
  const { start, end } = stockholmDayRange(day);

  const { data, error } = await supabase
    .from("movements")
    .select("id, intensity, occurred_at")
    .gte("occurred_at", start)
    .lt("occurred_at", end)
    .order("occurred_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Movement[];
}
```

- `day` is a date string like `"2026-03-12"`
- The query builder gives type inference from the generated Supabase types
- RLS handles the `user_id` filter implicitly — no need to pass `auth.uid()`
- Returns an array of movements ordered by time ascending
- The `Movement` type is exported for use in the timeline component

---

## History page

### `src/app/(app)/history/page.tsx`

A Server Component that fetches today's movements and renders the timeline:

```tsx
import { getMovementsByDay } from "@/lib/movements";
import { todayInStockholm } from "@/lib/date";
import { Timeline } from "./timeline";

export default async function HistoryPage() {
  const today = todayInStockholm();
  const movements = await getMovementsByDay(today);

  return (
    <div className="flex flex-1 flex-col px-4 pt-4">
      <h1 className="text-lg font-semibold text-text mb-4">Idag</h1>
      {movements.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-text-muted">Inga rörelser registrerade idag</p>
        </div>
      ) : (
        <Timeline movements={movements} />
      )}
    </div>
  );
}
```

**Why a Server Component?** The page displays today's data on load — no client-side interactivity needed. The Server Component queries Supabase directly via the server client (which has the user's session from the cookie). No API route, no client-side fetch, no loading state.

**Why the heading says "Idag" and not the date?** Step 3 only shows today — there's no day navigation yet (that's Step 4). A static "Idag" label is simpler and more intuitive. Step 4 replaces this with the carousel and dynamic date display.

---

## Timeline component

### `src/app/(app)/history/timeline.tsx`

A Client Component that renders the left-aligned vertical timeline:

```
┌──────────────────────────┐
│ 08:23  ● Mycket          │
│         │                │
│ 10:45  ● Mellan          │
│         │                │
│ 14:12  ● Lite            │
│         │                │
│ 16:30  ● Mycket          │
└──────────────────────────┘
```

Structure:
- Left column: timestamp (`HH:mm`)
- Center: dot/circle marker with vertical connecting line
- Right column: intensity label

**Props:**

```ts
type Props = {
  movements: Movement[];
};
```

**Implementation notes:**
- Each entry is a flex row: `[time] [dot + line] [label]`
- The vertical line connects dots using a CSS pseudo-element or a border on the dot column
- Dots can use the semantic color tokens — `bg-primary` for now, intensity-specific colors come in Step 9
- Uniform spacing between entries (no proportional spacing — that's Step 7)
- No interactivity — tapping entries does nothing (that's Step 6 for delete)
- The component uses `formatTime()` from `src/lib/date.ts` to display timestamps

**Why a Client Component?** Although the initial render could be server-side, making it a Client Component from the start avoids a refactor when Step 6 adds tap-to-delete interactivity and Step 7 adds scroll behavior. The movements data is passed as props from the Server Component parent. **Constraint:** In Step 3 the timeline is render-only — no `useState`, no client-side fetching, no event handlers. It receives data as props and renders it. The Client Component designation is purely forward-looking.

### Intensity labels

Display the Swedish labels matching the log buttons:

| Value | Display |
|---|---|
| `mycket` | Mycket |
| `mellan` | Mellan |
| `lite` | Lite |

Use a simple lookup map. Consider extracting the `intensities` constant from `src/app/(app)/log/page.tsx` to a shared location (e.g., `src/lib/constants.ts`) to avoid duplication.

---

## Project structure after Step 3

```
src/
  app/
    (auth)/                     # UNCHANGED (from Step 2)
      ...
    (app)/
      components/
        nav-bar.tsx             # UNCHANGED
      history/
        page.tsx                # MODIFY: Server Component with data fetching
        timeline.tsx            # NEW: vertical timeline Client Component
      log/
        actions.ts              # UNCHANGED
        page.tsx                # MODIFY: import intensities from shared constants
      layout.tsx                # UNCHANGED
    layout.tsx                  # UNCHANGED
    page.tsx                    # UNCHANGED
  lib/
    supabase/
      client.ts                 # UNCHANGED
      server.ts                 # UNCHANGED
    constants.ts                # NEW: shared intensity values, labels, and Intensity type
    date.ts                     # NEW: timezone-aware date/time helpers
    movements.ts                # MODIFY: add getMovementsByDay, Movement type
  proxy.ts                      # UNCHANGED
supabase/
  migrations/
    <timestamp>_create_movements.sql        # UNCHANGED (from Step 2)
```

---

## Testing

### Unit tests: service layer (`src/lib/movements.test.ts`)

Add tests for `getMovementsByDay` alongside existing `createMovement` tests:

1. **`getMovementsByDay` builds query with correct day range** — mock the Supabase query builder chain (`.from().select().gte().lt().order()`), verify `.gte()` and `.lt()` are called with the UTC boundaries from `stockholmDayRange`
2. **`getMovementsByDay` returns movements array** — mock returns `{ data: [...], error: null }`, verify the returned array matches
3. **`getMovementsByDay` returns empty array when no data** — mock returns `{ data: null, error: null }`, verify `[]` is returned
4. **`getMovementsByDay` throws on Supabase error** — mock returns `{ data: null, error: { message: "..." } }`, verify it throws

### Unit tests: date helpers (`src/lib/date.test.ts`)

1. **`todayInStockholm` returns YYYY-MM-DD format** — verify output matches `/^\d{4}-\d{2}-\d{2}$/`
2. **`formatTime` returns HH:mm format** — pass a known ISO string, verify output (e.g., `"2026-03-12T08:23:00Z"` → `"09:23"` in CET/CEST depending on date)
3. **`formatTime` handles timezone conversion** — pass a UTC midnight timestamp, verify it displays the correct Stockholm local time
4. **`formatTime` at spring-forward DST boundary** — use a frozen clock at `2026-03-29T01:30:00+01:00` (CET), verify the output is `"01:30"`. At `2026-03-29T03:00:00+02:00` (CEST, the first instant after spring-forward), verify `"03:00"` — there is no `02:xx` on this date
5. **`formatTime` at fall-back DST boundary** — use a frozen clock at `2026-10-25T02:30:00+02:00` (CEST, before fall-back) and `2026-10-25T02:30:00+01:00` (CET, after fall-back). Both render as `"02:30"` — this is a known limitation (see Decision point 7)
6. **`stockholmDayRange` returns correct UTC boundaries for a normal day** — e.g., `"2026-03-12"` → start `"2026-03-11T23:00:00.000Z"`, end `"2026-03-12T23:00:00.000Z"` (CET is UTC+1)
7. **`stockholmDayRange` handles spring-forward DST** — `"2026-03-29"` produces a 23-hour range (CET→CEST transition, start is UTC+1, end is UTC+2)
8. **`stockholmDayRange` handles fall-back DST** — `"2026-10-25"` produces a 25-hour range (CEST→CET transition, start is UTC+2, end is UTC+1)

### Unit tests: timeline component (`src/app/(app)/history/timeline.test.tsx`)

Use `// @vitest-environment jsdom` docblock at the top of this file (the global Vitest config uses `node` environment).

1. **Renders all movements** — pass 3 movements, verify 3 entries are rendered
2. **Displays formatted times** — verify each entry shows `HH:mm` time
3. **Displays intensity labels** — verify each entry shows the correct Swedish label
4. **Renders in chronological order** — verify entries appear top-to-bottom in time order

### Integration: manual E2E verification

1. Log in → navigate to Historik tab → see "Inga rörelser registrerade idag"
2. Navigate to Logga tab → tap "Mycket"
3. Navigate back to Historik → see the movement on the timeline with correct time
4. Log more movements with different intensities → all appear on the timeline in time order
5. Verify movements from previous days don't appear (if any exist)

---

## Decision points

### 1. Data fetching: Server Component vs client-side fetch

**Option A: Server Component (chosen)**
The History page is a Server Component that calls `getMovementsByDay` directly. Data is fetched on the server during rendering.

**Option B: Client Component with `useEffect` fetch**
Fetch movements client-side after mount.

**Decision: Option A.** Today's data doesn't change after the page loads (the user is on the Historik tab, not logging). Server Components avoid a loading spinner, reduce client JS, and the auth session is already available server-side. Step 4 introduces `searchParams` for day selection, which also works with Server Components via URL state.

### 2. Timezone handling: database function vs TypeScript computation

**Option A: Database function with `AT TIME ZONE`**
A Postgres function handles timezone conversion and date filtering. Called via `.rpc()`.

**Option B: TypeScript day-boundary computation + query builder (chosen)**
Compute Stockholm midnight boundaries in TypeScript using `Intl`, pass as UTC ISO strings to `.gte().lt()`.

**Decision: Option B.** For a single-client TypeScript app, the benefits of full type inference from the query builder and avoiding a SQL migration outweigh the theoretical purity of Postgres-side timezone handling. The JS `Intl` API uses the same IANA timezone database and handles DST transitions correctly. The boundary computation is thoroughly tested in `date.test.ts`.

### 3. Timeline: Client Component vs Server Component

**Option A: Client Component (chosen)**
Timeline is a Client Component that receives movements as props.

**Option B: Server Component**
Pure server-rendered HTML with no JS.

**Decision: Option A.** The timeline needs to become interactive in Steps 6 (tap-to-delete) and 7 (scroll behavior, now marker). Starting as a Client Component avoids a refactor. The performance cost is negligible — it's a small component with no heavy dependencies.

### 4. Shared intensity constants

**Option A: Extract to `src/lib/constants.ts` (chosen)**
Single source of truth for intensity values and labels. Export an `Intensity` type (`"mycket" | "mellan" | "lite"`) derived from the constant using `typeof intensities[number]["value"]`.

**Option B: Duplicate in log page and timeline**
Each component defines its own list.

**Decision: Option A.** The intensities are used in the log page buttons and the timeline labels. Extracting avoids drift. The constant is small (3 entries) and stable. The derived `Intensity` type gives compile-time safety throughout the codebase.

### 5. Empty state handling

**Option A: Inline message (chosen)**
Show "Inga rörelser registrerade idag" centered in the page.

**Option B: Illustration or graphic**
Show an empty-state illustration.

**Decision: Option A.** Simple text message. Visual polish comes in Step 9. The message is in Swedish matching the rest of the UI.

### 6. Date helper location

**Option A: `src/lib/date.ts` (chosen)**
Dedicated module for timezone-aware date/time utilities.

**Option B: Inline in the History page**
Compute today's date and format times directly in the page.

**Decision: Option A.** The date helpers are used by multiple components (History page for today's date, timeline for formatting times) and will be reused in Step 4 (carousel). A dedicated module keeps timezone logic centralized and testable.

### 7. DST fall-back duplicate times

On DST fall-back days (October 25 2026 in Sweden), the hour 02:00–02:59 occurs twice — once in CEST (+02:00) and once in CET (+01:00). Two movements logged during these overlapping hours will display the same `HH:mm` timestamp on the timeline.

**Decision: Accept as a known limitation.** The probability of a user logging baby movements at 2am during the single annual DST fall-back event is negligible. The timestamps are still stored with full UTC precision in the database — only the display is ambiguous. If this ever becomes an issue, the fix would be appending a timezone abbreviation (e.g., "02:30 CET"), but that's not worth the UI complexity now.
