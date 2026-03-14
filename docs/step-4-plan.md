# Step 4: Day carousel

Detailed plan for implementing Step 4 from the implementation plan.

---

## Goal

Add a day-selection bar chart above the timeline so the user can browse between days. After this step, the app's read path is fully navigable — the user can swipe through a summary of recent days, tap one, and see that day's movements on the timeline.

**Working state:** User can browse between days via the carousel and see that day's timeline.

---

## What changes from Step 3

Step 3 delivered the vertical timeline showing today's movements, date helpers, and `getMovementsByDay`. Step 4 adds day navigation:

1. **Service layer:** Add `getDayCounts` query — returns movement counts grouped by day and intensity for a date range
2. **History page:** Drive the selected day from `searchParams` instead of hardcoding today. Wrap the timeline in `Suspense` for instant carousel interaction.
3. **Carousel component:** New Client Component — horizontally scrollable stacked bar chart with snap-to-center
4. **Legend component:** Shows per-intensity counts for the selected day
5. **Date helpers:** Add `formatDayLabel` for displaying date headers (e.g., "Idag", "Igar", "mån 10 mar")

**No changes to:** auth, proxy, login, log page/actions, NavBar, database schema, RLS policies, deployment config, timeline component (Step 3)

---

## Data fetching

### New service layer function: `getDayCounts`

The carousel needs a lightweight summary — not full movement records, just counts per day per intensity. This is a new function in `src/lib/movements.ts`:

```ts
export type DayCount = {
  day: string;             // "2026-03-12" (Stockholm local date)
  mycket: number;
  mellan: number;
  lite: number;
};

export async function getDayCounts(
  startDay: string,
  endDay: string
): Promise<DayCount[]> {
  const supabase = await createClient();
  const { start } = stockholmDayRange(startDay);
  const { end } = stockholmDayRange(endDay);

  const { data, error } = await supabase
    .from("movements")
    .select("intensity, occurred_at")
    .gte("occurred_at", start)
    .lt("occurred_at", end)
    .order("occurred_at", { ascending: true });

  if (error) throw error;

  // Group by Stockholm local date and count intensities
  return groupByDay(data ?? [], startDay, endDay);
}
```

**Why fetch raw rows and group in TypeScript instead of a Postgres aggregate?**
- The carousel shows ~14 days. Even an active user logs ~20 movements/day — that's ~280 rows max. Negligible payload.
- Grouping in TypeScript reuses the existing `Intl`-based timezone logic from `date.ts`, avoiding a Postgres function with `AT TIME ZONE`.
- The Supabase query builder doesn't support `GROUP BY` natively — we'd need `.rpc()` with a raw SQL function, which adds a migration and loses type inference.
- If this ever becomes a performance concern (unlikely), we can add a Postgres function later.

**The `groupByDay` helper** (in `src/lib/day-counts.ts`) converts raw movement rows into `DayCount[]`:
- For each movement, compute the Stockholm local date from `occurred_at` using `Intl` with explicit `timeZone: "Europe/Stockholm"`
- Increment the matching intensity counter for that date
- Fill in zero-count entries for days with no movements (so the carousel maintains temporal rhythm — no gaps)
- Return sorted by date ascending

### Date range for initial load

The carousel initially loads **14 days centered on the selected day**. When no `?date=` param is present (the common case), the selected day is today, so the window is today minus 13 through today. When a deep-linked `?date=` falls outside this default range, the window shifts to include the selected day (e.g., 7 days before and 6 days after, or clamped to today as the upper bound).

When the user scrolls toward the left edge, additional days are prefetched in chunks of 14.

---

## History page changes

### `src/app/(app)/history/page.tsx`

The page becomes parameterized by `searchParams`:

```tsx
import { Suspense } from "react";
import { todayInStockholm, offsetDay, isValidDateString } from "@/lib/date";
import { getDayCounts } from "@/lib/movements";
import { DayCarousel } from "./day-carousel";
import { DayTimeline } from "./day-timeline";
import { TimelineSkeleton } from "./timeline-skeleton";
import { redirect } from "next/navigation";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const today = todayInStockholm();

  // Validate date param — strip invalid/future dates
  if (date !== undefined) {
    if (!isValidDateString(date) || date > today) {
      redirect("/history");
    }
  }

  const selectedDay = date ?? today;

  // Seed carousel window around selectedDay, clamped to today
  const windowEnd = today;
  const defaultStart = offsetDay(today, -13);
  const startDay = selectedDay < defaultStart
    ? offsetDay(selectedDay, -6)
    : defaultStart;
  const dayCounts = await getDayCounts(startDay, windowEnd);

  return (
    <div className="flex flex-1 flex-col">
      <DayCarousel
        dayCounts={dayCounts}
        selectedDay={selectedDay}
        today={today}
      />
      <Suspense key={selectedDay} fallback={<TimelineSkeleton />}>
        <DayTimeline day={selectedDay} />
      </Suspense>
    </div>
  );
}
```

**Key changes from Step 3:**
- `searchParams` drives `selectedDay` — defaults to today when absent
- **Date validation:** Invalid dates (malformed strings, future dates) trigger a `redirect("/history")` which strips the param and defaults to today. This is standard practice — treat bad input as absent rather than showing an error page.
- **Carousel window seeded around selected day:** When a deep-linked `?date=` is older than the default 14-day window, the window shifts to include it. This prevents a selected day with no matching bar in the carousel.
- `getDayCounts` provides the carousel data on initial server render
- The timeline is wrapped in `Suspense` with `key={selectedDay}` — changing the day triggers re-suspension with a skeleton, while the carousel stays interactive
- `DayTimeline` is a new async Server Component that fetches and renders the timeline for a given day (extracted from the Step 3 inline fetch)

**Why `Suspense` with `key`?** Without the key, React would reuse the existing timeline when the URL changes — no loading state, and stale data visible until the new fetch completes. The `key` forces React to unmount/remount, showing the skeleton immediately. This gives the carousel a snappy feel even on slow connections.

### Date validation helper (`src/lib/date.ts`)

```ts
export function isValidDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T12:00:00Z`).getTime());
}
```

Validates that the string is a well-formed `YYYY-MM-DD` and represents a real calendar date (rejects `2026-02-30`).

### `DayTimeline` — extracted Server Component

```tsx
// src/app/(app)/history/day-timeline.tsx
import { getMovementsByDay } from "@/lib/movements";
import { Timeline } from "./timeline";

export default async function DayTimeline({ day }: { day: string }) {
  const movements = await getMovementsByDay(day);

  if (movements.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-text-muted">Inga rorelser registrerade</p>
      </div>
    );
  }

  return <Timeline movements={movements} />;
}
```

This extracts the data-fetching + empty-state logic from the Step 3 history page into a Suspense-compatible async component.

---

## Carousel component

### `src/app/(app)/history/day-carousel.tsx`

A Client Component with three visual sections:

```
┌────────────────────────────────────────┐
│  ◄ swipeable stacked bar chart ►       │  ← snap-to-center, horizontal scroll
│  ▲ selected day indicator              │
├────────────────────────────────────────┤
│  tis 11 mar                            │  ← date label for selected day
├────────────────────────────────────────┤
│  Mycket: 5  Mellan: 3  Lite: 2        │  ← legend with per-intensity counts
└────────────────────────────────────────┘
```

### Bar chart strip

A horizontally scrollable container using native CSS scroll-snap:

```tsx
<div
  ref={containerRef}
  className="flex items-end overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-1 px-[calc(50%-1rem)]"
>
  <div ref={leftSentinelRef} className="shrink-0 w-px" />
  {dayCounts.map((dc) => (
    <StackedBar
      key={dc.day}
      dayCount={dc}
      isSelected={dc.day === selectedDay}
      maxTotal={maxTotal}
      className="snap-center shrink-0"
    />
  ))}
</div>
```

**Layout details:**
- `items-end` — bars grow upward from a shared baseline
- `px-[calc(50%-1rem)]` — padding on both sides so the first and last bars can center in the viewport
- `gap-1` — small gap between bars
- `snap-x snap-mandatory` — CSS scroll-snap for settling on a bar
- `scrollbar-hide` — a utility class to hide the scrollbar (added to globals.css)
- Each bar has `snap-center shrink-0` and a fixed width (e.g., `w-8`)
- Left sentinel div for IntersectionObserver-based prefetching

**Scroll-end detection:**
- Use the `scrollend` event as the primary settle signal
- **Fallback:** Add a scroll-event debounce (150ms after last scroll event) for browsers without `scrollend` support. Check for support via `"onscrollend" in window`.
- **Programmatic-scroll suppression:** A `isProgrammaticScroll` ref is set to `true` before `scrollIntoView` or `scrollLeft` adjustment, and reset after. The settle handler checks this flag and skips URL updates when set. This prevents unwanted navigation during initial mount scroll and prefetch scroll restoration.
- On settle, calculate which bar is closest to the container center
- Update the URL via `router.replace('/history?date=${day}', { scroll: false })` — `replace` (not `push`) to avoid history spam from swiping. `scroll: false` prevents the page from scrolling to the top.
- The URL change triggers a server re-render of the `DayTimeline` Suspense boundary

**Initial scroll position:**
- On mount, programmatically scroll to the selected day's bar using `scrollIntoView({ inline: 'center', behavior: 'instant' })` with the suppression flag set
- Use a `useEffect` that runs once on mount

### Individual bar (`StackedBar`)

Each bar is a vertical stack of three segments (one per intensity):

```
    ┌───┐
    │ M │  ← mycket (top)
    │   │
    ├───┤
    │mel│  ← mellan (middle)
    ├───┤
    │ L │  ← lite (bottom)
    └───┘
```

```tsx
function StackedBar({ dayCount, isSelected, maxTotal }: Props) {
  const total = dayCount.mycket + dayCount.mellan + dayCount.lite;
  const maxHeight = 64; // px — the tallest bar fills this height
  const barHeight = maxTotal > 0 ? (total / maxTotal) * maxHeight : 0;

  return (
    <div className="flex flex-col items-center gap-1 w-8">
      <div
        className="flex flex-col justify-end w-full"
        style={{ height: maxHeight }}
      >
        {total > 0 ? (
          <div
            className="flex flex-col w-full rounded-sm overflow-hidden"
            style={{ height: barHeight }}
          >
            <div className="bg-primary" style={{ flexGrow: dayCount.mycket }} />
            <div className="bg-accent" style={{ flexGrow: dayCount.mellan }} />
            <div className="bg-text-muted" style={{ flexGrow: dayCount.lite }} />
          </div>
        ) : null}
      </div>
      {/* Selected day indicator */}
      {isSelected && (
        <div className="w-1 h-1 rounded-full bg-primary" />
      )}
    </div>
  );
}
```

**Scaling:** The bar with the highest total in the loaded data always fills `maxHeight` (e.g., 64px). All other bars scale proportionally: `barHeight = (dayTotal / maxDayTotal) * maxHeight`. Within each bar, the segments use `flexGrow` with raw counts for proportional distribution of the colored sections.

**Empty days:** Zero-movement days render no visible bar — just the empty `maxHeight` container. The slot still takes up horizontal space (`w-8`), preserving temporal rhythm and keeping the snap targets evenly spaced. The selected-day indicator dot still appears.

**When bars rescale:** Prepending older days via prefetch may change `maxTotal`. All bars rescale instantly (no animation). This only happens when offscreen data loads, so the visual shift is subtle.

**Colors:** Uses existing semantic tokens. The three intensity segments use distinct colors: `bg-primary` (mycket), `bg-accent` (mellan), `bg-text-muted` (lite). Final colors come in Step 9.

### Date label

Below the bar chart, centered:

```tsx
<p className="text-center text-sm font-medium text-text">
  {formatDayLabel(selectedDay, today)}
</p>
```

`formatDayLabel` returns:
- `"Idag"` — if the day is today
- `"Igar"` — if the day is yesterday
- `"tis 11 mar"` — otherwise (short weekday + day + short month, Swedish locale)

### Legend

Below the date label:

```tsx
<div className="flex justify-center gap-4 text-xs text-text-muted">
  <span><span className="inline-block w-2 h-2 rounded-full bg-primary mr-1" />Mycket: {selectedCount.mycket}</span>
  <span><span className="inline-block w-2 h-2 rounded-full bg-accent mr-1" />Mellan: {selectedCount.mellan}</span>
  <span><span className="inline-block w-2 h-2 rounded-full bg-text-muted mr-1" />Lite: {selectedCount.lite}</span>
</div>
```

---

## Edge prefetching

When the user scrolls near the oldest loaded day, we prefetch older data. This is a client-side concern — the server provides the initial 14-day window, and the client extends it.

### State management

The carousel tracks its loaded range atomically:

```ts
const [loadedRange, setLoadedRange] = useState({
  oldest: initialOldestDay,
  newest: initialNewestDay,
});
const [dayCounts, setDayCounts] = useState(initialDayCounts);
const isFetching = useRef(false);
```

The next prefetch range is derived from `loadedRange.oldest`, not the sentinel position. This prevents edge cases where the sentinel fires multiple times for the same range.

### Approach: IntersectionObserver sentinel

Place an invisible sentinel div at the left edge (oldest days) of the bar chart. When it enters the viewport, fetch the next 14-day chunk via a client-side Supabase call.

```tsx
useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !isFetching.current) {
        isFetching.current = true;
        const newEnd = offsetDay(loadedRange.oldest, -1);
        const newStart = offsetDay(newEnd, -13);
        fetchDayCounts(newStart, newEnd)
          .then((olderDays) => {
            setDayCounts((prev) => [...olderDays, ...prev]);
            setLoadedRange((prev) => ({ ...prev, oldest: newStart }));
          })
          .catch(() => {
            // Prefetch failed — stop extending, show indicator
            // Toast notification deferred to Step 5 (see note below)
          })
          .finally(() => { isFetching.current = false; });
      }
    },
    { root: containerRef.current, rootMargin: "0px 0px 0px 200px" }
  );
  if (sentinelRef.current) observer.observe(sentinelRef.current);
  return () => observer.disconnect();
}, [loadedRange.oldest]);
```

**Key details:**
- The sentinel is at the left edge (past direction). We don't prefetch into the future — today is always the newest day.
- `rootMargin: "0px 0px 0px 200px"` triggers 200px before the sentinel is visible (left margin).
- After prepending new data, maintain scroll position (see Scroll position management below).
- Gated by `isFetching` ref to prevent duplicate requests during rapid scrolling.
- **Cancel pending settle timers** during scroll restoration to prevent spurious URL updates.

**Prefetch failure handling:** On failure, the carousel stops extending and shows a subtle visual indicator (e.g., a small dot or line at the left edge) to signal that more history exists but couldn't be loaded. A toast notification explaining the error is deferred — Step 4 does not include a toast system. **Note for the implementation plan:** The toast infrastructure from Step 5 (undo toast) should be designed to also support error notifications. When implementing the prefetch failure path in Step 4, leave a `// TODO(Step 5): show error toast` comment at the catch site.

**Client-side fetching:** The prefetch uses the browser Supabase client (`src/lib/supabase/client.ts`) directly. This is the one case where the carousel makes a client-side Supabase call. RLS still applies — the browser client uses the user's session token.

### Client-side count fetching

The `groupByDay` utility in `src/lib/day-counts.ts` is a pure function shared between:
- The server `getDayCounts` (initial render)
- The client-side `fetchDayCounts` (prefetch)

Both paths use the same range generation (`stockholmDayRange`) and date validation (`isValidDateString`). This ensures no divergence between server and client query/validation logic.

```ts
// Client-side prefetch helper (inside day-carousel.tsx or a co-located module)
async function fetchDayCounts(startDay: string, endDay: string): Promise<DayCount[]> {
  const supabase = createBrowserClient();
  const { start } = stockholmDayRange(startDay);
  const { end } = stockholmDayRange(endDay);

  const { data, error } = await supabase
    .from("movements")
    .select("intensity, occurred_at")
    .gte("occurred_at", start)
    .lt("occurred_at", end)
    .order("occurred_at", { ascending: true });

  if (error) throw error;
  return groupByDay(data ?? [], startDay, endDay);
}
```

---

## Date helpers additions

### Critical: explicit timezone in all formatting calls

All date helpers must pass `timeZone: "Europe/Stockholm"` to every `toLocaleDateString` and `Intl` call. This is a correctness requirement, not defensive coding — without it, a Vercel server in `us-east-1` or a user traveling abroad would produce wrong dates for edge cases near midnight.

### `formatDayLabel` (`src/lib/date.ts`)

```ts
export function formatDayLabel(day: string, today: string): string {
  if (day === today) return "Idag";

  const yesterday = offsetDay(today, -1);
  if (day === yesterday) return "Igar";

  const date = new Date(`${day}T12:00:00Z`);
  return date.toLocaleDateString("sv-SE", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  // e.g., "tis 11 mar"
}
```

**Note:** The `Date` constructor uses `T12:00:00Z` (UTC noon) to avoid DST ambiguity. The `timeZone: TZ` in `toLocaleDateString` ensures the formatted output reflects Stockholm's calendar date.

### `offsetDay` (`src/lib/date.ts`)

```ts
export function offsetDay(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toLocaleDateString("sv-SE", { timeZone: TZ });
}
```

Uses UTC noon and `setUTCDate` to avoid local-timezone interference. `toLocaleDateString` with `timeZone: TZ` ensures the output is a Stockholm calendar date.

### `isValidDateString` (`src/lib/date.ts`)

```ts
export function isValidDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T12:00:00Z`).getTime());
}
```

---

## Scroll position management

A critical UX detail: when new bars are prepended (from edge prefetching), the carousel must not visually jump. The user should see the same bars in the same position — the new bars are added offscreen to the left.

### Approach: `scrollLeft` adjustment

```ts
// Before state update, capture current position
const prevScrollLeft = container.scrollLeft;
const prevScrollWidth = container.scrollWidth;

// After React state update + DOM commit (in useLayoutEffect):
const addedWidth = container.scrollWidth - prevScrollWidth;
isProgrammaticScroll.current = true;
container.scrollLeft = prevScrollLeft + addedWidth;
// Reset suppression flag after browser settles
requestAnimationFrame(() => { isProgrammaticScroll.current = false; });
```

**Key details:**
- `useLayoutEffect` runs synchronously after DOM update, before the browser paints — no visible flash.
- The `isProgrammaticScroll` flag suppresses settle detection during the adjustment.
- Any pending settle timers (from the debounce fallback) are cancelled before the adjustment.

---

## Project structure after Step 4

```
src/
  app/
    (auth)/                             # UNCHANGED
      ...
    (app)/
      components/
        nav-bar.tsx                     # UNCHANGED
      history/
        page.tsx                        # MODIFY: searchParams, validation, Suspense, carousel data
        day-carousel.tsx                # NEW: carousel Client Component (bar chart + legend)
        day-timeline.tsx                # NEW: async Server Component (extracted from page)
        timeline.tsx                    # UNCHANGED (from Step 3)
        timeline-skeleton.tsx           # NEW: loading skeleton for Suspense fallback
      log/
        actions.ts                      # UNCHANGED
        page.tsx                        # UNCHANGED
      layout.tsx                        # UNCHANGED
    globals.css                         # MODIFY: add scrollbar-hide utility
    layout.tsx                          # UNCHANGED
    page.tsx                            # UNCHANGED
  lib/
    supabase/
      client.ts                         # UNCHANGED
      server.ts                         # UNCHANGED
    constants.ts                        # UNCHANGED (from Step 3)
    date.ts                             # MODIFY: add formatDayLabel, offsetDay, isValidDateString
    date.test.ts                        # MODIFY: add tests for new helpers
    day-counts.ts                       # NEW: groupByDay utility (shared between server/client)
    movements.ts                        # MODIFY: add getDayCounts
    movements.test.ts                   # MODIFY: add getDayCounts tests
  proxy.ts                              # UNCHANGED
```

---

## Testing

### Unit tests: `getDayCounts` (`src/lib/movements.test.ts`)

1. **`getDayCounts` builds query with correct date range** — mock the Supabase query builder, verify `.gte()` and `.lt()` are called with UTC boundaries spanning the full date range
2. **`getDayCounts` returns grouped counts** — mock returns rows with various intensities and dates, verify the output is correctly grouped `DayCount[]`
3. **`getDayCounts` fills zero-count days** — mock returns rows for only some days in the range, verify missing days appear with all-zero counts
4. **`getDayCounts` throws on Supabase error** — standard error handling test

### Unit tests: `groupByDay` (`src/lib/day-counts.test.ts`)

1. **Groups movements by Stockholm local date** — pass raw rows spanning multiple UTC days, verify correct grouping by Stockholm date
2. **Counts each intensity separately** — verify mycket/mellan/lite counts are correct
3. **Fills missing days with zeros** — given a range with gaps, verify all days are present in output
4. **Handles empty input** — returns all-zero entries for every day in the range
5. **Handles DST transitions** — movements near midnight during spring-forward/fall-back group to the correct Stockholm date

### Unit tests: date helpers (`src/lib/date.test.ts`)

1. **`formatDayLabel` returns "Idag" for today** — pass today's date for both arguments
2. **`formatDayLabel` returns "Igar" for yesterday** — pass yesterday as day, today as today
3. **`formatDayLabel` returns formatted date for other days** — verify Swedish short format
4. **`formatDayLabel` uses Stockholm timezone** — pass a date and mock the system timezone to something other than Stockholm, verify the output is still correct for Stockholm
5. **`offsetDay` moves forward and backward** — verify `offsetDay("2026-03-12", -1)` returns `"2026-03-11"`
6. **`offsetDay` handles month boundaries** — `offsetDay("2026-04-01", -1)` returns `"2026-03-31"`
7. **`offsetDay` handles DST spring-forward** — `offsetDay("2026-03-29", -1)` returns `"2026-03-28"` (not affected by 23-hour day)
8. **`isValidDateString` accepts valid dates** — `"2026-03-12"` → `true`
9. **`isValidDateString` rejects malformed strings** — `"not-a-date"`, `"2026-13-01"`, `"2026-02-30"` → `false`

### Unit tests: carousel component (`src/app/(app)/history/day-carousel.test.tsx`)

Use `// @vitest-environment jsdom` docblock.

1. **Renders a bar for each day in dayCounts** — pass 14 days, verify 14 bar elements
2. **Highlights the selected day** — verify the selected day's bar has the indicator dot
3. **Shows the correct date label** — verify "Idag" for today, formatted date for other days
4. **Shows the correct legend counts** — verify per-intensity counts match the selected day's data
5. **Empty day renders no visible bar segments** — pass a day with all-zero counts, verify the bar container exists (snap target) but has no colored segments
6. **Bar heights are proportional** — pass days with varying totals, verify the bar with the highest total has `maxHeight` and others scale proportionally

### Integration: manual E2E verification

1. Navigate to Historik → carousel shows 14 days of bars, today is selected and centered
2. Swipe left → carousel scrolls, a past day snaps to center, timeline updates with that day's data
3. Swipe right back to today → timeline shows today's movements
4. Select a day with no movements → empty state message shows, bar position has no visible segments
5. Scroll far left → more days load seamlessly (no jump, no gap)
6. Log a new movement → navigate to Historik → today's bar and timeline update
7. Visit `/history?date=invalid` → redirected to `/history` (param stripped)
8. Visit `/history?date=2099-01-01` → redirected to `/history` (future date stripped)
9. Visit `/history?date=2026-02-15` (old date) → carousel window includes that date, timeline shows that day's data
10. Use browser back button after swiping through several days → navigates to previous page (not previous day), confirming `router.replace` behavior

---

## Decision points

### 1. Carousel technology: native scroll-snap vs Embla

**Option A: Native CSS scroll-snap (chosen)**
`snap-x snap-mandatory` on the container, `snap-center` on each bar. Settle detection via `scrollend` event with debounce fallback.

**Option B: Embla Carousel (~6kb)**
Full-featured carousel library with mouse drag, looping, and a settle callback API.

**Decision: Option A.** This is a mobile-first app — touch scrolling with native snap is smooth and zero-cost. The `scrollend` event is supported in all modern browsers, with a 150ms debounce fallback for older browsers that lack it. We avoid a dependency and keep the bundle lean. If we later need mouse drag support for desktop, Embla is a straightforward migration.

### 2. URL state: `searchParams` vs client state

**Option A: `searchParams` (chosen)**
The selected day lives in the URL as `?date=2026-03-12`. The server re-renders the timeline on each navigation.

**Option B: Client state with `useState`**
The selected day lives in client state. The timeline fetches data client-side.

**Decision: Option A.** URL state makes the selected day shareable and bookmarkable. It also leverages Server Components — the timeline data is fetched on the server with full auth context, no client-side loading waterfall. The `Suspense` boundary makes the transition smooth. The carousel itself remains in client state for smooth scrolling — only the URL update triggers the server re-render. Use `router.replace()` (not `push()`) for swipe-driven URL updates to avoid polluting browser history.

### 3. Bar height scaling: uniform vs proportional

**Option A: Uniform height, proportional segments (simpler)**
All bars are the same height. The colored segments within each bar are proportional to each other (via `flexGrow`). A day with 2 movements looks the same height as a day with 20.

**Option B: Proportional height (chosen, more informative)**
The max bar height is a fixed pixel value (e.g., 64px). The bar with the most movements in the loaded data fills the full max height. All other bars scale proportionally: `barHeight = (dayTotal / maxDayTotal) * maxHeight`. Within each bar, the segments use `flexGrow` for proportional distribution.

Example: If `maxHeight = 100px` and the busiest visible day has 5 movements while the quietest has 1, the bars are 100px and 20px. If the busiest has 12 and the quietest has 2, the bars are 100px and ~17px. The max bar is always `maxHeight`.

When new days are loaded via prefetch, `maxDayTotal` may change and all bars rescale instantly (no animation). This only happens when offscreen data loads, so the visual shift is subtle.

**Decision: Option B.** The carousel's primary purpose is giving a visual summary of activity over time. Proportional heights let the user see at a glance which days were more active.

### 4. Empty day bar rendering

**Decision: No visible bar, but the slot takes up the same horizontal space (`w-8`).** Zero-movement days show an empty space at the bar position — no colored segments, no minimum-height placeholder bar. The selected-day indicator dot still appears if the empty day is selected. This preserves temporal rhythm (evenly spaced snap targets) while making it visually clear that no movements were logged.

### 5. Initial carousel window: 14 vs 30 days

**Option A: 14 days (chosen)**
Load 2 weeks of data on the initial server render.

**Option B: 30 days**
Load a full month.

**Decision: Option A.** 14 days is enough to give context without a large initial payload. The prefetching mechanism loads more days as the user scrolls back. Most users will primarily check the last few days. We can adjust this later based on usage patterns.

### 6. Prefetch direction: past only vs both directions

**Option A: Past only (chosen)**
The carousel extends left (into the past) as the user scrolls. Today is always the rightmost day.

**Option B: Both directions**
Allow scrolling into the future as well.

**Decision: Option A.** There's no data in the future — movements can only be logged in the present. Today is the natural right edge of the carousel.

### 7. Client-side prefetch data source: browser Supabase client vs Route Handler

**Option A: Browser Supabase client (chosen)**
The carousel fetches directly from Supabase using the browser client. Runs the same `groupByDay` logic client-side.

**Option B: Route Handler `/api/day-counts`**
A server-side endpoint returns `DayCount[]`.

**Decision: Option A.** The query is simple (select intensity + occurred_at, filter by date range), the data volume is tiny, and RLS applies through the browser client. The `groupByDay` utility, range generation, and date validation all live in one shared pure module with the same tests — no divergence between server and client paths. If we later need aggregation or complex logic, we can add a Route Handler then.

### 8. Carousel scroll restoration on prefetch

**Option A: `scrollLeft` adjustment (chosen)**
After prepending bars, measure the added scroll width and adjust `scrollLeft` to maintain visual position. Cancel pending settle timers during restoration.

**Option B: CSS `overflow-anchor`**
Use the browser's built-in scroll anchoring.

**Decision: Option A.** `overflow-anchor` works for vertical scroll but is unreliable for horizontal scroll containers with snap behavior. Manual `scrollLeft` adjustment is predictable and gives us full control. Implemented in a `useLayoutEffect` after state update, with the programmatic-scroll suppression flag to prevent spurious URL updates.

### 9. Settle detection: `scrollend` with fallback

**Decision:** Use `scrollend` as the primary settle signal. Add a 150ms debounce on the `scroll` event as a fallback for browsers without `scrollend` support. Feature-detect via `"onscrollend" in window`. Both paths feed into the same settle handler that calculates the centered bar and updates the URL.

### 10. Date param validation

**Decision: Strip invalid params via redirect.** When `?date=` is malformed, a future date, or an array, `redirect("/history")` strips it cleanly. This is standard practice — bad input is treated as absent, defaulting to today. No error page, no user-facing message. The `isValidDateString` helper validates format and calendar validity.

### 11. Timeline loading skeleton

A simple placeholder that mimics the timeline structure:

- 3-4 animated pulse bars at varying widths
- Same layout as the real timeline (left time column + center dot + right label)
- Uses Tailwind's `animate-pulse` on `bg-surface` colored blocks

This is intentionally minimal — visual polish comes in Step 9.

### 12. Timezone correctness in all date helpers

**Decision: Explicit `timeZone: "Europe/Stockholm"` everywhere.** All `toLocaleDateString`, `toLocaleTimeString`, and `Intl.DateTimeFormat` calls must pass `timeZone: TZ`. Date strings parsed with `new Date()` use `T12:00:00Z` (UTC noon) to avoid local-timezone interference. This is a correctness requirement — without it, a Vercel server in `us-east-1` or a user traveling abroad would produce wrong dates near midnight. This rule applies to both existing helpers from Step 3 and the new helpers added in Step 4.
