# Step 5: Undo toast

Detailed plan for implementing Step 5 from the implementation plan.

---

## Goal

Add the ability to undo an accidental movement log. After tapping a button on the Log screen, a toast appears for a few seconds with an "Undo" button. Tapping undo deletes the just-logged movement.

**Working state:** User can undo an accidental tap within a few seconds.

---

## Prerequisites

Same as previous steps — Supabase is configured, auth works, the Log screen persists movements. This step uses:

- `cn()` from `@/lib/utils` for conditional className composition
- shadcn Sonner component (installed in this step)
- The existing `logMovement` server action which returns `{ id: string }`

---

## What changes from previous steps

Step 1 delivered the Log screen with three intensity buttons and a server action that returns `{ id }`. Step 2 added Supabase auth and deployment. Steps 3-4 delivered the History screen with timeline and carousel. Step 5 adds undo:

1. **Service layer:** Add `deleteMovement(id)` — deletes a movement by ID, scoped to the authenticated user
2. **Server action:** Add `undoMovement(id)` — calls `deleteMovement`, revalidates `/history`
3. **Toast infrastructure:** Install shadcn Sonner, add `<Toaster />` to the app layout
4. **Log page:** Capture the returned `{ id }` from `logMovement`, show an undo toast

**No changes to:** auth, proxy, login, history page, timeline, carousel, database schema, RLS policies, deployment config

---

## Service layer: `deleteMovement`

### `src/lib/movements.ts`

```ts
export async function deleteMovement(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("movements")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
```

**Why no `user_id` filter in the query?** RLS handles it. The `movements` table has a policy `auth.uid() = user_id` on DELETE. The server Supabase client carries the user's session, so RLS ensures a user can only delete their own movements. Adding a redundant `.eq("user_id", ...)` filter would be defense-in-depth but is unnecessary — RLS is the authoritative access control layer in this app.

**Why no "not found" check?** Supabase's `.delete()` returns success even if zero rows matched (the row was already deleted, or RLS filtered it out). This makes the operation naturally idempotent — calling undo twice on the same movement is a no-op, not an error. This is desirable for the undo use case.

---

## Server action: `undoMovement`

### `src/app/(app)/log/actions.ts`

```ts
export async function undoMovement(id: string): Promise<void> {
  await deleteMovement(id);
  revalidatePath("/history");
}
```

**Why a separate action instead of reusing a generic delete?** Step 6 will add a different delete flow (popover + confirmation dialog on the timeline). Having `undoMovement` as its own action keeps the undo path simple — no confirmation needed, no UI coordination. Both actions call the same `deleteMovement` service function underneath.

**Why `revalidatePath("/history")`?** If the user logs a movement, then navigates to Historik, the timeline should reflect the undo. Revalidating ensures the server-rendered history page picks up the deletion. This matches the pattern already used in `logMovement`.

---

## Toast infrastructure: Sonner

### Why Sonner

The app needs a toast with an action button, auto-dismiss after a timeout, and swipe-to-dismiss on mobile. Building this from scratch requires ~150-200 lines covering animations, accessibility (ARIA live regions), touch gesture handling, and stacking logic. Sonner provides all of this at ~9KB gzipped with zero dependencies. The cost-benefit is clear for a mobile-first app where toast UX quality matters.

### Installation

```bash
bunx shadcn@latest add sonner
```

This installs the `sonner` package and creates `src/components/ui/sonner.tsx` — a thin wrapper that maps Sonner's styling to shadcn's design tokens.

**Note on `next-themes`:** The shadcn Sonner wrapper imports `useTheme` from `next-themes`. Since this app doesn't use theme switching, the wrapper should be simplified to remove the `next-themes` dependency. If the shadcn installer adds `next-themes` as a dependency, it can be removed after simplifying the wrapper. See the "Simplify the Sonner wrapper" section below.

### Simplify the Sonner wrapper

The default shadcn wrapper looks like this:

```tsx
"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // ... shadcn token mappings
    />
  )
}
```

**Simplify to remove `next-themes`:**

```tsx
"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      // ... keep the shadcn token mappings as-is
      {...props}
    />
  )
}

export { Toaster }
```

Hardcode `theme="light"` since the app has no dark mode. Then remove `next-themes` from `package.json` if it was added.

### Add `<Toaster />` to the app layout

### `src/app/(app)/layout.tsx`

```tsx
import { NavBar } from "@/app/(app)/components/nav-bar";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <main className="flex flex-1 flex-col overflow-auto pb-16">{children}</main>
      <NavBar />
      <Toaster />
    </>
  );
}
```

**Why in the `(app)` layout, not the root layout?** The toast is only relevant for authenticated users. The `(auth)` layout (login flow) doesn't need it. Placing `<Toaster />` in the `(app)` layout scopes it to the authenticated portion of the app. It also means the toast survives navigation between `/log` and `/history` (both are under `(app)`), which is the desired behavior.

### Toaster configuration

```tsx
<Toaster
  position="top-center"
  duration={5000}
  toastOptions={{
    className: "font-sans",
  }}
/>
```

**Position: `top-center`** — the app has a fixed bottom nav bar (`z-10`, `pb-safe`). Bottom-positioned toasts would overlap with it or require fiddly offset calculations that vary with iOS safe area insets. Top-center avoids this entirely and is a common mobile pattern (Android snackbar style). Sonner automatically adapts swipe direction — top-positioned toasts swipe up to dismiss.

**Duration: `5000`** — 5 seconds. The implementation plan says "3 seconds", but research and UX best practice suggest 5 seconds is more comfortable for a destructive undo action on mobile, where the user may need a moment to read and reach the button. This is a minor deviation from the plan that improves usability.

**z-index:** Sonner's toasts render at `z-[100]` by default, well above the nav bar's `z-10`.

---

## Log page changes

### `src/app/(app)/log/page.tsx`

The key changes:

1. Import `toast` from `sonner` and `undoMovement` from actions
2. Capture the `{ id }` returned by `logMovement` (currently discarded)
3. Show an undo toast after each successful log
4. Dismiss the previous undo toast when a new one appears (latest-wins)

```tsx
"use client";

import { useCallback, useRef, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { intensities } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { logMovement, undoMovement } from "./actions";

const buttonColorMap = {
  "chart-1": "bg-chart-1 text-white hover:bg-chart-1/90",
  "chart-2": "bg-chart-2 text-white hover:bg-chart-2/90",
  "chart-3": "bg-chart-3 text-white hover:bg-chart-3/90",
} as const;

const DEBOUNCE_MS = 500;

export default function LogPage() {
  const [isPending, startTransition] = useTransition();
  const lastLogRef = useRef(0);
  const activeToastRef = useRef<string | number | undefined>();

  const handleLog = useCallback(
    (intensity: string) => {
      const now = Date.now();
      if (now - lastLogRef.current < DEBOUNCE_MS) return;

      lastLogRef.current = now;
      startTransition(async () => {
        const { id } = await logMovement(intensity);

        // Dismiss previous undo toast (latest-wins)
        if (activeToastRef.current !== undefined) {
          toast.dismiss(activeToastRef.current);
        }

        activeToastRef.current = toast("Rörelse registrerad", {
          action: {
            label: "Ångra",
            onClick: () => {
              startTransition(async () => {
                try {
                  await undoMovement(id);
                } catch {
                  toast.error("Ångra misslyckades");
                }
              });
            },
          },
        });
      });
    },
    [startTransition],
  );

  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-4 px-6'>
      {intensities.map(({ value, label, icon: Icon, color }) => (
        <Button
          key={value}
          onClick={() => handleLog(value)}
          disabled={isPending}
          className={cn(
            'w-full max-w-sm rounded-2xl px-6 py-6 text-xl font-semibold touch-manipulation active:scale-95 transition-transform',
            buttonColorMap[color],
          )}
        >
          <Icon className='size-6' />
          {label}
        </Button>
      ))}
    </div>
  );
}
```

### Behavior details

**Latest-wins:** When the user taps a button multiple times in quick succession (faster than the debounce but slower than 500ms), each tap logs a movement and dismisses the previous undo toast. Only the most recent movement can be undone. This is intentional — stacking multiple undo toasts would be confusing.

**Toast inside `startTransition`:** The toast is shown after `logMovement` completes, inside the transition. This means the toast only appears after the movement is actually persisted. If the server action fails, no toast is shown — the user sees the `isPending` state (disabled buttons) and the error propagates naturally.

**Undo calls `startTransition` with error handling:** The undo action is wrapped in `startTransition` with a try/catch. On success, the movement is deleted and Sonner auto-dismisses the toast. On failure (network error, server error), a `toast.error("Ångra misslyckades")` is shown so the user knows the undo didn't work. The `startTransition` wrapper also shows the pending state on the log buttons while the delete is in progress, preventing the user from logging a new movement while the undo is being processed.

**No undo-of-undo:** Once the user taps undo, the movement is deleted. There is no way to redo the movement — the undo toast dismisses on action click (Sonner's default behavior). This matches the implementation plan: "Undo does not survive page refresh or navigation."

### What happens on navigation

The `<Toaster />` lives in the `(app)` layout, which wraps both `/log` and `/history`. When the user taps a button, sees the toast, then navigates to Historik, the toast remains visible and functional. The undo button still works because `undoMovement` is a server action — it doesn't depend on the Log page being mounted.

If the user navigates to `/login` (outside the `(app)` layout), the toast unmounts. The movement is already persisted, so nothing is lost.

---

## Project structure after Step 5

```
src/
  components/
    ui/
      button.tsx                        # UNCHANGED
      skeleton.tsx                      # UNCHANGED (from Step 4)
      sonner.tsx                        # INSTALLED+MODIFIED: shadcn Sonner (next-themes removed)
  app/
    (auth)/                             # UNCHANGED
    (app)/
      components/
        nav-bar.tsx                     # UNCHANGED
      history/
        day-carousel.tsx                # UNCHANGED (from Step 4)
        day-timeline.tsx                # UNCHANGED (from Step 4)
        page.tsx                        # UNCHANGED (from Step 4)
        timeline.tsx                    # UNCHANGED (from Step 3/4)
        timeline.test.tsx               # UNCHANGED (from Step 3)
        timeline-skeleton.tsx           # UNCHANGED (from Step 4)
      log/
        actions.ts                      # MODIFY: add undoMovement action
        page.tsx                        # MODIFY: capture id, show undo toast
      layout.tsx                        # MODIFY: add <Toaster />
    globals.css                         # UNCHANGED
    layout.tsx                          # UNCHANGED
    page.tsx                            # UNCHANGED
  lib/
    supabase/
      client.ts                         # UNCHANGED
      server.ts                         # UNCHANGED
    constants.ts                        # UNCHANGED (from Step 3)
    date.ts                             # UNCHANGED (from Step 3/4)
    date.test.ts                        # UNCHANGED (from Step 3/4)
    day-counts.ts                       # UNCHANGED (from Step 4)
    day-counts.test.ts                  # UNCHANGED (from Step 4)
    movements.ts                        # MODIFY: add deleteMovement
    movements.test.ts                   # MODIFY: add deleteMovement tests
    utils.ts                            # UNCHANGED
  proxy.ts                              # UNCHANGED
```

---

## Testing

### Unit tests: `deleteMovement` (`src/lib/movements.test.ts`)

These follow the existing test structure — mock the Supabase client, verify the query builder calls. **Note:** The existing mock setup uses separate chains for read (`.select().gte().lt().order()`) and create (`.insert().select().single()`). The delete chain (`.delete().eq()`) needs a new mock chain added to the `mockFrom` return value.

1. **`deleteMovement` calls Supabase delete with correct id** — verify `.from("movements").delete().eq("id", id)` is called
2. **`deleteMovement` throws on Supabase error** — mock returns an error, verify it propagates
3. **`deleteMovement` succeeds when no rows matched** — mock returns success with zero affected rows, verify no error is thrown (idempotent behavior)

### Unit tests: `undoMovement` action (`src/app/(app)/log/actions.test.ts`)

1. **`undoMovement` calls deleteMovement and revalidates** — mock `deleteMovement` and `revalidatePath`, verify both are called with the correct arguments
2. **`undoMovement` propagates errors from deleteMovement** — mock `deleteMovement` to throw, verify the error propagates

### Component tests: Log page (`src/app/(app)/log/page.test.tsx`)

Use `// @vitest-environment jsdom` docblock. These tests verify the toast integration:

1. **Shows undo toast after logging** — simulate a button click, verify `toast()` was called with the correct message and an action
2. **Undo action calls undoMovement with the correct id** — simulate the toast action's onClick, verify `undoMovement` is called with the id returned by `logMovement`
3. **Dismisses previous toast on new log** — simulate two button clicks, verify `toast.dismiss()` was called with the first toast's id before showing the second toast
4. **Does not show toast when logMovement fails** — mock `logMovement` to throw, verify no toast is shown
5. **Shows error toast when undo fails** — mock `undoMovement` to throw, simulate the toast action's onClick, verify `toast.error()` is called with the failure message

**Note on mocking Sonner:** The `toast` function from `sonner` can be mocked with `vi.mock("sonner")`. Mock `toast` to return a predictable id, and `toast.dismiss` to be a no-op spy. This avoids needing a real DOM toast container in tests.

### Integration: manual E2E verification

1. Tap "Mycket" → toast appears at the top with "Rörelse registrerad" and an "Ångra" button
2. Wait 5 seconds → toast auto-dismisses with a smooth exit animation
3. Tap "Mycket", then tap "Ångra" before timeout → movement is deleted, toast dismisses
4. Verify deletion: navigate to Historik → the undone movement does not appear
5. Tap "Mycket" twice quickly → only one toast is visible (the second, for the latest movement)
6. Tap "Ångra" on the second toast → only the second movement is deleted, the first remains
7. Tap "Mycket", navigate to Historik → toast remains visible and functional
8. Tap "Ångra" while on Historik → movement is deleted, timeline updates after undo completes (revalidatePath triggers immediate UI update)
9. Swipe the toast upward → toast dismisses (swipe-to-dismiss, no undo triggered)
10. Refresh the page while toast is showing → toast disappears (expected — undo does not survive refresh)
11. Simulate undo failure (e.g., airplane mode) → error toast "Ångra misslyckades" appears

---

## Decision points

### 1. Toast library: Sonner vs custom

**Option A: Sonner via shadcn (chosen)**
Install `sonner` (~9KB gzipped) via `bunx shadcn@latest add sonner`. Get animations, swipe-to-dismiss, accessibility (ARIA live regions), action button API, and stacking logic for free.

**Option B: Custom toast component**
Build a minimal toast with `tw-animate-css` animations. ~150-200 lines of code, no dependency, but no swipe-to-dismiss, no ARIA live region, no stacking.

**Decision: Option A.** The bundle cost is modest and the UX quality matters for a mobile-first app. Swipe-to-dismiss is expected behavior on mobile. Accessibility comes free. The toast infrastructure will also be reused later — Step 4's prefetch error handling has a `// TODO(Step 5): show error toast` comment, and Step 6's delete flow may use confirmation toasts.

### 2. Delete pattern: immediate vs delayed

**Option A: Immediate delete, undo restores (chosen)**
The movement is deleted the moment the user taps "Undo". The toast is purely a recovery mechanism — the movement was already persisted by `logMovement`.

Wait — clarification: the movement is **logged immediately** when the user taps the button. The "Undo" action then **deletes** the already-persisted movement. This is the opposite of a "delayed write" pattern.

**Option B: Delayed write**
Don't persist the movement until the toast expires. If the user taps undo, the write never happens.

**Decision: Option A.** The delayed-write pattern creates complex state management: what if the user navigates away? Closes the browser? Has multiple pending writes? The state would need to survive across pages and handle cleanup on unmount. With immediate persistence, the movement is in the database the moment it's logged, and undo is just a delete. This is simpler, more reliable, and matches the architecture where server actions are the source of truth.

### 3. Toast position: top vs bottom

**Option A: `top-center` (chosen)**
Toast appears at the top of the screen.

**Option B: `bottom-center` with offset**
Toast appears above the bottom nav bar, requiring a calculated offset.

**Decision: Option A.** The fixed bottom nav bar (`z-10`, `pb-safe`) makes bottom positioning awkward. The offset would need to account for the nav height (~4rem), the iOS safe area inset (varies by device), and any future changes to the nav bar. Top-center avoids all of this and is a standard mobile pattern. Sonner automatically adapts swipe direction for top-positioned toasts.

### 4. Multiple toasts: stack vs latest-wins

**Option A: Latest-wins (chosen)**
Each new log dismisses the previous undo toast. Only the most recent movement can be undone.

**Option B: Stack**
Multiple undo toasts stack up, each for a different movement.

**Decision: Option A.** Stacked undo toasts would be confusing on a small mobile screen. The user would need to read each toast to know which movement it refers to, and accidentally tapping the wrong one would undo the wrong movement. Latest-wins is simpler and less error-prone. The practical scenario (rapid logging) makes stacking even worse — three identical-looking "undo" toasts would be indistinguishable.

### 5. Toast duration: 3s vs 5s

**Option A: 3 seconds (per implementation plan)**
Matches the spec.

**Option B: 5 seconds (chosen)**
More comfortable for mobile interaction.

**Decision: Option B.** The implementation plan specified 3 seconds, but 5 seconds is the more common UX standard for destructive undo actions. On mobile, the user may need a moment to read the toast and reach the button, especially when holding the phone in one hand. The extra 2 seconds significantly reduces accidental missed undos without meaningfully impacting the experience. This is configured via Sonner's `duration` prop and trivially adjustable if we want to tune it later.

### 6. Sonner wrapper: keep or remove `next-themes`

**Option A: Remove `next-themes` dependency (chosen)**
Simplify the shadcn-generated wrapper to hardcode `theme="light"`, remove the `useTheme` import, and uninstall `next-themes`.

**Option B: Keep `next-themes`**
Accept the dead dependency (~3KB gzipped).

**Decision: Option A.** The app has no dark mode. Keeping a dependency that's never used adds unnecessary weight and a confusing import for future readers. The simplification is trivial — one line change in the wrapper.

### 7. Toast message language: Swedish vs English

**Decision: Swedish with proper characters.** The app UI is in Swedish ("Logga", "Historik", "Mycket", "Mellan", "Lite") and uses proper Swedish characters where appropriate (e.g., "Inga rörelser registrerade" in the history empty state, "Igår" in the carousel label). The toast should match: "Rörelse registrerad" (movement registered) with "Ångra" (undo) as the action label, and "Ångra misslyckades" for the error toast.
