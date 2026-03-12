# Step 2: Basic timeline

Detailed plan for implementing Step 2 from the implementation plan.

---

## Goal

Replace the History placeholder with a functional timeline showing today's movements. The page is a Server Component that queries the database directly — no Route Handlers, no client-side fetching.

**Working state:** User can log movements and see them on a timeline for today.

---

## What changes from Step 1

Step 1 delivered the database, service layer, and log screen. Step 2 adds:

1. A new query function in the service layer (`getMovementsByDay`)
2. A timeline component that renders movements vertically
3. The History page wired up as a Server Component

Additionally, Step 1's `logMovement` Server Action needs a `refresh()` call so the History page shows fresh data after logging.

No new dependencies. No new API routes.

---

## Step 1 fix: `refresh()` in Server Action

The `logMovement` Server Action in `src/app/log/actions.ts` must call `refresh()` from `next/cache` after the database insert. Without this, the Next.js client router cache can serve stale data when the user navigates to `/history` after logging a movement.

```ts
import { refresh } from "next/cache";

export async function logMovement(intensity: string): Promise<{ id: number }> {
  const result = createMovement(intensity);
  refresh();
  return result;
}
```

This is a Step 1 fix shipped as part of Step 2 — it directly affects whether the History page works correctly.

---

## Service layer additions

### `src/lib/movements.ts`

Add a query function:

```ts
export function getMovementsByDay(
  date: string, // YYYY-MM-DD
  db: Database.Database = getDb()
): Movement[] { ... }
```

- `Movement` type: `{ id: number; intensity: 'mycket' | 'mellan' | 'lite'; created_at: string }`
- Query uses a range comparison instead of `substr()` to leverage the existing index on `created_at`:
  ```sql
  SELECT * FROM movements
  WHERE created_at >= ? AND created_at < ?
  ORDER BY julianday(created_at) ASC, id ASC
  ```
  Bound with date-only prefix strings (e.g., `'2026-03-11'` and `'2026-03-12'`). SQLite's string comparison with the ISO 8601 prefix correctly captures all timestamps for that local date regardless of timezone offset.
- `ORDER BY julianday(created_at) ASC, id ASC` instead of `ORDER BY created_at ASC` — string sorting breaks on DST transition days where timestamps have mixed offsets (e.g., `+01:00` vs `+02:00`). `julianday()` correctly parses ISO 8601 with timezone offsets into comparable numeric values. `id ASC` is a tiebreaker for movements at the same instant. **Spike-tested:** verified that `julianday()` correctly parses our exact format (milliseconds + offset), returns non-null values, and produces correct chronological ordering across DST boundaries.
- Returns an empty array when no movements exist for the given date

### Type export

Define and export the `Movement` type from `movements.ts` so the timeline component can use it. This is a simple interface — no Zod or runtime validation needed for internal reads.

### Today's date helper

A `todayDateString()` function that returns `YYYY-MM-DD` for the current local date. This respects the `TZ` environment variable set in production. Lives in `movements.ts` for now to avoid premature file creation.

---

## Components

### History page (`src/app/history/page.tsx`)

A **Server Component** (no `"use client"`) that:

1. Calls `todayDateString()` to get today's date
2. Calls `getMovementsByDay(today)` to fetch today's movements
3. Passes the movements array to the timeline component
4. Shows an empty-state message if no movements exist

This is intentionally simple — the page is a thin data-fetching shell around the timeline component. No interactivity, no state.

### Timeline component (`src/app/history/timeline.tsx`)

A presentational component that renders a vertical timeline. Receives a `movements: Movement[]` prop (already sorted chronologically).

**View model:**

The component maps each `Movement` into a `TimelineEntry`:

```ts
type TimelineEntry = {
  id: number;
  timeLabel: string;        // "HH:MM" formatted
  intensityLabel: string;   // Swedish display name
  minutesSinceMidnight: number;
};
```

The `minutesSinceMidnight` field is computed from the `created_at` timestamp. In Step 2, it's only used to derive `timeLabel` — but the field exists so that Step 6 can compute proportional `top` positions without re-parsing time strings.

**DOM structure:**

The timeline uses a relative container with absolute-positioned entries:

```
<div className="relative" style={{ height }}>
  <div className="timeline-spine" />       <!-- vertical line -->
  {entries.map(entry => (
    <div style={{ top: index * ROW_GAP }}> <!-- absolute positioned -->
      <span>08:00</span>  ● Mycket
    </div>
  ))}
</div>
```

- In Step 2, `top` is computed as `index * ROW_GAP` (uniform spacing)
- In Step 6, `top` is swapped to a proportional calculation using `minutesSinceMidnight`
- The container `height` is computed from the number of entries × `ROW_GAP`
- This structure survives Steps 3–6 with only the `top` calculation changing

**Layout:**

```
┌─────────────────────────┐
│ 08:00 ─── ● Mycket      │
│                          │
│ 09:15 ─── ● Mellan      │
│                          │
│ 11:42 ─── ● Lite        │
│                          │
│ 14:30 ─── ● Mycket      │
└─────────────────────────┘
```

- A vertical line on the left side acts as the timeline spine
- Each movement is a row: timestamp on the left, dot on the spine, intensity label on the right
- Timestamps formatted as `HH:MM` (extracted from the ISO `created_at` string)

**Styling:**

- Use semantic color tokens for the dot and text (e.g., `bg-primary` for the dot, `text-text` for the label, `text-text-muted` for the timestamp)
- The intensity label uses the Swedish display names: "Mycket", "Mellan", "Lite"
- The timeline spine is a thin vertical line (`border-l` or similar)
- Keep the component server-renderable (no `"use client"`) — it's purely presentational

**This component does NOT include (yet):**

- Proportional spacing (Step 6 — swaps the `top` calculation)
- Hour markers (Step 6)
- "Now" marker (Step 6)
- Scroll behavior / centering (Step 6)
- Fade-out edges (Step 6)
- Off-screen indicators (Step 6)
- Tap-to-delete interaction (Step 5)

### Empty state

When `movements` is empty, show a centered message like "Inga rörelser idag" (No movements today). Keep it simple — just text, no illustrations.

---

## Project structure changes

```
src/
  app/
    log/
      actions.ts        # MODIFY: add refresh() call after insert
    history/
      page.tsx          # Server Component: fetch + render (REPLACE placeholder)
      timeline.tsx      # NEW: timeline presentation component
  lib/
    movements.ts        # MODIFY: add getMovementsByDay, Movement type, todayDateString
```

---

## Testing

Red/green TDD — write the failing test, then implement.

### Service layer tests (`src/lib/movements.test.ts`)

Add tests for `getMovementsByDay`:

1. **Returns movements for a specific date** — insert movements across two days, query one day, verify only that day's movements are returned in chronological order
2. **Returns empty array for a day with no movements** — query a date with no data, verify `[]`
3. **Returns movements in chronological order** — insert movements out of order for the same day, verify they come back sorted chronologically (by `julianday`, not string order)
4. **Movement type shape** — verify the returned objects have `{ id, intensity, created_at }` with correct types
5. **Mixed timezone offsets sort correctly** — insert movements with different UTC offsets on the same local date (e.g., `+01:00` and `+02:00` around a DST transition), verify `getMovementsByDay` returns them in correct chronological order via `julianday`
6. **`julianday()` handles millisecond-precision ISO strings** — insert a timestamp with `.000` fractional seconds and `+HH:MM` offset, verify it round-trips correctly through the query
7. **`todayDateString()` respects TZ** — set `process.env.TZ` to a known timezone, verify the returned date string matches expectations

### What NOT to test in Step 2

- Timeline component rendering — the logic is in the view-model transform, which is simple enough to not warrant separate testing. Visual correctness is verified in the browser.
- Empty state rendering — trivially correct from the conditional in the page component.
- React Testing Library / component tests — not yet warranted.

### Manual verification

After implementation, manually verify the `refresh()` fix: log a movement on `/log`, navigate to `/history`, confirm the new entry appears without a hard reload.

---

## Decision points

### 1. Server Component vs Client Component for History page

**Decision: Server Component.** The page only shows today's data on initial load. There's no user interaction that requires client-side state or data fetching. Route Handlers and client-side fetching are introduced in Step 3.

### 2. Uniform vs proportional timeline spacing

**Decision: Uniform spacing in Step 2.** Each movement gets the same vertical space. The DOM uses absolute positioning with `top: index * ROW_GAP` so that Step 6 only needs to swap the `top` calculation to proportional positioning using `minutesSinceMidnight`.

### 3. Timeline as Server or Client Component

**Decision: Server Component.** The timeline receives data as props and renders it — no interactivity, no hooks, no event handlers. It becomes a Client Component in Step 5 when tap-to-delete is added.

### 4. Date filtering approach

**Decision: Range query (`created_at >= ? AND created_at < ?`) with date-only prefix bounds.** This leverages the existing B-tree index on `created_at`, unlike `substr()` which forces a full table scan. SQLite string comparison with ISO 8601 prefixes correctly captures all timestamps for a local date.

### 5. Chronological ordering

**Decision: `ORDER BY julianday(created_at) ASC, id ASC`.** String-sorting ISO 8601 timestamps breaks on DST transition days where offsets differ. `julianday()` parses the offset correctly and converts to a comparable numeric value. `id ASC` tiebreaks movements at the same instant. Zero schema cost.

### 6. Time display format

**Decision: `HH:MM` (24-hour).** Extracted from the ISO `created_at` string. Consistent with Swedish conventions. No date formatting library needed.

### 7. Where to put the Movement type

**Decision: In `movements.ts`.** Canonical source for movement data. No separate `types.ts` with a single type.

### 8. Intensity display names

**Decision: Map in the timeline component.** A simple `Record<string, string>` mapping `mycket → Mycket`, `mellan → Mellan`, `lite → Lite`. Presentation concern — extract later if reused.

### 9. Timeline DOM structure

**Decision: Absolute-positioned entries in a relative container.** Uses a `TimelineEntry` view-model with `minutesSinceMidnight`. In Step 2, `top` is `index * ROW_GAP`. In Step 6, `top` swaps to a proportional calculation. This avoids reworking the DOM structure in later steps.
