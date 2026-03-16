# Step 7: Timeline polish

Detailed plan for implementing Step 7 from the implementation plan.

---

## Goal

Refine the timeline's spacing, scroll behavior, and visual cues so it feels natural and informative. After this step, the timeline communicates the rhythm of the day — entries that happened close together cluster visually, large gaps are apparent, and the user always has context about where they are in the timeline.

**Working state:** The timeline feels polished with natural spacing and clear context.

---

## Prerequisites

Steps 1-6 are complete:

- Timeline component exists (`src/app/(app)/history/timeline.tsx`) — a Client Component receiving `Movement[]` as props, rendering `<ol>` with `<li>` entries: time column (`w-14 text-lg tabular-nums`), intensity-colored dot column (`size-7` with Lucide icon + `chart-1/2/3` color tokens), and label column (`ml-4 text-xl`)
- Each dot has intensity-specific colors via a `colorMap`: `bg-chart-1/20` halo + `text-chart-1` icon for "mycket", etc.
- `DayTimeline` is an async Server Component wrapping `<Timeline>` inside `<Suspense key={selectedDay}>`, currently passes only `movements: Movement[]`
- `DayCarousel` sits above the timeline in the history page, inside `<div className="flex flex-1 flex-col pt-2">`
- `formatTime` in `src/lib/date.ts` converts UTC ISO strings to Stockholm `HH:mm`
- The scroll container is `<main className="flex flex-1 flex-col overflow-auto pb-16">` in the app layout
- Current spacing between entries is uniform `pb-8` on the label `<span>`, with connector lines (`w-px flex-1 bg-border`) filling the gap
- `intensities` in `src/lib/constants.ts` includes `icon` (Lucide component) and `color` (`"chart-1"` etc.) per intensity

This step uses:

- `cn()` from `@/lib/utils` for conditional className composition
- New date helpers added to `src/lib/date.ts`
- CSS `mask-image` for fade edges
- `IntersectionObserver` for off-screen indicators
- `scrollIntoView` for initial scroll positioning

---

## What changes from Step 6

Step 6 added the delete flow (popover + AlertDialog). Step 7 modifies only the timeline's visual presentation and scroll behavior:

1. **Proportional spacing:** Replace uniform `pb-8` with dynamic `marginTop` based on time gaps between entries
2. **Hour markers:** Interleave hour labels into the timeline using the same proportional spacing
3. **"Now" marker:** A live-updating time indicator (today only)
4. **Scroll on mount:** Auto-scroll to the "now" marker (today) or first entry (past days)
5. **Fade edges:** Gradient masks at top and bottom of the scroll area
6. **Off-screen indicators:** Sticky pills showing "X tidigare" / "X senare"

**No changes to:** service layer, server actions, database, auth, carousel, log page, popover/dialog delete flow, Sonner configuration

---

## Unified timeline items

The key architectural decision: merge movements, hour markers, and the "now" marker into a single sorted array. This avoids coordinating multiple positioning systems — every item participates in the same spacing formula.

### `TimelineItem` type

```ts
type TimelineItem =
  | { type: "movement"; data: Movement; minuteOfDay: number }
  | { type: "hour"; hour: number; minuteOfDay: number }
  | { type: "now"; minuteOfDay: number };
```

Every item carries `minuteOfDay` (0-1439) — the number of minutes since midnight in Stockholm time. This is the single value used for sorting and spacing.

### `buildTimelineItems` helper

```ts
function buildTimelineItems(
  movements: Movement[],
  isToday: boolean,
  nowMinute: number,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Add movements
  for (const m of movements) {
    items.push({
      type: "movement",
      data: m,
      minuteOfDay: minuteOfDayInStockholm(m.occurred_at),
    });
  }

  // Add hour markers for the range of activity
  // When viewing today, extend the bracket to include the "now" marker
  if (movements.length > 0) {
    const first = items[0].minuteOfDay;
    const last = items[items.length - 1].minuteOfDay;
    const bracketMin = isToday ? Math.min(first, nowMinute) : first;
    const bracketMax = isToday ? Math.max(last, nowMinute) : last;
    const startHour = Math.floor(bracketMin / 60);
    const endHour = Math.floor(bracketMax / 60) + 1;

    for (let h = startHour; h <= endHour; h++) {
      // Skip hour markers that coincide with entries (within 2 minutes)
      const hourMinute = h * 60;
      const tooClose = items.some(
        (item) => Math.abs(item.minuteOfDay - hourMinute) < 2
      );
      if (!tooClose) {
        items.push({ type: "hour", hour: h, minuteOfDay: hourMinute });
      }
    }
  }

  // Add "now" marker (today only)
  if (isToday) {
    items.push({ type: "now", minuteOfDay: nowMinute });
  }

  // Sort by minuteOfDay, with occurred_at as tiebreaker for DST fall-back stability
  items.sort((a, b) => {
    if (a.minuteOfDay !== b.minuteOfDay) return a.minuteOfDay - b.minuteOfDay;
    // Tiebreaker: movements use occurred_at (UTC), others stay in insertion order
    const aTime = a.type === "movement" ? a.data.occurred_at : "";
    const bTime = b.type === "movement" ? b.data.occurred_at : "";
    return aTime.localeCompare(bTime);
  });

  return items;
}
```

**Why skip hour markers within 2 minutes of an entry?** An hour marker at 10:00 and an entry at 10:01 would render nearly on top of each other — the min gap (32px) between them wastes space and creates visual noise. Suppressing the hour marker in this case is cleaner.

**Why derive the hour range from the data, not 0-23?** Rendering all 24 hour markers would produce a very long scrollable list for a day with, say, two entries at 08:00 and 08:30. The hour markers should bracket the activity — from the hour of the first entry to the hour after the last entry. This keeps the timeline compact.

---

## Date helper additions

### `minuteOfDayInStockholm` (`src/lib/date.ts`)

```ts
export function minuteOfDayInStockholm(isoString: string): number {
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  return hour * 60 + minute;
}
```

Uses `Intl.DateTimeFormat` with explicit `timeZone: TZ` to extract the Stockholm-local hour and minute. Returns a value from 0 (midnight) to 1439 (23:59). This is the same timezone-safe approach used by `formatTime` and `stockholmDayRange`.

**DST fall-back limitation:** During DST fall-back (October 25 2026 in Sweden), the hour 02:00-02:59 occurs twice — once in CEST and once in CET. Two movements logged during these overlapping hours will map to the same `minuteOfDay`. The sort uses `occurred_at` (UTC) as a tiebreaker to preserve chronological order. Add a code comment documenting this limitation in the implementation.

### `nowMinuteInStockholm` (`src/lib/date.ts`)

```ts
export function nowMinuteInStockholm(): number {
  return minuteOfDayInStockholm(new Date().toISOString());
}
```

A convenience wrapper for the current time. Used by the "now" marker's state initialization and interval update.

---

## Proportional spacing

### The formula

Map the time gap between consecutive items to a pixel value using square-root interpolation with min/max clamps:

```ts
const MIN_GAP_PX = 32;
const MAX_GAP_PX = 120;
const BASELINE_MINUTES = 240; // 4 hours = maximum visual gap

function gapPx(minutesBetween: number): number {
  const t = Math.min(minutesBetween / BASELINE_MINUTES, 1); // 0..1
  return MIN_GAP_PX + Math.sqrt(t) * (MAX_GAP_PX - MIN_GAP_PX);
}
```

**Why square-root, not linear?** Linear interpolation makes a 6-hour gap look twice as large as a 3-hour gap. But for a baby movement tracker, the meaningful information is "there was a long gap" — not the precise duration. Square-root compresses large gaps more aggressively, keeping the timeline compact while still making gaps visually distinguishable. Examples:

| Gap | Linear | Square-root |
|-----|--------|-------------|
| 5 min | 34px | 45px |
| 30 min | 43px | 63px |
| 1 hour | 54px | 76px |
| 2 hours | 76px | 95px |
| 4+ hours | 120px | 120px |

**Why these constants?**
- `MIN_GAP_PX = 32` — entries happening within a minute of each other still have visible separation. On a 667px mobile viewport (minus ~100px for header/nav), this allows ~17 entries before scrolling. Generous.
- `MAX_GAP_PX = 120` — a single large gap (e.g., overnight) doesn't consume half the screen. The hour markers within the gap provide context about the duration.
- `BASELINE_MINUTES = 240` — 4 hours is the clamp point. Gaps beyond 4 hours all render at 120px. This is a reasonable heuristic: a 4-hour gap and an 8-hour gap are both "long" — the hour markers communicate the difference.

### Application

Replace the current `pb-8` spacing with `marginTop` on each `<li>`:

```tsx
{timelineItems.map((item, index) => {
  const prevMinute = index > 0 ? timelineItems[index - 1].minuteOfDay : item.minuteOfDay;
  const gap = item.minuteOfDay - prevMinute;
  const marginTop = index === 0 ? 0 : gapPx(gap);

  return (
    <li key={...} style={{ marginTop: `${marginTop}px` }}>
      {/* render based on item.type */}
    </li>
  );
})}
```

### Connector line adjustment

The current connector line (`w-px flex-1 bg-border`) stretches within the `<li>` using flexbox. With proportional spacing via `marginTop`, the connector fills the item's internal height but does not bridge the margin gap to the next item.

**Solution:** Move the connector from an inner flex child to a CSS pseudo-element that extends into the margin area:

```tsx
{/* Dot column for movement entries */}
<div
  className="relative flex flex-col items-center"
  style={!isLast ? { "--gap-to-next": `${nextMarginTop}px` } as React.CSSProperties : undefined}
>
  <span className={cn("flex size-7 items-center justify-center rounded-full border border-current/20", colorClasses.bg, colorClasses.text)}>
    {Icon ? (
      <Icon className={cn("size-4", colorClasses.text)} />
    ) : (
      <span className={cn("size-4 rounded-full", colorClasses.fill)} />
    )}
  </span>
  {!isLast && (
    <span
      className="absolute top-7 left-1/2 w-px -translate-x-1/2 bg-border"
      style={{ height: `calc(100% - 1.75rem + ${nextMarginTop}px)` }}
    />
  )}
</div>
```

The connector is positioned absolutely, starting below the dot (`top-7` = 1.75rem, the `size-7` dot height) and extending downward through the margin gap to reach the next item's dot. The `height` calculation accounts for the remaining internal height plus the next item's `marginTop`. The dot rendering preserves the existing intensity-specific colors and icons from the `colorMap`.

**Alternative simpler approach:** If the absolute positioning creates complexity, the connector can simply be `flex-1` within the `<li>` and not bridge the gap. The visual result is a dotted/interrupted line — entries are connected within the row, with a small gap between rows. This is acceptable and can be polished later. Hour markers and the "now" marker don't need connectors, so the interrupted style may actually look more intentional.

---

## Hour markers

Hour markers are visually recessive elements that provide temporal context:

```tsx
{item.type === "hour" && (
  <li className="flex items-center gap-3" style={{ marginTop: `${marginTop}px` }}>
    <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground/50">
      {`${String(item.hour).padStart(2, "0")}:00`}
    </span>
    <div className="h-px flex-1 bg-border/30" />
  </li>
)}
```

**Visual treatment:**
- Smaller text (`text-xs`) vs entry text (`text-lg`) — clearly subordinate
- Lower opacity (`text-muted-foreground/50`, `bg-border/30`) — doesn't compete with entries
- Thin horizontal line (`h-px`) instead of a dot — distinct shape language from entry markers
- The line extends across the full width — helps the eye track horizontal position

**No connector lines** connect to or from hour markers. They float between movement entries.

---

## "Now" marker

A horizontal line showing the current time, updated every 60 seconds. Only shown when viewing today.

### State and update

```tsx
const [nowMinute, setNowMinute] = useState(() => nowMinuteInStockholm());

useEffect(() => {
  if (!isToday) return;

  let interval: ReturnType<typeof setInterval> | null = null;

  // Align first tick to the next minute boundary (sub-second accuracy)
  const timeout = setTimeout(() => {
    setNowMinute(nowMinuteInStockholm());
    interval = setInterval(() => {
      setNowMinute(nowMinuteInStockholm());
    }, 60_000);
  }, 60_000 - (Date.now() % 60_000));

  return () => {
    clearTimeout(timeout);
    if (interval !== null) clearInterval(interval);
  };
}, [isToday]);
```

**Why hoist both timer handles?** The original pattern had `return () => clearInterval(interval)` inside the `setTimeout` callback — that's a nested return, not the `useEffect` cleanup function. React only calls the *outer* return. The interval would leak on unmount (e.g., navigating to a different day). Hoisting both handles into the effect scope ensures proper cleanup.

**Why `60_000 - (Date.now() % 60_000)`?** More accurate than `(60 - seconds) * 1000` because it accounts for sub-second offset. The marker aligns to within a few milliseconds of the minute boundary.

**Why `setInterval` over `requestAnimationFrame`?** The position changes at most once per minute. There's no animation to sync with — `rAF` would wake up 60 times per second for no reason.

### Visual treatment

```tsx
{item.type === "now" && (
  <li
    ref={nowRef}
    className="flex items-center gap-3"
    style={{ marginTop: `${marginTop}px` }}
  >
    <span className="w-14 shrink-0 text-xs font-medium tabular-nums text-primary">
      {formatTime(new Date().toISOString())}
    </span>
    <div className="h-0.5 flex-1 bg-primary/60" />
  </li>
)}
```

- **`text-primary`** (terracotta) makes it stand out from the `text-muted-foreground` hour markers and entry timestamps
- **`h-0.5`** (2px) — thicker than hour markers (`h-px` = 1px), thinner than entry dots
- **`bg-primary/60`** — a semi-transparent version of the primary color, distinct but not overwhelming
- **`ref={nowRef}`** — used for scroll-to-now on mount
- **No connector lines** — the "now" marker is a standalone indicator, not connected to entries

### `isToday` prop

The Timeline component needs to know whether it's displaying today's data (show "now" marker, scroll to now) or a past day (no "now" marker, scroll to first entry). This requires a new prop:

```ts
type Props = {
  movements: Movement[];
  isToday: boolean;
};
```

`DayTimeline` passes `isToday={day === todayInStockholm()}` to `<Timeline>`.

---

## Scroll on mount

### Approach: `scrollIntoView`

On mount, scroll the relevant element to the center of the viewport:

```tsx
const nowRef = useRef<HTMLLIElement>(null);
const firstEntryRef = useRef<HTMLLIElement>(null);

useEffect(() => {
  // Small delay to ensure layout is complete after hydration
  requestAnimationFrame(() => {
    const target = isToday ? nowRef.current : firstEntryRef.current;
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "instant" });
    }
  });
}, [isToday]);
```

**`behavior: "instant"`** — the user opens the page and expects to see the relevant part immediately. Smooth scrolling on mount feels like lag — the user didn't initiate a scroll action.

**`block: "center"`** — centers the target in the viewport, which is more natural than `"start"` (too high) or `"end"` (too low).

**`requestAnimationFrame` wrapper** — ensures layout is complete before measuring scroll position. Without it, `scrollIntoView` may fire before the browser has laid out the proportionally-spaced items.

**Scroll container:** `scrollIntoView` works on any element inside a scrollable ancestor. The scroll container is `<main>` (the `overflow-auto` element in the app layout). The `<Timeline>` doesn't need a ref to `<main>` — `scrollIntoView` finds the nearest scrollable ancestor automatically.

**Too few entries to scroll:** If the content is shorter than the viewport, `scrollIntoView` is a no-op. This is correct — there's nothing to scroll.

### `firstEntryRef` placement

Attach `firstEntryRef` to the first movement item (not the first hour marker):

```tsx
{item.type === "movement" && (
  <li
    ref={index === firstMovementIndex ? firstEntryRef : undefined}
    ...
  >
```

Where `firstMovementIndex` is the index of the first `"movement"` item in the sorted `timelineItems` array.

---

## Fade edges

Gradient masks at the top and bottom of the timeline that fade content into the background, providing a visual cue that more content exists above/below.

### Approach: CSS `mask-image` on a timeline wrapper

Add a wrapper `<div>` around the timeline content (inside the history page, not on `<main>`) with a conditional gradient mask:

```tsx
<div
  ref={scrollRef}
  className="flex-1 overflow-y-auto"
  style={{
    maskImage: buildMaskImage(canScrollUp, canScrollDown),
    WebkitMaskImage: buildMaskImage(canScrollUp, canScrollDown),
  }}
>
  {/* timeline items */}
</div>
```

**Wait — this changes the scroll architecture.** Currently the timeline scrolls as part of `<main>`. Adding a separate scrollable wrapper means the timeline has its own scroll context. This has implications:

**Option A: Timeline gets its own scroll container (chosen)**
Wrap the timeline content in a `div` with `overflow-y: auto` and `flex-1`. The fade mask, scroll refs, and IntersectionObserver all operate on this container. The `<main>` still scrolls for other pages, but on the history page, the timeline section handles its own scroll.

**Option B: Apply mask to `<main>`**
Use `<main>` as the scroll context and apply the mask there. But `<main>` is in the server-rendered layout — adding dynamic styles requires making it a Client Component or using a wrapper. Also, the mask would affect the carousel area above the timeline, not just the timeline.

**Decision: Option A.** A dedicated scroll container for the timeline is cleaner. The carousel (above) stays in place, and only the timeline area scrolls and fades. This also simplifies scroll-related refs since the component owns its scroll container.

### Flex chain constraints (iOS Safari fix)

When nesting a scrollable `flex-1` container inside another flex column, iOS Safari can fail to establish the inner scroll — the child doesn't shrink below its content size, so `overflow-y: auto` never activates. Two CSS fixes are required:

1. **`min-h-0`** on the `Suspense` wrapper (or the `DayTimeline` container) — overrides the implicit `min-height: auto` that prevents flex children from shrinking
2. **`shrink-0`** on the carousel wrapper — prevents the carousel from collapsing when the timeline content is large

In the history page:

```tsx
<div className='flex flex-1 flex-col pt-2'>
  <DayCarousel className="shrink-0" ... />
  <Suspense key={selectedDay} fallback={<TimelineSkeleton />}>
    <div className="flex-1 min-h-0">
      <DayTimeline day={selectedDay} />
    </div>
  </Suspense>
</div>
```

The exact placement may vary depending on whether the `min-h-0` is applied in the page or inside the `DayTimeline`/`Timeline` component. The key requirement: every flex ancestor between `<main>` and the `overflow-y-auto` scroll container must allow shrinking via `min-h-0`.

### Conditional masking

Only show fade edges when there's content to scroll to:

```ts
function buildMaskImage(canScrollUp: boolean, canScrollDown: boolean): string {
  const top = canScrollUp ? "transparent 0, black 32px" : "black 0, black 0";
  const bottom = canScrollDown
    ? "black calc(100% - 32px), transparent 100%"
    : "black 100%, black 100%";
  return `linear-gradient(to bottom, ${top}, ${bottom})`;
}
```

Track scroll state:

```tsx
const [canScrollUp, setCanScrollUp] = useState(false);
const [canScrollDown, setCanScrollDown] = useState(false);
const scrollRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;

  const update = () => {
    setCanScrollUp(el.scrollTop > 0);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  };

  update();
  el.addEventListener("scroll", update, { passive: true });
  const ro = new ResizeObserver(update);
  ro.observe(el);

  return () => {
    el.removeEventListener("scroll", update);
    ro.disconnect();
  };
}, []);
```

**`ResizeObserver`** catches cases where content height changes (e.g., after delete) without a scroll event.

**Browser support:** `mask-image` with linear gradients works in Safari iOS 15.4+ (with `-webkit-` prefix) and Chrome Android 120+. Always include both `maskImage` and `WebkitMaskImage`.

---

## Off-screen indicators

Sticky pills at the top and bottom edges showing how many movement entries are above or below the visible area.

### Approach: IntersectionObserver

Observe each movement entry (not hour markers or the "now" marker) to track visibility:

```tsx
const [aboveCount, setAboveCount] = useState(0);
const [belowCount, setBelowCount] = useState(0);
const entryRefs = useRef<Map<string, HTMLLIElement>>(new Map());

useEffect(() => {
  const container = scrollRef.current;
  if (!container) return;

  const visibleSet = new Set<string>();

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = entry.target.getAttribute("data-id")!;
        if (entry.isIntersecting) {
          visibleSet.add(id);
        } else {
          visibleSet.delete(id);
        }
      }

      // Count entries above and below the visible area
      let above = 0;
      let below = 0;
      const containerRect = container.getBoundingClientRect();

      for (const [id, ref] of entryRefs.current) {
        if (visibleSet.has(id)) continue;
        const rect = ref.getBoundingClientRect();
        if (rect.bottom < containerRect.top) above++;
        else if (rect.top > containerRect.bottom) below++;
      }

      setAboveCount(above);
      setBelowCount(below);
    },
    { root: container, threshold: 0 },
  );

  for (const [, ref] of entryRefs.current) {
    observer.observe(ref);
  }

  return () => observer.disconnect();
}, [movements]);
```

**Why IntersectionObserver, not scroll events?** IntersectionObserver is purpose-built for visibility tracking. It doesn't fire on every scroll frame — the browser batches callbacks. Observing 20-50 elements is trivially cheap. A scroll handler would need `getBoundingClientRect` on every element on every frame, causing layout thrashing.

**Why only observe movements, not hour markers?** The user cares about "how many movements am I missing" — not how many hour labels are off screen. Hour markers are decorative context.

### Rendering

```tsx
{aboveCount > 0 && (
  <div className="sticky top-0 z-10 flex justify-center py-1.5">
    <span className="rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground shadow-sm">
      {aboveCount} tidigare
    </span>
  </div>
)}

{/* Timeline items */}

{belowCount > 0 && (
  <div className="sticky bottom-0 z-10 flex justify-center py-1.5">
    <span className="rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground shadow-sm">
      {belowCount} senare
    </span>
  </div>
)}
```

**`sticky`** positioning keeps the indicators visible at the scroll edges. They sit inside the scroll container, so they scroll with the content but stick when reaching the edge.

**Swedish labels:** "tidigare" (earlier), "senare" (later).

**`shadow-sm`** gives the pill a subtle lift so it doesn't blend into the faded content behind it.

---

## Timeline component: new `isToday` prop

The `DayTimeline` Server Component currently passes only `movements` to `<Timeline>`. Step 7 adds the `isToday` prop:

```tsx
// src/app/(app)/history/day-timeline.tsx
import { getMovementsByDay } from "@/lib/movements";
import { todayInStockholm } from "@/lib/date";
import { Timeline } from "./timeline";

export default async function DayTimeline({ day }: { day: string }) {
  const movements = await getMovementsByDay(day);

  if (movements.length === 0) {
    return (
      <div className='flex flex-1 items-center justify-center'>
        <p className='text-muted-foreground'>Inga rörelser registrerade</p>
      </div>
    );
  }

  return <Timeline movements={movements} isToday={day === todayInStockholm()} />;
}
```

The only change is adding `isToday={day === todayInStockholm()}` to the `<Timeline>` props. The `todayInStockholm` import is new for this file.

---

## Project structure after Step 7

```
src/
  components/
    ui/
      alert-dialog.tsx                  # UNCHANGED (from Step 6)
      button.tsx                        # UNCHANGED
      popover.tsx                       # UNCHANGED (from Step 6)
      sonner.tsx                        # UNCHANGED (from Step 5)
  app/
    (auth)/                             # UNCHANGED
    (app)/
      components/
        nav-bar.tsx                     # UNCHANGED
      history/
        actions.ts                      # UNCHANGED (from Step 6)
        day-carousel.tsx                # UNCHANGED (from Step 4)
        day-timeline.tsx                # MODIFY: pass isToday prop to Timeline
        page.tsx                        # UNCHANGED (from Step 4)
        timeline.tsx                    # MODIFY: proportional spacing, hour markers,
                                        #   now marker, scroll, fade edges, indicators
        timeline-skeleton.tsx           # UNCHANGED (from Step 4)
      log/
        actions.ts                      # UNCHANGED
        page.tsx                        # UNCHANGED
      layout.tsx                        # UNCHANGED
    globals.css                         # UNCHANGED
    layout.tsx                          # UNCHANGED
    page.tsx                            # UNCHANGED
  lib/
    supabase/
      client.ts                         # UNCHANGED
      server.ts                         # UNCHANGED
    constants.ts                        # UNCHANGED
    date.ts                             # MODIFY: add minuteOfDayInStockholm, nowMinuteInStockholm
    date.test.ts                        # MODIFY: add tests for new helpers
    day-counts.ts                       # UNCHANGED (from Step 4)
    movements.ts                        # UNCHANGED
    movements.test.ts                   # UNCHANGED
    utils.ts                            # UNCHANGED
  proxy.ts                              # UNCHANGED
```

---

## Testing

### Unit tests: date helpers (`src/lib/date.test.ts`)

1. **`minuteOfDayInStockholm` returns correct minute for morning time** — `"2026-03-12T08:23:00Z"` (UTC) → 9:23 CET → `563`
2. **`minuteOfDayInStockholm` returns 0 for Stockholm midnight** — `"2026-03-11T23:00:00Z"` (UTC midnight in CET) → `0`
3. **`minuteOfDayInStockholm` returns 1439 for 23:59** — verify the max value
4. **`minuteOfDayInStockholm` handles DST spring-forward** — `"2026-03-29T01:30:00Z"` (UTC) → 02:30 CET or 03:30 CEST depending on exact transition time — verify correct Stockholm local result
5. **`nowMinuteInStockholm` returns a value in 0-1439 range** — basic sanity check
6. **`minuteOfDayInStockholm` DST fall-back produces stable ordering** — two UTC times during the overlapping 02:xx hour on `2026-10-25` map to the same `minuteOfDay`, but different `occurred_at` values preserve chronological sort order

### Unit tests: `buildTimelineItems` (`src/app/(app)/history/timeline.test.tsx`)

1. **Includes all movements in output** — pass 3 movements, verify all 3 appear as `type: "movement"`
2. **Adds hour markers between first and last entry** — pass movements at 08:23 and 10:45, verify hour markers at 09:00 and 10:00 appear
3. **Suppresses hour markers within 2 minutes of an entry** — pass a movement at 10:01, verify no 10:00 hour marker
4. **Adds "now" marker when isToday is true** — verify `type: "now"` item appears
5. **Does not add "now" marker when isToday is false** — verify no `type: "now"` item
6. **Items are sorted by minuteOfDay** — verify ascending order
7. **Single movement produces bracketing hour markers** — pass one movement at 08:23, verify hour markers at 08:00 and 09:00
8. **Hour bracket extends to cover now marker** — pass movements ending at 10:00 with `isToday=true` and `nowMinute` at 16:00, verify hour markers extend to 16:00 range

### Unit tests: `gapPx` spacing formula

1. **Returns MIN_GAP_PX for 0 minutes** — `gapPx(0)` → `32`
2. **Returns MAX_GAP_PX for BASELINE_MINUTES** — `gapPx(240)` → `120`
3. **Returns MAX_GAP_PX for gaps exceeding baseline** — `gapPx(600)` → `120`
4. **Returns intermediate value for 60 minutes** — `gapPx(60)` → approximately `76` (verify within range)
5. **Monotonically increasing** — `gapPx(30) < gapPx(60) < gapPx(120)`

### Component tests: Timeline (`src/app/(app)/history/timeline.test.tsx`)

Extend existing tests:

1. **Renders hour markers between entries** — pass movements spanning multiple hours, verify hour marker elements appear
2. **Renders "now" marker when isToday=true** — verify the now marker element is present
3. **Does not render "now" marker when isToday=false** — verify absence
4. **Applies proportional marginTop** — pass two movements with a known time gap, verify the second entry has a non-zero `marginTop` inline style
5. **First entry has marginTop=0** — verify no spacing above the first item

### Integration: manual E2E verification

1. Navigate to Historik for today → entries have proportional spacing (close entries cluster, distant entries spread)
2. Hour markers appear between entries where appropriate — subtle text and line, clearly subordinate to entries
3. "Now" marker visible with current time, positioned proportionally among entries
4. Wait 60 seconds → "now" marker time updates
5. Navigate to a past day → no "now" marker visible
6. On today: page auto-scrolls to center the "now" marker
7. On a past day: page auto-scrolls to center the first entry
8. Scroll down → top fade edge appears, "X tidigare" pill appears with correct count
9. Scroll up → bottom fade edge appears, "X senare" pill appears with correct count
10. Short list (2-3 entries) → no fade edges, no off-screen indicators (nothing to scroll to)
11. Delete an entry via popover/dialog → spacing recalculates, indicators update
12. Day with entries very close together (< 1 min apart) → entries use minimum spacing, still readable
13. Day with a large gap (4+ hours) → gap is clamped to max, hour markers fill the space
14. Verify on mobile: touch scroll is smooth, fade edges look correct, sticky indicators work

---

## Decision points

### 1. Spacing approach: dynamic margins vs absolute positioning

**Option A: Dynamic `marginTop` on flex items (chosen)**
Keep the `flex-col` `<ol>` layout. Compute `marginTop` per item based on the time gap to the previous item.

**Option B: Absolute positioning in a sized container**
Set `position: absolute` on each item with `top: f(minuteOfDay)`. The container height is `totalMinutes * pixelsPerMinute`.

**Decision: Option A.** Absolute positioning requires computing a container height and managing overflow manually. It also breaks the natural document flow — the popover/dialog delete flow (Step 6) and sticky indicators rely on normal flow. Dynamic margins preserve the existing layout model and compose cleanly with all existing features.

### 2. Spacing curve: linear vs square-root

**Option A: Linear interpolation**
`gap = MIN + (minutesBetween / BASELINE) * (MAX - MIN)`

**Option B: Square-root interpolation (chosen)**
`gap = MIN + sqrt(minutesBetween / BASELINE) * (MAX - MIN)`

**Decision: Option B.** Linear makes a 6-hour gap look twice as large as a 3-hour gap, but the meaningful information is just "long gap" vs "short gap." Square-root compresses large gaps more aggressively, keeping the timeline compact while still making gaps visually distinguishable. The hour markers communicate the exact duration.

### 3. Hour marker range: full day vs activity bracket

**Option A: All 24 hours**
Render hour markers from 00:00 to 23:00.

**Option B: Activity bracket (chosen)**
Only render hour markers from the hour of the first entry to the hour after the last entry.

**Decision: Option B.** Most users log movements during waking hours. Rendering 24 hour markers for a day with entries between 08:00 and 20:00 would add 12+ unnecessary markers outside the activity range, creating a long scrollable list with empty space.

### 4. Hour marker collision: suppress vs offset

**Option A: Suppress markers within 2 minutes of an entry (chosen)**
Don't render the hour marker if an entry is very close in time.

**Option B: Always render, let min-gap handle it**
Render all hour markers and let the 32px minimum gap create separation.

**Decision: Option A.** A 32px gap between an hour marker at 10:00 and an entry at 10:01 is technically visible but feels cluttered. Suppressing the marker is cleaner — the entry's own timestamp provides the time context.

### 5. Scroll container: timeline-owned vs shared `<main>`

**Option A: Timeline-owned scroll container (chosen)**
The timeline renders inside a `<div className="flex-1 overflow-y-auto">` that handles its own scroll. The carousel stays in place above it.

**Option B: Scroll as part of `<main>`**
The timeline scrolls with the rest of the page content, including the carousel.

**Decision: Option A.** A dedicated scroll container is required for:
- Fade edges (CSS `mask-image` applies to the scroll container)
- Off-screen indicators (`sticky` positioning relative to the scroll container)
- Scroll-to-now (targeting a specific scroll context)
- The carousel should remain pinned at the top while the timeline scrolls underneath

With `<main>` as the scroll container, all of these would affect or be affected by the carousel area.

### 6. "Now" marker update interval

**Option A: 60-second interval aligned to minute boundary (chosen)**
Update once per minute, aligned to the clock.

**Option B: `requestAnimationFrame`**
Update every frame (~16ms).

**Option C: 1-second interval**
Update every second.

**Decision: Option A.** The marker position changes at most once per minute (the smallest time unit in the display). `rAF` would wake 60 times per second for no visible change. 1-second updates would trigger 60 unnecessary re-renders per minute. 60-second intervals with minute-boundary alignment are sufficient and efficient.

### 7. Connector line bridging: full bridge vs interrupted

**Option A: Bridge across margin gaps**
Use absolute positioning or pseudo-elements to extend the connector line through the margin gap between items.

**Option B: Interrupted connectors (chosen for initial implementation)**
The connector line fills the `<li>` but does not bridge the margin gap. Entries have subtle visual separation.

**Decision: Option B for now.** Full bridge connectors require absolute positioning of the line with a calculated height that accounts for the dynamic margin — adding complexity for a visual detail. The interrupted style is acceptable and even intentional-looking since hour markers and the "now" marker don't have connectors. This keeps the implementation simpler. If the visual feels wrong during testing, bridging can be added as a follow-up without changing any architecture.

### 8. Fade edge size

**Decision: 32px (2rem).** Matches the minimum gap size. Large enough to be visible, small enough not to obscure content. Applied as a CSS `mask-image` gradient on the scroll container.

### 9. Off-screen indicator content

**Decision: Count only, in Swedish.** "3 tidigare" (3 earlier), "2 senare" (2 later). No entry details — just the count. The user scrolls to see the entries. The pill uses `bg-muted` with `shadow-sm` to lift it above the faded content.

### 10. `isToday` prop vs deriving from data

**Option A: Explicit `isToday` prop (chosen)**
The parent Server Component computes `isToday = day === todayInStockholm()` and passes it as a prop.

**Option B: Timeline derives `isToday` from the movements**
The timeline component calls `todayInStockholm()` internally and compares to the movements' dates.

**Decision: Option A.** The parent already knows the selected day (from `searchParams` or default). Passing it as a prop is simpler and avoids the timeline needing to parse dates to determine which day it's showing. It also makes testing easier — you control `isToday` directly in test props.
