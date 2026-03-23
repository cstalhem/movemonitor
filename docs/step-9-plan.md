# Step 9: Visual Polish

Detailed plan for implementing Step 9 from the implementation plan.

---

## Goal

Apply the final visual design pass so the app feels calming, friendly, and finished. The warm beige foundation stays — this step refines chart colors, adds tactile button feedback, upgrades the nav bar, adds an app title, and tightens typography/layout.

**Working state:** The app looks and feels finished — polished enough to hand to a real user.

---

## Prerequisites

Steps 1-8 are complete:

- Warm beige palette already in place (`globals.css` `:root` tokens)
- shadcn/ui semantic color tokens used throughout (`bg-primary`, `text-chart-1`, etc.)
- Log buttons use `active:scale-95` with per-intensity chart colors
- Nav bar is a fixed bottom bar with text-only tabs
- Timeline, carousel, delete flow, undo toast, PWA all working
- Geist Sans font — kept as-is

---

## What changes from Step 8

Step 8 added PWA installability. Step 9 is a visual-only pass — no new features, no data model changes, no auth changes:

1. **Chart color refinement:** Replace the brownish `chart-3` with a soft blue for "Lite" movements
2. **Spring bounce + glow on log buttons:** Replace `active:scale-95` with a spring-physics bounce-back and a brief glow on press
3. **Floating pill nav bar:** Restyle the nav bar as a floating pill with clearer active-tab indication
4. **App title on log page:** Add "MOVEMONITOR" in the email's uppercase + letter-spaced style
5. **Minor spacing/typography tightens** across the app

**No changes to:** service layer, server actions, database, auth, Supabase config, PWA manifest, email templates

---

## 1. Chart color refinement

### Problem

`chart-3` is currently `var(--muted-foreground)` = `oklch(0.5805 0.0349 51.1903)` — a brownish grey. This is too muddy next to the terracotta `chart-1` and olive `chart-2`. "Lite" movements deserve a lighter, cooler tone to create visual separation.

### Approach

Replace `--chart-3` with a soft muted blue that sits comfortably in the warm palette:

```css
/* globals.css :root */
--chart-3: oklch(0.6500 0.0800 245);
```

This is a dusty periwinkle — cool enough to distinguish from the warm browns/greens, but muted enough to not clash with the beige background. The oklch hue angle `245` is in the blue range, with low-ish chroma (`0.08`) to keep it soft.

### Files changed

- `src/app/globals.css` — update `--chart-3` value in `:root`

### What this affects

Everything that references `chart-3` automatically picks up the new color:

- **Log page:** "Lite" button (`bg-chart-3`)
- **Day carousel:** Bottom bar segment for lite movements (`bg-chart-3`), legend number (`text-chart-3`)
- **Timeline:** Lite movement dot background (`bg-chart-3/20`), icon color (`text-chart-3`), dot fill (`bg-chart-3`)

No component changes needed — it's a single token swap.

### Decision: oklch hue and chroma

**Why `245` hue?** Pure blue is `264` in oklch. Shifting toward `245` (slightly purple-leaning) makes it feel less clinical and warmer — better harmony with the beige/terracotta palette.

**Why chroma `0.08`?** This keeps it clearly blue but desaturated. The other chart colors are `0.0924` (chart-1) and `0.0481` (chart-2), so `0.08` sits between them. Going higher (e.g., `0.14`) would make it pop too much against the muted background.

**Why lightness `0.65`?** Needs to be readable as `text-chart-3` on the light background (`0.93`) and as white text on `bg-chart-3` for the log button. `0.65` provides ~4.5:1 contrast against white card background and is light enough for `text-white` to read on it.

### Verification

- Visual: check the three log buttons look like a coherent warm/neutral/cool trio
- Carousel: the three bar segments should be visually distinct
- Timeline: lite movement dots should read as "softer" than mycket/mellan

---

## 2. Spring bounce + glow on log buttons

### Problem

The current `active:scale-95` gives minimal feedback. On a mobile-first app where tapping a button is the primary interaction, the press should feel satisfying and tactile.

### Approach: CSS `linear()` spring easing + glow

Use a `linear()` easing function for a subtle spring bounce-back on release, with a brief box-shadow glow on press. Fall back to a `cubic-bezier` overshoot on browsers that don't support `linear()`.

#### Spring easing variables

Add to `:root` in `globals.css`:

```css
:root {
  /* Spring easing for button press feedback */
  --spring-easing: cubic-bezier(0.34, 1.56, 0.64, 1);
  --spring-duration: 400ms;
}

@supports (animation-timing-function: linear(0, 1)) {
  :root {
    --spring-easing: linear(
      0, 0.002, 0.008 1.2%, 0.028 2.4%, 0.065, 0.118 5.3%,
      0.225 7.9%, 0.601 16%, 0.703, 0.793, 0.865, 0.924,
      0.968 29%, 1.003 32%, 1.022, 1.035 36.5%, 1.043 39%,
      1.046 42%, 1.045 44.5%, 1.041 47.5%, 1.012 62%,
      1.003 70%, 0.998 80%, 0.999 100%
    );
    --spring-duration: 600ms;
  }
}
```

**Why `linear()` with cubic-bezier fallback?** `linear()` can express real spring physics (overshoot + oscillation). `cubic-bezier` can only do a single overshoot — less realistic but still pleasant. `linear()` has ~88% browser support; the fallback covers the rest.

**Spring character:** Peak overshoot is `1.046` (4.6% — the button grows ~4.6% past its rest size, then settles). This is subtle, iOS-level.

#### Custom Tailwind utility

```css
/* globals.css */
@utility spring-press {
  transform: scale(1);
  transition:
    transform var(--spring-duration) var(--spring-easing),
    box-shadow 400ms ease-out;
  will-change: transform;

  &:active {
    transform: scale(0.95);
    box-shadow: 0 0 12px 2px oklch(from currentColor l c h / 0.3);
    transition:
      transform 34ms ease-out,
      box-shadow 80ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &:active {
      transition: none;
      box-shadow: none;
    }
  }
}
```

**How it works:**

- **On press (`:active`):** Scale snaps to 95% in ~34ms (2 animation frames), glow appears in 80ms. The `transition` override on `:active` ensures the press is fast.
- **On release:** The outer `transition` takes over — spring easing bounces the scale back through 104.6% and settles at 100% over 600ms. The glow fades out over 400ms with `ease-out`.
- **Glow color:** `oklch(from currentColor l c h / 0.3)` derives the glow from the button's own text/background color using relative color syntax. This means each button glows in its own chart color. If `currentColor` relative syntax causes issues (browser support), fall back to `oklch(0.62 0.09 36 / 0.3)` (the primary terracotta) or use per-button custom properties.
- **Reduced motion:** Respects `prefers-reduced-motion` by disabling all animation.

**iOS `:active` caveat:** iOS Safari requires a touch event listener for `:active` to fire. The root layout's `<body>` needs an empty `onTouchStart`:

```tsx
// src/app/layout.tsx
<body onTouchStart={() => {}} className="...">
```

This is a no-op that enables `:active` styles on iOS. It's a well-known workaround — Apple has never fixed this.

#### Log button changes

In `src/app/(app)/log/page.tsx`, replace the current `transition-transform active:scale-95` with `spring-press`:

```tsx
// Before
"w-full max-w-sm touch-manipulation rounded-2xl px-6 py-6 text-xl font-semibold transition-transform active:scale-95"

// After
"w-full max-w-sm touch-manipulation rounded-2xl px-6 py-6 text-xl font-semibold spring-press"
```

### Files changed

- `src/app/globals.css` — add spring easing variables + `spring-press` utility
- `src/app/(app)/log/page.tsx` — swap `transition-transform active:scale-95` for `spring-press`
- `src/app/layout.tsx` — add `onTouchStart={() => {}}` to `<body>`

### Verification

- Press a log button → snaps down immediately (should feel instant)
- Release → bounces back with a tiny overshoot (visible if you watch closely, felt more than seen)
- Glow appears briefly around the button in its chart color
- Test with `prefers-reduced-motion: reduce` in devtools → no animation
- Test on iOS Safari → `:active` fires correctly

---

## 3. Floating pill nav bar

### Problem

The current nav bar is a full-width strip fixed to the bottom with `bg-card`. It looks like a browser toolbar rather than a polished app element. The active tab only changes text color — too subtle.

### Approach

Restyle as a floating rounded pill with:

- `mx-auto` centering with a max-width
- `rounded-full` pill shape
- Lifted off the bottom with `mb-safe` + a small margin
- Shadow for depth
- Active tab gets a pill-shaped background highlight
- Icons for each tab

#### Nav bar redesign

```tsx
// src/app/(app)/components/nav-bar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenLine, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/log", label: "Logga", icon: PenLine },
  { href: "/history", label: "Historik", icon: Clock },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-center px-6 pb-safe mb-2">
      <div className="flex gap-1 rounded-full bg-card p-1.5 shadow-lg border border-border/50">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground active:bg-muted"
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

**Key design decisions:**

- **`rounded-full` on outer container:** Creates the pill shape.
- **`p-1.5` padding + `rounded-full` on active link:** The active tab is a smaller pill inside the outer pill — a common iOS tab bar pattern.
- **`bg-primary text-primary-foreground` for active:** High contrast, clearly selected. The terracotta primary on the cream pill reads well.
- **`active:bg-muted` on inactive:** Gives press feedback on the inactive tab.
- **Icons:** `PenLine` (log/write) and `Clock` (history) from Lucide. Small (`size-4`) alongside the label.
- **`shadow-lg`:** Lifts the pill off the background. Combined with `border-border/50` for subtle definition.
- **`mb-2` + `pb-safe`:** Floats above the bottom edge. `pb-safe` handles the home indicator on notched iPhones.

#### App layout adjustment

The current `<main>` has `pb-16` to reserve space for the old full-width nav bar. With a floating pill, the bottom padding needs adjustment — the pill is shorter, so `pb-20` gives enough room for the pill + its margin + safe area:

```tsx
// src/app/(app)/layout.tsx
<main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-20">
```

The exact value may need tuning — `pb-20` (80px) should cover the pill height (~44px) + bottom margin (8px) + safe area (34px on iPhone). If the pill overlaps content, increase to `pb-24`.

### Files changed

- `src/app/(app)/components/nav-bar.tsx` — full redesign
- `src/app/(app)/layout.tsx` — adjust `pb-16` to `pb-20`

### Verification

- Nav bar floats as a centered pill with rounded ends
- Active tab has a clearly visible pill highlight
- Inactive tab shows press feedback on tap
- Icons visible next to labels
- Content doesn't hide behind the nav bar
- Safe area padding works on notched iPhones (home indicator area clear)
- Landscape mode: pill stays centered, doesn't stretch to full width

---

## 4. App title on log page

### Problem

The log page currently shows only the three buttons — no branding or context. Adding the app title gives a sense of place and ties the in-app experience to the email branding.

### Approach

Add "MOVEMONITOR" at the top of the log page, matching the email template's heading style:

From `emails/magic-link.tsx`:
```
fontSize: "20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px"
```

Translated to Tailwind:

```tsx
// src/app/(app)/log/page.tsx — inside the return, above the buttons
<h1 className="text-foreground text-xl font-bold uppercase tracking-[1.5px]">
  Movemonitor
</h1>
```

#### Log page layout adjustment

The title should be pinned near the top of the page — similar to the date label on the history page — with the buttons vertically centered in the remaining space. This means splitting the current single `<div>` into two siblings:

```tsx
// src/app/(app)/log/page.tsx
return (
  <>
    <div className="shrink-0 pt-2">
      <h1 className="text-center text-xl font-bold uppercase tracking-[1.5px] text-foreground">
        Movemonitor
      </h1>
    </div>
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
      {intensities.map(/* ... buttons ... */)}
    </div>
  </>
);
```

The title gets its own `shrink-0` container at the top (with `pt-2` matching the history page), and the buttons stay vertically centered in the remaining flexible space. This mirrors the history page's layout: fixed header region → flexible content area.

### Files changed

- `src/app/(app)/log/page.tsx` — add `<h1>` element

### Decision: `tracking-[1.5px]` vs `tracking-widest`

Tailwind's `tracking-widest` is `0.1em` = ~1.6px at 20px font size. The email uses exactly `1.5px`. Using an arbitrary value `tracking-[1.5px]` is more precise and matches the email exactly. The difference is imperceptible, but consistency with the email template is the point.

### Verification

- Title reads "MOVEMONITOR" in uppercase with visible letter spacing
- Visually matches the email heading style
- Vertically centered with the buttons as a group
- Doesn't feel cramped — enough breathing room above and below

---

## 5. Minor spacing and typography refinements

These are small tweaks identified during review. Each is low-risk and independent.

### 5a. Auth page title

The login page (`src/app/(auth)/login/page.tsx`) has its own "Movemonitor" title with different styling (`text-2xl font-bold`). Update it to match the new branded style:

```tsx
// Before
<h1 className="text-foreground mb-8 text-center text-2xl font-bold">Movemonitor</h1>

// After
<h1 className="mb-8 text-center text-xl font-bold uppercase tracking-[1.5px] text-foreground">Movemonitor</h1>
```

### 5b. Login button spring animation

Apply the same `spring-press` utility to the login/OTP submit buttons for consistency:

```tsx
// Both submit buttons in login/page.tsx
// Before
"h-12 touch-manipulation rounded-2xl px-6 text-lg font-semibold transition-transform active:scale-95"

// After
"h-12 touch-manipulation rounded-2xl px-6 text-lg font-semibold spring-press"
```

### Files changed

- `src/app/(auth)/login/page.tsx` — title style + button animation

---

## Project structure after Step 9

```
src/
  app/
    globals.css                           # MODIFY: chart-3 color, spring easing vars, spring-press utility
    layout.tsx                            # MODIFY: add onTouchStart for iOS :active
    manifest.ts                           # UNCHANGED (from Step 8)
    (auth)/
      login/
        page.tsx                          # MODIFY: title style, button animation
    (app)/
      components/
        nav-bar.tsx                       # MODIFY: floating pill redesign
      history/                            # UNCHANGED
      log/
        page.tsx                          # MODIFY: add title, spring-press on buttons
      layout.tsx                          # MODIFY: adjust bottom padding
  components/
    ui/                                   # UNCHANGED
  lib/                                    # UNCHANGED
```

---

## Testing

### Unit tests

No unit tests needed for this step. All changes are visual: CSS token values, class name swaps, and a new `<h1>` element. The existing tests verify behavior (button clicks, navigation, toast logic), not visual appearance.

### Integration: manual visual verification

**Log page:**

1. Title "MOVEMONITOR" visible in uppercase with letter spacing — matches email heading style
2. Press a button → snaps down + glow appears (fast, ~2 frames)
3. Release → springs back with subtle overshoot (watch closely: it grows slightly past rest size before settling)
4. Each button glows in its own color (terracotta, olive, blue)
5. "Lite" button is now blue instead of brown — clearly distinct from the other two
6. With `prefers-reduced-motion: reduce` → no animation, button still functions

**Nav bar:**

7. Floating pill shape — not full-width, centered horizontally
8. Rounded ends with shadow — visually lifted off the background
9. Active tab has a filled pill highlight (primary color)
10. Inactive tab shows label + icon in muted color
11. Tapping inactive tab → press feedback visible
12. Icons (pen, clock) render correctly at small size
13. Content below nav bar is not obscured — adequate bottom padding

**Carousel + timeline:**

14. Bar chart segments: three distinct colors (terracotta, olive, blue)
15. Legend numbers: matching colors for Mycket/Mellan/Lite
16. Timeline dots: lite movements show blue-tinted dot background

**Auth page:**

17. Login title matches the branded uppercase style
18. Login buttons have spring animation

**Cross-device:**

19. iPhone in standalone mode → nav pill floats above home indicator
20. Android → nav pill centered, adequate bottom margin
21. Desktop → no regressions, nav centered in wider viewport

---

## Decision points

### 1. Chart-3 color: soft blue vs other options

**Option A: Soft blue `oklch(0.65 0.08 245)` (chosen)**
Cool tone creates clear visual separation from the warm chart-1 and chart-2. Muted enough to harmonize with the beige palette.

**Option B: Soft purple `oklch(0.65 0.08 290)`**
More distinctive, but might feel out of place in a warm palette.

**Option C: Lighter warm grey `oklch(0.72 0.02 60)`**
Stays warm, but too similar to chart-2 (olive) — poor differentiation.

**Decision: Option A.** Blue is the natural complement to warm tones. Low chroma keeps it from clashing.

### 2. Button animation: CSS transitions vs JS animation library

**Option A: Pure CSS `linear()` + transitions (chosen)**
Zero runtime cost, no dependencies, graceful degradation. The `linear()` easing with `cubic-bezier` fallback covers all browsers.

**Option B: Framer Motion `useSpring`**
More control over spring parameters, but adds a JS dependency and runtime overhead for something CSS handles natively.

**Option C: CSS `@keyframes` animation**
Can express bounce, but can't differentiate press vs release timing. Transitions are more natural for interactive state changes.

**Decision: Option A.** CSS transitions with `linear()` easing are the modern, zero-cost approach. Framer Motion would be overkill for a scale + glow effect.

### 3. Nav bar: floating pill vs full-width with active indicator

**Option A: Floating pill (chosen)**
Feels more modern and app-like. The pill shape creates a contained, cohesive navigation element that floats over content. Active tab is a sub-pill — clear, unmissable.

**Option B: Full-width bar with dot/line active indicator**
Traditional mobile pattern. Less visually distinctive, but more familiar.

**Decision: Option A.** The user specifically requested a floating pill shape. It also better matches the app's rounded, friendly aesthetic.

### 4. Glow color: per-button vs uniform

**Option A: Per-button glow using relative color syntax (chosen)**
`oklch(from currentColor l c h / 0.3)` derives the glow from the button's own color. Each button glows in its chart color — terracotta, olive, blue.

**Option B: Uniform glow using `--primary`**
Simpler, but less polished. All three buttons glow the same terracotta.

**Decision: Option A if relative color syntax works cross-browser.** Fall back to Option B if it causes issues. Relative color syntax (`oklch(from ...)`) is well-supported in modern browsers (Chrome 119+, Safari 16.4+, Firefox 128+), but should be tested on actual devices.

### 5. iOS `:active` workaround: `onTouchStart` on `<body>`

**Option A: Empty `onTouchStart` on `<body>` (chosen)**
Minimal, well-documented workaround. No runtime cost — React attaches one passive listener.

**Option B: Add `touch-action: manipulation` everywhere**
Doesn't actually fix the `:active` issue — `touch-action` controls gesture behavior, not pseudo-class activation.

**Option C: Use JS `pointerdown`/`pointerup` instead of `:active`**
Works, but adds state management and complexity for something CSS should handle.

**Decision: Option A.** The standard workaround. Already used by many production apps.

### 6. Title placement: inside log page vs app layout

**Option A: Inside `log/page.tsx` (chosen)**
Only shows on the log page. History page has its own carousel header and doesn't need the branding.

**Option B: In `(app)/layout.tsx` as a shared header**
Would show on both pages. But history already has a dense top section (carousel + label) — adding a title would push content down too much.

**Decision: Option A.** The title is branding for the primary screen. History doesn't need it.

---

## Implementation order

1. **Chart color** — single token change, immediately visible across the app
2. **Spring animation** — CSS utility + log button swap, verifiable in isolation
3. **App title** — small addition, no dependencies
4. **Nav bar** — the most involved change, adjust layout padding after
5. **Auth page refinements** — last, applying patterns from steps 2-3

Each change is independently deployable and verifiable.
