# Movemonitor — Implementation Plan

Each step produces a working application. Steps build on each other sequentially.

---

## Step 1: Skeleton + Log screen + persistence

Set up the project foundation and the primary user interaction.

- Initialize Next.js project with TypeScript and Bun
- Set up SQLite database with better-sqlite3 (schema: id, timestamp, intensity)
- Create API route for logging a movement (POST with intensity)
- Build the Log screen with three buttons: Mycket, Mellan, Lite
- Add floating action bar for navigation between Log and History screens
- History screen exists as a placeholder

**Working state:** User can tap a button and a movement is persisted to the database.

---

## Step 2: Basic timeline

Build the History screen with a timeline for today.

- Create API route for fetching movements by day
- Build the left-aligned vertical timeline component (00:00 top, 23:59 bottom)
- Show each movement as a dot with timestamp and intensity label
- Display today's movements by default
- Show empty-state message when no movements exist

**Working state:** User can log movements and see them on a timeline for today.

---

## Step 3: Day carousel

Add the day-selection bar chart above the timeline.

- Create API route for fetching daily summaries (count per intensity per day, for a date range)
- Build the horizontally scrollable stacked bar chart component
- Implement snap-to-center behavior with smooth scrolling
- Show selected day indicator (arrow/highlight on centered bar)
- Add legend below the bars showing per-type counts for the selected day
- Wire carousel selection to update the timeline below

**Working state:** User can browse between days via the carousel and see that day's timeline.

---

## Step 4: Undo toast

Add the ability to undo an accidental log.

- Show a toast for 3 seconds after logging a movement
- Tapping undo on the toast deletes the just-logged movement
- Create API route for deleting a movement (DELETE by id)

**Working state:** User can undo an accidental tap within 3 seconds.

---

## Step 5: Delete flow

Add the ability to delete any movement from the timeline.

- Tapping a timeline entry opens a popover with a delete button
- Tapping delete shows a confirmation dialog
- On confirm, the movement is deleted via the API (reuse from Step 4)
- The bar chart, legend, and timeline update to reflect the deletion

**Working state:** User can delete any movement from the history.

---

## Step 6: Timeline polish

Refine the timeline's spacing, scroll behavior, and visual cues.

- Implement proportional spacing between entries with min/max clamps
- Position hour markers according to the same proportional logic
- On load for today: scroll to center on the current time
- On load for past days: scroll to center on the first entry
- Add a live-updating "now" marker on the timeline (today only)
- Add visual fade-out at the top and bottom edges
- Add off-screen indicators ("X earlier" / "X later") that update on scroll

**Working state:** The timeline feels polished with natural spacing and clear context.

---

## Step 7: PWA

Make the app installable on mobile home screens.

- Add web app manifest (name: "Movemonitor", standalone display mode)
- Create an app icon
- Verify install-to-home-screen flow on iOS and Android

**Working state:** User can install the app to their home screen and use it without browser chrome.

---

## Step 8: Docker

Package the app for deployment on the home server.

- Create Dockerfile using Next.js standalone output
- Configure to start with `node server.js` and bind to `0.0.0.0`
- Copy `.next/static` and `public` into the image
- Mount volume for SQLite database at `/app/data/`
- Verify data persists across container restarts

**Working state:** The app runs as a Docker container on the home server with persistent data.

---

## Step 9: Visual polish

Apply the final visual design pass.

- Implement warm, soft color palette (soft pastels)
- Add rounded shapes and comfortable spacing
- Add button animations (pulse, ripple, or color change) on the Log screen
- Choose colors for the three bar chart segments (one per intensity type)
- Overall typography and layout refinement for mobile

**Working state:** The app looks and feels finished — calming, friendly, and polished.
