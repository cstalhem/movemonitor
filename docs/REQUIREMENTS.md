# Movemonitor — Requirements

## Overview

A simple web app for tracking baby movements during pregnancy. The primary user taps a button whenever they feel the baby move. The app logs the movement and displays a history with basic statistics.

**Primary user:** Partner (single user, no accounts)
**Platform:** Mobile browser, installed as a PWA
**Hosting:** Self-hosted on a home server via Docker

---

## UI Structure

The app has two screens, navigated via a floating action bar at the bottom of the screen:

- **Log** — The main screen with three large buttons for logging movement intensity.
- **History** — A day-by-day view with a bar chart carousel and a daily timeline.

---

## Functional Requirements

### FR-1: Log a movement

The Log screen presents three large, prominent buttons — one for each movement intensity:

- **Mycket** (a lot)
- **Mellan** (medium)
- **Lite** (a little)

Tapping any button logs the current timestamp together with the selected intensity. The interaction must be fast and frictionless — one tap, instantly recorded.

**Acceptance criteria:**
- Tapping a button sends a request to the server and persists the movement with its intensity
- The button plays a subtle animation (pulse, ripple, or color change) as immediate feedback
- An undo toast appears for 3 seconds after logging, allowing the user to reverse an accidental tap
- The buttons are large enough to tap comfortably on a phone without precise aim
- The Log screen shows only the three buttons — no counters, stats, or other information

**Empty state:** On first use (no data), the Log screen looks identical — just the buttons. The History screen shows a friendly "no movements yet" message.

### FR-2: Movement history

The History screen has two sections: a **day carousel** at the top and a **daily timeline** below.

#### Day carousel (top ~1/5 of screen)

A horizontally scrollable row of stacked bar charts — one bar per day. Each bar has three colored segments representing the count of each intensity type (Mycket, Mellan, Lite). The selected day is the bar centered on screen, indicated by a visual marker (e.g., an arrow or highlight).

**Behavior:**
- On load, today is the selected day, shown as the rightmost bar with several previous days visible to its left
- The user scrolls left to go back in time, right to go forward
- The carousel snaps to the nearest bar: if the user releases the scroll between two bars, the closest bar smoothly animates to the center position
- The selected day's data drives both the legend and the timeline below
- Below the bar row, a legend displays the count per intensity type for the selected day

#### Daily timeline (bottom ~4/5 of screen)

A vertically scrollable timeline for the selected day. The timeline runs from 00:00 at the top to 23:59 at the bottom.

**Layout:**
- A vertical line runs along the left side with hour markers (00:00 at top, 23:59 at bottom)
- Each logged movement appears as a dot on the line, with the timestamp and intensity label ("Mycket", "Mellan", or "Lite") to the right

**Spacing:**
- The vertical distance between consecutive entries is proportional to the time elapsed between them, subject to a minimum gap (to prevent overlap) and a maximum gap (to prevent wasteful empty space)
- Hour markers are positioned according to the same proportional logic, not at fixed intervals

**Scroll behavior:**
- On load for today, the timeline scrolls so that the current time is vertically centered in the visible area
- On load for past days, the timeline scrolls so that the first entry of that day is vertically centered
- A "now" marker is shown on the timeline at the current time and updates live (today only)
- The timeline visually fades out at the top and bottom edges

**Off-screen indicators:**
- If there are entries above or below the visible area, a label (e.g., "3 earlier" / "2 later") appears at the top or bottom edge
- The count adjusts as entries scroll into or out of view

**Acceptance criteria:**
- The timeline updates dynamically when the user selects a different day in the carousel
- If no movements exist for the selected day, a friendly empty-state message is shown

**Day boundary:** Days are grouped by calendar date using midnight (00:00) as the boundary. The server timezone is used (single-timezone assumption).

### FR-3: Delete a movement

The user can delete individual logged movements from the daily timeline.

**Acceptance criteria:**
- Tapping a movement entry on the timeline opens a popover with a delete button
- Tapping delete shows a confirmation dialog before proceeding
- Deletion removes the movement from the database
- The bar chart and legend update to reflect the deletion

### FR-4: PWA / installable

The app can be "installed" on a phone's home screen for an app-like experience.

**Acceptance criteria:**
- Includes a web app manifest with name "Movemonitor" and appropriate metadata
- Displays without browser chrome (standalone mode) when launched from the home screen
- Has an appropriate app icon

---

## Non-Functional Requirements

### NFR-1: Mobile-first design

The UI is designed for phone screens as the primary form factor. Desktop should work but is not the priority.

### NFR-2: Visual style — warm and soft

The design uses gentle, calming colors with rounded shapes. Soft pastels, comfortable spacing, friendly feel — appropriate for the context of pregnancy.

### NFR-3: Performance

Logging a movement should feel instant. The tap-to-confirmation loop should complete in under 500ms on a normal connection.

### NFR-4: Deployment

- Runs as a Docker container with a volume-mounted SQLite database
- No external database server required
- Data persists across container restarts via the mounted volume

### NFR-5: Simplicity

The codebase should remain simple and maintainable. No unnecessary abstractions, no over-engineering. SQLite is sufficient. A single Next.js app handles both frontend and API.

---

## Out of Scope

These are explicitly **not** part of this project:

- **Authentication / multi-user** — no login, no user accounts, no sharing
- **Data export** — no CSV, PDF, or other export functionality
- **Contraction timing** — this app tracks movements only
- **Medical advice** — no interpretation of patterns, no guidance, no alerts
- **Notifications / reminders** — the app is purely passive
- **Offline support** — requires a connection to the home server
