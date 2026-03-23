# Step 8: PWA

Detailed plan for implementing Step 8 from the implementation plan.

---

## Goal

Make the app installable on mobile home screens so it launches without browser chrome. The app should feel like a native app when opened from the home screen — full-screen, no address bar, seamless status bar integration.

**Working state:** User can install the app to their home screen and use it without browser chrome.

---

## Prerequisites

Steps 1-7 are complete:

- Root layout (`src/app/layout.tsx`) sets `viewportFit: "cover"` in the `viewport` export and uses `h-dvh` on `<body>`
- App layout (`src/app/(app)/layout.tsx`) has `<main>` with `overflow-hidden pb-16`, `<NavBar>`, and `<Toaster>` (Sonner, `position="top-center"`)
- `globals.css` defines `@utility pb-safe` using `env(safe-area-inset-bottom)` — already available but not applied to the nav bar
- `next.config.ts` redirects `/` → `/log`
- No manifest, service worker, or PWA meta tags exist yet
- App icons will be provided as assets (assumed available)

This step uses:

- `src/app/manifest.ts` — Next.js metadata route convention for the web app manifest
- Apple-specific meta tags via the `metadata` export in the root layout
- Icon assets in `public/` (provided by the user)
- `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` for standalone mode padding

---

## What changes from Step 7

Step 7 polished the timeline's spacing and scroll behavior. Step 8 is entirely additive — it adds PWA installability without modifying any existing component logic:

1. **Web app manifest:** `src/app/manifest.ts` declaring the app name, display mode, colors, and icons
2. **Apple meta tags:** `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, and `apple-touch-icon` via the root layout `metadata` export
3. **Safe area padding:** Apply `env(safe-area-inset-top)` to the app shell and `env(safe-area-inset-bottom)` to the nav bar for standalone mode
4. **Sonner toast offset:** Verify (and fix if needed) that the top-center toast doesn't overlap the iOS status bar in standalone mode
5. **Icon assets:** Place icon PNGs in `public/`

**No changes to:** service layer, server actions, database, auth, carousel, timeline, log page logic, Sonner theming

**No service worker.** Neither iOS Safari nor Android Chrome require a service worker for installability. Adding one would introduce caching complexity for zero benefit (the app requires network).

---

## Web app manifest

### Approach: `src/app/manifest.ts`

Next.js App Router supports a typed manifest route. The framework automatically adds the `<link rel="manifest">` tag to the HTML head — no manual linking needed.

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Movemonitor",
    short_name: "Movemonitor",
    description: "Spåra bebisens rörelser",
    start_url: "/log",
    display: "standalone",
    background_color: "#EDE0D0",
    theme_color: "#EDE0D0",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

**Why `id: "/"`?** Without an explicit `id`, Chromium derives app identity from `start_url`. If `start_url` ever changes in a future update, Android would treat it as a different app — silently orphaning existing installs. Setting `id: "/"` decouples identity from routing. This is a W3C spec field, supported in Next.js's `MetadataRoute.Manifest` type.

**Why `start_url: "/log"` instead of `"/"`?** The root `/` redirects to `/log` via `next.config.ts`. Starting at `/log` directly avoids a redirect on every launch.

**Why typed `manifest.ts` over static `public/manifest.json`?** Type safety via `MetadataRoute.Manifest`, consistent with App Router conventions, and Next.js handles the `<link>` tag automatically.

**`background_color` and `theme_color`:** These should approximate the app's `--background` token (`oklch(0.9359 0.0222 74.0921)` ≈ `#EDE0D0`). The `background_color` is shown as the splash screen background on Android during app load. The `theme_color` colors the Android system bar. Use the closest hex approximation — manifest files don't support oklch.

**Icon sizes:** Android Chrome requires 192x192 and 512x512 for installability. Both must be PNG.

**Maskable icon:** The third icon entry reuses the 512x512 image with `purpose: "maskable"`, telling Android it's safe to apply adaptive masks (circle, rounded square, etc.). Next.js types support `purpose` as a single keyword (`'any' | 'maskable' | 'monochrome'`), so this needs to be a separate entry rather than the space-separated `"any maskable"` syntax. Whether one image works for both depends on the artwork — maskable icons need a safe zone of padding (~20% on each side) so the mask doesn't clip important content. If the provided icon has detail near the edges, a separate maskable variant with more padding may be needed.

---

## Apple meta tags

iOS Safari doesn't fully respect the web app manifest for standalone behavior. It still relies on legacy Apple-specific meta tags. These are set via the `metadata` export in the root layout.

### Changes to `src/app/layout.tsx`

```ts
export const metadata: Metadata = {
  title: "Movemonitor",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Movemonitor",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};
```

Next.js translates this into:

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Movemonitor">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

**Why `black-translucent`?** This is the only option that makes the status bar transparent, letting the app's warm beige background show through for a seamless edge-to-edge look. The other options (`default` = white bar, `black` = black bar) create a jarring color mismatch with the beige background. The trade-off is that the status bar icons are always white on the beige background — lower contrast, but readable and consistent with how native iOS apps behave.

**`apple-touch-icon`:** iOS uses this for the home screen icon. It should be 180x180 PNG (iOS will downscale as needed). This is separate from the manifest icons — iOS ignores the manifest `icons` array for the home screen icon.

---

## Icon assets

Place the following icon files in `public/`:

| File | Size | Used by |
|------|------|---------|
| `icon-192.png` | 192x192 | Android Chrome (manifest, `purpose: "any"`) |
| `icon-512.png` | 512x512 | Android Chrome (manifest, `purpose: "any"` + `purpose: "maskable"`) |
| `apple-touch-icon.png` | 180x180 | iOS Safari (home screen icon) |

All icons should be square PNGs with no transparency (use the app's background color to fill any padding). iOS will apply its own rounded-corner mask.

**These assets are provided by the user** — the implementation assumes they exist in `public/` before testing.

---

## Safe area padding

With `black-translucent` status bar style, the app content extends behind the iOS status bar. Without padding, the top of the page content (log buttons, carousel) would be obscured by the clock and battery icons.

### Top safe area

Add a `pt-safe` utility (mirroring the existing `pb-safe`):

```css
/* globals.css */
@utility pt-safe {
  padding-top: env(safe-area-inset-top, 0px);
}
```

Apply it to the `<body>` or the `<main>` wrapper. The best placement is on `<body>` so it applies universally (auth pages, app pages):

```tsx
// src/app/layout.tsx — body element
<body className={`${geistSans.variable} bg-background text-foreground flex h-dvh flex-col pt-safe font-sans antialiased`}>
```

**Why `<body>` and not `<main>`?** The auth pages (`(auth)/`) also need safe area padding when viewed in standalone mode. Applying it to `<body>` covers all routes. The background color (`bg-background`) already extends to the full viewport, so the beige shows through the status bar area while the content is pushed down.

### Bottom safe area

The nav bar already has the `pb-safe` utility available but doesn't use it. In standalone mode on iPhones with a home indicator (no physical home button), the bottom of the nav bar can be obscured.

Apply `pb-safe` to the nav bar:

```tsx
// src/app/(app)/components/nav-bar.tsx
<nav className="... pb-safe">
```

**Note:** `pb-safe` resolves to `0` on devices without a home indicator (older iPhones, Android), so it's safe to apply unconditionally.

Also update the existing `pb-safe` utility to include the fallback value: `env(safe-area-inset-bottom, 0px)`. The fallback `0px` is technically redundant (all modern browsers set the variable), but it's defensive and costs nothing.

---

## Sonner toast positioning

The Sonner `<Toaster>` is configured with `position="top-center"`. In standalone mode with `black-translucent`, the toast will render behind the status bar because Sonner does not handle safe area insets automatically.

### How Sonner offsets work

Sonner's `mobileOffset` prop sets CSS custom properties (`--mobile-offset-top`, etc.) that control toast positioning on screens below 600px wide. The prop accepts:

- **number** — treated as pixels (e.g., `32` → `"32px"`)
- **string** — passed verbatim into the CSS variable (so `env()`, `calc()`, `var()` all work)
- **object** — `{ top?, right?, bottom?, left? }`, each `string | number`

Default mobile offset is `16px`. On desktop (≥600px), the `offset` prop applies instead (default `24px`).

### Approach: `offset` + `mobileOffset` with `calc()` + `env()`

Add safe area awareness to both the desktop and mobile offsets, preserving their respective default padding values:

```tsx
// src/components/ui/sonner.tsx
<Sonner
  position="top-center"
  offset={{ top: "calc(env(safe-area-inset-top, 0px) + 24px)" }}
  mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
  ...
/>
```

- `offset` applies on screens ≥600px (default `24px`) — covers iPads in standalone mode or split-view
- `mobileOffset` applies on screens <600px (default `16px`) — covers phones

Both set CSS custom properties (`--offset-top` / `--mobile-offset-top`) that Sonner's CSS uses for `top` positioning. On devices without a safe area inset (or in a normal browser), `env(safe-area-inset-top, 0px)` resolves to `0px`, so the result is the same as the original defaults.

**Why both `offset` and `mobileOffset`?** `mobileOffset` only applies below 600px. An iPad in standalone mode would use `offset` — without the safe area calc there, the toast would still render behind the status bar on iPads.

**Why not just `env(safe-area-inset-top, 0px)`?** Without the `+ 24px`/`+ 16px`, the toast would sit flush against the bottom of the status bar with no visual breathing room. The `calc()` expression adds the safe area inset on top of the original default padding.

**Why only `top`?** The other directions (`right`, `bottom`, `left`) don't need safe area adjustments — the toast is top-center positioned and the bottom/sides aren't affected by the status bar. Omitted keys fall back to the defaults.

### Manual verification

After deploying, verify on an actual iPhone in standalone mode:

1. Launch from home screen → log a movement → toast should appear below the status bar with ~16px gap
2. In normal Safari (not standalone) → toast should appear at the same position as before (16px from top, since `env()` resolves to `0px`)

---

## Splash screen (optional follow-up)

iOS standalone apps show a brief white flash on launch unless `apple-touch-startup-image` meta tags are provided. These require specific image sizes for each device resolution.

**Not included in the initial implementation.** Test the launch experience first — if the white flash is distracting, revisit with splash screen images. The `background_color` in the manifest helps on Android (Android uses it for the splash screen), but iOS ignores it.

---

## Project structure after Step 8

```
src/
  app/
    manifest.ts                           # NEW: web app manifest
    layout.tsx                            # MODIFY: add Apple meta tags, pt-safe
    globals.css                           # MODIFY: add pt-safe utility
    (auth)/                               # UNCHANGED
    (app)/
      components/
        nav-bar.tsx                       # MODIFY: add pb-safe
      history/                            # UNCHANGED
      log/                                # UNCHANGED
      layout.tsx                          # UNCHANGED
  components/
    ui/
      sonner.tsx                          # MODIFY: add mobileOffset for safe area
  lib/                                    # UNCHANGED
  proxy.ts                                # UNCHANGED
public/
  icon-192.png                            # NEW: Android manifest icon
  icon-512.png                            # NEW: Android manifest icon + splash
  apple-touch-icon.png                    # NEW: iOS home screen icon
```

---

## Testing

### Unit tests

No unit tests needed for this step. The manifest is a static export, the meta tags are declarative, and the CSS utilities are trivial. Testing these would be testing framework behavior, not application logic.

### Integration: manual E2E verification

**Android (Chrome):**

1. Open the deployed app in Chrome on Android
2. Verify the browser shows an install prompt (or use Chrome menu → "Add to Home screen" / "Install app")
3. Install → app icon appears on home screen with correct icon
4. Launch from home screen → app opens without browser chrome (no address bar)
5. Android system bar matches `theme_color` (warm beige)
6. Splash screen shows `background_color` with app icon during load
7. Navigate between Log and History → works normally
8. Log a movement → undo toast appears correctly

**iOS (Safari):**

1. Open the deployed app in Safari on iPhone
2. Share → "Add to Home Screen" → verify icon and name look correct
3. Launch from home screen → app opens in standalone mode (no Safari UI)
4. Status bar is transparent with white icons — beige background shows through seamlessly
5. Content is not obscured by the status bar (top safe area padding works)
6. Nav bar is not obscured by the home indicator (bottom safe area padding works)
7. Log a movement → undo toast does not overlap the status bar
8. Navigate between Log and History → works normally
9. Rotate to landscape (if supported) → safe area insets adjust correctly
10. Kill the app and relaunch → returns to the start URL (`/log`), not the last visited page

**Desktop (Chrome/Safari):**

11. Verify no regressions in normal browser mode — safe area padding should be 0 on desktop
12. Verify the manifest is served at `/manifest.webmanifest` (Next.js default path)

**Sonner toast (iOS standalone):**

13. Log a movement from the home screen app → undo toast should appear below the status bar with ~16px gap
14. In normal Safari → toast position should be unchanged from before (16px from top)

---

## Decision points

### 1. Manifest approach: `manifest.ts` vs `public/manifest.json`

**Option A: `src/app/manifest.ts` (chosen)**
Typed TypeScript, auto-linked by Next.js, consistent with App Router conventions.

**Option B: Static `public/manifest.json`**
Simpler file, but requires manual `<link rel="manifest">`, no type checking.

**Decision: Option A.** The typed approach catches errors at build time and the framework handles linking automatically.

### 2. Service worker: none vs minimal

**Option A: No service worker (chosen)**
Neither iOS nor Android require a service worker for installability (as of 2024+). No offline caching needed.

**Option B: Minimal service worker**
Some older guides recommend a minimal SW for the install prompt. No longer necessary.

**Decision: Option A.** Zero complexity. The app explicitly requires network. Adding a service worker would introduce caching questions with no benefit.

### 3. Status bar style

**Option A: `black-translucent` (chosen)**
Transparent status bar, beige background shows through, white icons. Seamless edge-to-edge look.

**Option B: `default`**
White status bar, black icons. Creates a white band at the top — color mismatch with beige.

**Option C: `black`**
Black status bar, white icons. Harsh contrast with beige background.

**Decision: Option A.** The only option that avoids a color mismatch. Requires safe area padding (already partially in place via `viewportFit: "cover"`).

### 4. Safe area padding placement

**Option A: On `<body>` (chosen)**
Covers all routes (auth + app). Single point of change.

**Option B: On `<main>` in each layout**
More targeted, but requires changes in both `(app)/layout.tsx` and `(auth)/` layouts.

**Decision: Option A.** Simpler, covers the auth flow too. The `bg-background` on `<body>` ensures the beige extends behind the status bar.

### 5. Bottom safe area: `pb-safe` on nav bar

**Option A: Add `pb-safe` to nav bar (chosen)**
Prevents home indicator overlap. Resolves to `0` on devices without one.

**Option B: Add to `<body>`**
Would push all content up, including the nav bar, but also affect auth pages unnecessarily.

**Decision: Option A.** Targeted to the component that needs it.

### 6. Manifest `id` field

**Option A: Set `id: "/"` (chosen)**
Decouples app identity from `start_url`. Future routing changes won't orphan existing Android installs.

**Option B: Omit `id`**
Chromium derives identity from `start_url`. Simpler, but fragile — changing `start_url` later silently creates a "new" app.

**Decision: Option A.** One line of config that prevents a silently destructive scenario. No downside.

### 7. Maskable icon: same file vs separate asset

**Option A: Reuse 512x512 with separate `purpose: "maskable"` entry (chosen for now)**
Quick, no extra asset needed. Works if the icon artwork has enough padding (~20% safe zone).

**Option B: Provide a separate maskable variant with more padding**
Better visual result if the artwork has detail near edges.

**Decision: Option A for initial implementation.** Verify visually once icon assets are provided. If Android's mask clips important content, switch to Option B.

### 8. Splash screen

**Option A: Skip for now (chosen)**
Test the launch experience first. The white flash may be brief enough to ignore.

**Option B: Implement `apple-touch-startup-image` tags**
Requires device-specific image assets (many sizes). Complexity vs. value trade-off.

**Decision: Option A.** Revisit if the flash is distracting after testing.
