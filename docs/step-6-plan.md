# Step 6: Delete flow

Detailed plan for implementing Step 6 from the implementation plan.

---

## Goal

Add the ability to delete any movement from the timeline. Tapping a timeline entry opens a popover with a delete button. Tapping delete shows a confirmation dialog. On confirm, the movement is deleted and the UI updates.

**Working state:** User can delete any movement from the history.

---

## Prerequisites

Steps 1-5 are complete:

- Timeline component exists (`src/app/(app)/history/timeline.tsx`) — a Client Component receiving `Movement[]` as props, rendering `[time] [dot] [label]` rows
- `DayTimeline` is an async Server Component wrapping `<Timeline>` inside a `Suspense` boundary
- `DayCarousel` shows stacked bar counts, driven by `searchParams`
- `deleteMovement(id)` exists in `src/lib/movements.ts` — RLS-scoped, idempotent
- Sonner toast infrastructure is installed and configured in the `(app)` layout
- `cn()` from `@/lib/utils` for conditional className composition

This step uses:

- shadcn `Popover` component (installed in this step)
- shadcn `AlertDialog` component (installed in this step)
- shadcn `Button` component (already installed)
- The existing `deleteMovement` service function from Step 5

---

## What changes from Step 5

Step 5 added the undo toast — a quick-recovery mechanism for accidental logs. Step 6 adds deliberate deletion of any movement from the timeline:

1. **Server action:** Add `deleteTimelineMovement(id)` in a new `history/actions.ts` — calls `deleteMovement`, revalidates `/history`
2. **shadcn components:** Install `popover` and `alert-dialog`
3. **Timeline component:** Add tap handler, popover, and confirmation dialog to each entry
4. **No new service layer functions** — reuses `deleteMovement` from Step 5

**No changes to:** auth, proxy, login, log page, log actions, database schema, RLS policies, deployment config, carousel component, Sonner configuration

---

## Server action: `deleteTimelineMovement`

### `src/app/(app)/history/actions.ts` (new file)

```ts
"use server";

import { deleteMovement } from "@/lib/movements";
import { revalidatePath } from "next/cache";

export async function deleteTimelineMovement(id: string): Promise<void> {
  await deleteMovement(id);
  revalidatePath("/history");
}
```

**Why a separate action from `undoMovement` in log/actions.ts?** The two actions live in different route segments and serve different UI flows. `undoMovement` belongs to the log page (toast-driven, no confirmation). `deleteTimelineMovement` belongs to the history page (popover + dialog-driven, with confirmation). Both call the same `deleteMovement` service function underneath.

**Why not a shared `actions.ts`?** Next.js colocates server actions with the pages that use them. Keeping `deleteTimelineMovement` in `history/actions.ts` makes the dependency graph clear: history page components import from their own actions file, not from a sibling route.

---

## shadcn component installation

```bash
bunx shadcn@latest add popover alert-dialog
```

This installs:

- `src/components/ui/popover.tsx` — wraps Radix UI Popover with shadcn styling
- `src/components/ui/alert-dialog.tsx` — wraps Radix UI AlertDialog with shadcn styling

Both use the existing `radix-ui` package (already a dependency via the Button component). No new runtime dependencies are added.

---

## Timeline component changes

### `src/app/(app)/history/timeline.tsx`

The timeline is already a Client Component (`"use client"`) that receives `Movement[]` as props. Step 6 adds interactivity to each entry.

### Architecture: Popover and AlertDialog as siblings

The key compositional pattern is rendering `Popover` and `AlertDialog` as **siblings**, not nested. This avoids a known Radix UI issue where clicks inside a nested portaled component (the AlertDialog) are misinterpreted as "outside" clicks by the Popover's `DismissableLayer`, causing the popover to close unexpectedly.

The flow is:

1. User taps a timeline entry → popover opens (anchored to that entry)
2. User taps "Radera" (delete) in the popover → popover closes, then AlertDialog opens
3. User taps "Radera" (confirm) in the AlertDialog → confirm button shows loading state, delete action fires, dialog closes after completion
4. User taps "Avbryt" (cancel) in the AlertDialog → dialog closes, nothing happens

### State management

The timeline component manages two pieces of state:

```ts
const [selectedId, setSelectedId] = useState<string | null>(null);
const [confirmId, setConfirmId] = useState<string | null>(null);
```

- `selectedId` — which movement's popover is open (or `null` if none)
- `confirmId` — which movement's confirmation dialog is open (or `null` if none)

These are mutually exclusive in practice: when the user taps "Radera" in the popover, `selectedId` is set to `null` (closing the popover) and `confirmId` is set to the movement's id (opening the dialog).

### Updated component structure

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatTime } from "@/lib/date";
import { intensityLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { type Movement } from "@/lib/movements";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteTimelineMovement } from "./actions";

type Props = {
  movements: Movement[];
};

export function Timeline({ movements }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    setSelectedId(null);    // close popover first
    setConfirmId(id);       // then open dialog
  }

  function handleConfirm() {
    if (!confirmId) return;
    const id = confirmId;

    startTransition(async () => {
      try {
        await deleteTimelineMovement(id);
        setConfirmId(null);     // close dialog on success
      } catch {
        setConfirmId(null);     // close dialog on error too
        toast.error("Radering misslyckades");
      }
    });
  }

  return (
    <>
      <div className="flex flex-col">
        {movements.map((m, i) => (
          <Popover
            key={m.id}
            open={selectedId === m.id}
            onOpenChange={(open) => setSelectedId(open ? m.id : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "group flex items-start gap-3 py-4 text-left",
                  "active:bg-muted/50 transition-colors",
                  isPending && "pointer-events-none opacity-50"
                )}
              >
                {/* Time */}
                <span className="w-12 shrink-0 text-sm text-muted-foreground tabular-nums pt-0.5">
                  {formatTime(m.occurred_at)}
                </span>

                {/* Dot + connector */}
                <span className="flex flex-col items-center">
                  <span className="flex size-4.5 items-center justify-center rounded-full bg-primary/20">
                    <span className="size-3 rounded-full bg-primary" />
                  </span>
                  {i < movements.length - 1 && (
                    <span className="w-px flex-1 border" />
                  )}
                </span>

                {/* Label */}
                <span className="text-sm text-foreground pt-0.5">
                  {intensityLabel(m.intensity)}
                </span>
              </button>
            </PopoverTrigger>

            <PopoverContent
              side="right"
              align="center"
              className="w-auto p-2"
            >
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(m.id)}
              >
                Radera
              </Button>
            </PopoverContent>
          </Popover>
        ))}
      </div>

      {/* Confirmation dialog — sibling to all popovers, not nested */}
      <AlertDialog
        open={confirmId !== null}
        onOpenChange={(open) => { if (!open) setConfirmId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera rorelse?</AlertDialogTitle>
            <AlertDialogDescription>
              Rorelsen tas bort permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Raderar..." : "Radera"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### Key implementation details

**Timeline entries become `<button>` elements.** In Step 3, each entry is a `<div>`. Step 6 changes them to `<button type="button">` wrapped in `<PopoverTrigger asChild>`. This gives us:
- Tap-to-open behavior (Radix handles the toggle)
- Keyboard accessibility (Space/Enter to open, Escape to close)
- Correct semantic meaning (interactive element)

**`active:bg-muted/50`** provides a subtle press feedback on mobile. The `transition-colors` makes it smooth.

**Dialog stays open during delete.** The AlertDialog remains open while the server action is in flight. The confirm button shows "Raderar..." and both buttons are disabled via `isPending`. This gives clear, in-context feedback — the user sees their action is processing without losing focus. The dialog closes only after the action completes (success or error). On error, the dialog closes and a toast appears.

**`isPending` also disables timeline entries** while a delete is in flight via `pointer-events-none opacity-50`. In practice this is redundant while the modal AlertDialog is open (it blocks background interaction), but it provides a visual signal and protects against edge cases where the dialog might close before the transition completes.

**Single AlertDialog instance.** There is one `AlertDialog` at the bottom of the component, controlled by `confirmId`. This avoids rendering N dialog instances (one per entry). The dialog content is generic ("Radera rorelse?") — it doesn't need to reference the specific movement because the user just tapped it.

**Popover positioning: `side="right"`** places the popover to the right of the tapped entry. On a mobile screen, if there isn't enough room on the right, Radix automatically flips to the left (or above/below) via its `avoidCollisions` behavior (enabled by default). The `w-auto p-2` keeps the popover compact — it contains only a single "Radera" button.

**Close-then-open ordering.** When the user taps "Radera" in the popover, `handleDelete` sets `selectedId = null` (closing the popover) before setting `confirmId` (opening the dialog). This ordering is important for Radix focus management — the popover must unmount before the AlertDialog takes over focus.

**Error handling.** If the delete fails, a `toast.error("Radering misslyckades")` is shown using the Sonner infrastructure from Step 5. This matches the error handling pattern established in the undo toast.

### What happens after a successful delete

1. `deleteTimelineMovement` calls `revalidatePath("/history")`
2. Next.js re-renders the `HistoryPage` Server Component with fresh data
3. The `DayTimeline` async component re-fetches movements for the selected day
4. `getDayCounts` is also re-fetched, updating the carousel bar counts
5. The `Suspense key={selectedDay}` boundary re-suspends briefly, showing the skeleton
6. The timeline re-renders without the deleted movement

The carousel, legend, and timeline all update because they all derive from server-fetched data inside the `Suspense` boundary that `revalidatePath` invalidates.

**No optimistic UI.** The delete has a confirmation dialog, so the user expects a brief pause. The server round-trip is fast for a simple delete. Adding `useOptimistic` would mean handling rollback on failure — unnecessary complexity for this use case. If latency becomes noticeable during testing, optimistic deletion can be added later with `useOptimistic` filtering the movements array.

---

## PopoverContent styling

The popover contains a single destructive button. Keep it minimal:

```tsx
<PopoverContent side="right" align="center" className="w-auto p-2">
  <Button variant="destructive" size="sm" onClick={() => handleDelete(m.id)}>
    Radera
  </Button>
</PopoverContent>
```

**Why just a button, not a menu?** The popover's only purpose is to provide a delete affordance. A dropdown menu or list of actions would be overengineered — there's only one action. The popover acts as a spatial anchor ("I'm deleting *this* entry") and an accidental-tap buffer (two taps required: entry + delete button).

**Why a popover at all, instead of direct dialog?** The popover provides a lightweight intermediate step. Tapping a timeline entry and immediately seeing a modal confirmation dialog would feel jarring. The popover signals "you've selected this entry" and offers the delete action in context. It's also easy to dismiss (tap outside) if the user tapped the entry accidentally.

---

## AlertDialog styling

The AlertDialog uses shadcn's default styling with the `--destructive` token for the action button:

```tsx
<AlertDialogAction
  onClick={handleConfirm}
  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
>
  Radera
</AlertDialogAction>
```

**Note:** Check whether `AlertDialogAction` applies a destructive style by default. If not, add the `className` above to override the default primary button styling. The `--destructive` token is `oklch(0.5429 0.1339 22.5959)` (muted red) with `--destructive-foreground` as cream — this gives good contrast and clear "danger" signaling.

**AlertDialog prevents accidental dismiss.** Unlike a regular Dialog, AlertDialog has no overlay-click-to-close and no close button. The user must explicitly tap "Avbryt" (cancel) or "Radera" (confirm). This is the correct UX for a destructive action.

---

## Project structure after Step 6

```
src/
  components/
    ui/
      alert-dialog.tsx                  # INSTALLED: shadcn AlertDialog
      button.tsx                        # UNCHANGED
      popover.tsx                       # INSTALLED: shadcn Popover
      sonner.tsx                        # UNCHANGED (from Step 5)
  app/
    (auth)/                             # UNCHANGED
    (app)/
      components/
        nav-bar.tsx                     # UNCHANGED
      history/
        actions.ts                      # NEW: deleteTimelineMovement server action
        day-carousel.tsx                # UNCHANGED (from Step 4)
        day-timeline.tsx                # UNCHANGED (from Step 4)
        page.tsx                        # UNCHANGED (from Step 4)
        timeline.tsx                    # MODIFY: add popover, alert dialog, delete flow
        timeline-skeleton.tsx           # UNCHANGED (from Step 4)
      log/
        actions.ts                      # UNCHANGED (from Step 5)
        page.tsx                        # UNCHANGED (from Step 5)
      layout.tsx                        # UNCHANGED (from Step 5)
    globals.css                         # UNCHANGED
    layout.tsx                          # UNCHANGED
    page.tsx                            # UNCHANGED
  lib/
    supabase/
      client.ts                         # UNCHANGED
      server.ts                         # UNCHANGED
    constants.ts                        # UNCHANGED (from Step 3)
    date.ts                             # UNCHANGED (from Step 3/4)
    day-counts.ts                       # UNCHANGED (from Step 4)
    movements.ts                        # UNCHANGED (has deleteMovement from Step 5)
    movements.test.ts                   # UNCHANGED
    utils.ts                            # UNCHANGED
  proxy.ts                              # UNCHANGED
```

---

## Testing

### Unit tests: `deleteTimelineMovement` action (`src/app/(app)/history/actions.test.ts`)

1. **`deleteTimelineMovement` calls deleteMovement and revalidates** — mock `deleteMovement` and `revalidatePath`, verify both are called with the correct arguments
2. **`deleteTimelineMovement` propagates errors from deleteMovement** — mock `deleteMovement` to throw, verify the error propagates

### Component tests: Timeline (`src/app/(app)/history/timeline.test.tsx`)

Use `// @vitest-environment jsdom` docblock. These tests extend the existing Step 3 tests with interactivity:

1. **Tapping an entry opens the popover** — render with movements, simulate click on an entry, verify the popover content is visible (the "Radera" button)
2. **Tapping "Radera" in the popover opens the confirmation dialog** — simulate popover open, click the delete button, verify the AlertDialog content appears ("Radera rorelse?")
3. **Popover closes when dialog opens** — simulate the full flow, verify the popover content is no longer visible when the dialog is open
4. **Tapping "Avbryt" closes the dialog without deleting** — simulate through to the dialog, click cancel, verify `deleteTimelineMovement` was not called and the dialog closes
5. **Tapping "Radera" in the dialog calls the delete action** — simulate the full flow through to confirm, verify `deleteTimelineMovement` is called with the correct movement id
6. **Shows error toast when delete fails** — mock `deleteTimelineMovement` to throw, simulate the full delete flow, verify `toast.error()` is called
7. **Dialog stays open with loading state during delete** — mock `deleteTimelineMovement` to hang (never resolve), simulate the full delete flow, verify the AlertDialog remains open and both buttons are disabled
8. **Tapping outside the popover closes it** — simulate a click outside, verify the popover closes
9. **Rapid retap sequence** — open popover on row A, tap Radera, cancel dialog, open popover on row B, confirm delete — verify `deleteTimelineMovement` is called with row B's id (not row A's), and state is clean throughout

**Mocking strategy:** Mock `deleteTimelineMovement` from `./actions` and `toast` from `sonner`. Use `@testing-library/react` for rendering and interaction. The Popover and AlertDialog render into portals, so use `screen.getByRole` to find elements regardless of DOM position.

### Integration: manual E2E verification

1. Navigate to Historik with logged movements → tap a timeline entry → popover appears with "Radera" button
2. Tap outside the popover → popover closes, nothing happens
3. Tap entry again → popover opens → tap "Radera" → confirmation dialog appears with "Radera rorelse?" and two buttons
4. Tap "Avbryt" → dialog closes, movement still visible
5. Repeat: tap entry → "Radera" → "Radera" in dialog → movement disappears from timeline
6. Verify the carousel bar chart updates (the bar for that day should shrink or disappear)
7. Verify the legend counts update to reflect the deletion
8. Delete the last movement of a day → empty state message appears ("Inga rorelser registrerade")
9. Tap an entry near the edge of the screen → popover auto-positions to stay within viewport
10. Test on mobile: tap entry → popover opens cleanly, tap "Radera" → dialog opens, confirm → works end-to-end
11. Delete while on a slow connection → entries show disabled state during the pending transition
12. Simulate delete failure (e.g., airplane mode after dialog confirm) → error toast "Radering misslyckades" appears
13. Delete all movements on a past day → empty state "Inga rorelser registrerade" shown, carousel bar for that day becomes empty (no colored segments), legend shows all zeros, other bars rescale proportionally, carousel does not scroll or navigate away

---

## Decision points

### 1. Interaction pattern: popover + dialog vs direct dialog vs swipe-to-delete

**Option A: Popover then AlertDialog (chosen)**
Tap entry → popover with delete button → confirmation dialog → delete.

**Option B: Direct AlertDialog on tap**
Tap entry → confirmation dialog immediately.

**Option C: Swipe-to-delete**
Swipe a timeline entry left to reveal a delete button.

**Decision: Option A.** The two-step flow (popover → dialog) provides good protection against accidental deletes. The popover acts as a lightweight "you selected this" signal and is easy to dismiss (tap outside). Direct dialog on tap (Option B) would be jarring — the user might tap an entry just to see details, not to delete. Swipe-to-delete (Option C) is a well-known mobile pattern but requires a gesture library or significant custom touch handling, and it doesn't match the app's design language (no other swipe interactions exist). The popover is simpler to implement and more discoverable.

### 2. Component composition: nested vs sibling Popover/AlertDialog

**Option A: Sibling pattern with controlled state (chosen)**
`Popover` and `AlertDialog` are siblings in the component tree. State variables (`selectedId`, `confirmId`) control which is open. Close popover before opening dialog.

**Option B: AlertDialog nested inside PopoverContent**
The `AlertDialogTrigger` lives inside the popover.

**Decision: Option A.** Nesting portaled Radix components is a known source of bugs. Radix's `DismissableLayer` can misinterpret clicks inside a nested portal as "outside" clicks, causing the popover to close when the AlertDialog opens (Radix issue #2121). The sibling pattern avoids this entirely and gives explicit control over the open/close sequencing.

### 3. Number of AlertDialog instances: one vs N

**Option A: Single shared AlertDialog (chosen)**
One `AlertDialog` at the component root, controlled by `confirmId`.

**Option B: One AlertDialog per timeline entry**
Each entry renders its own `AlertDialog`.

**Decision: Option A.** A timeline with 20 entries would render 20 `AlertDialog` instances (each with a portal), even though at most one is ever open. The single-instance approach is more efficient and simpler to manage. The dialog content doesn't vary per entry — the title and description are generic.

### 4. Popover content: button vs menu

**Option A: Single "Radera" button (chosen)**
The popover contains just a destructive button.

**Option B: Dropdown menu with multiple actions**
A menu with "Delete", "Edit", etc.

**Decision: Option A.** There is only one action (delete). A menu is overengineered. If future steps add more actions (e.g., edit time, change intensity), the popover can be extended then. For now, one button keeps the interaction fast and clear.

### 5. Optimistic delete vs server-round-trip

**Option A: Wait for server (chosen)**
The entry remains visible until `revalidatePath` triggers a re-render with fresh data.

**Option B: Optimistic removal**
Remove the entry from the displayed list immediately, then reconcile with server data.

**Decision: Option A.** The confirmation dialog already introduces a pause in the interaction, so the user expects a brief wait. The server round-trip for a simple DELETE + revalidation is fast. Optimistic deletion would require `useOptimistic` and rollback handling on failure, adding complexity with no meaningful UX gain. This can be revisited if latency becomes noticeable.

### 6. Delete action location: history/actions.ts vs shared actions

**Option A: `history/actions.ts` (chosen)**
A new file colocated with the history page components.

**Option B: Shared `src/app/(app)/actions.ts`**
Both `undoMovement` and `deleteTimelineMovement` in one file.

**Option C: Reuse `undoMovement` from log/actions.ts**
Import and call the same action.

**Decision: Option A.** Server actions belong with the page that uses them. `undoMovement` belongs to the log flow; `deleteTimelineMovement` belongs to the history flow. They happen to do the same thing today (delete + revalidate), but they serve different UI patterns and may diverge in the future (e.g., the history delete might trigger a confirmation analytics event). Sharing a file across route segments would create a coupling that doesn't need to exist.

### 7. AlertDialog action button styling

**Decision: Use `bg-destructive text-destructive-foreground`.** The "Radera" confirmation button should look destructive — muted red background with cream text. Check whether shadcn's `AlertDialogAction` applies primary styling by default; if so, override with the destructive variant classes. The cancel button ("Avbryt") uses the default outline/ghost styling from `AlertDialogCancel`.

### 8. Dialog text language

**Decision: Swedish.** Consistent with the rest of the UI:
- Dialog title: "Radera rorelse?" (Delete movement?)
- Dialog description: "Rorelsen tas bort permanent." (The movement is removed permanently.)
- Confirm button: "Radera" (Delete)
- Cancel button: "Avbryt" (Cancel)
- Error toast: "Radering misslyckades" (Deletion failed)

No special characters (o instead of o with umlaut, a instead of a with ring) to match the existing pattern in the codebase.

### 9. Popover trigger: wrapping entry in button vs onClick handler

**Option A: `<PopoverTrigger asChild>` on a `<button>` (chosen)**
Each timeline entry becomes a `<button>` wrapped in `PopoverTrigger asChild`.

**Option B: `onClick` handler with controlled `open` state**
Keep entries as `<div>` elements, use `onClick` to toggle popover state.

**Decision: Option A.** Using `PopoverTrigger asChild` on a `<button>` is the Radix-recommended approach. It gives keyboard accessibility (Space/Enter to open, Escape to close), correct ARIA attributes, and focus management for free. A manual `onClick` on a `<div>` would need all of this implemented by hand.
