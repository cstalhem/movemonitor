# Movemonitor

Baby movement tracker — a simple web app where a pregnant person can press a button to log when they feel the baby move. Displays a history of movements by date and time.

## Tech Stack

- **Frontend/Backend:** Next.js (App Router), TypeScript
- **Database:** SQLite (via better-sqlite3)
- **Runtime:** Bun
- **Deployment:** Docker (standalone output) on home server
- **Version control:** GitHub

## Design Assumptions

- Single-user application — no authentication required
- Mobile-first UI — primary interaction is a large tap target
- Self-hosted on a home server via Docker
- SQLite is sufficient — no need for a separate database server

## Key Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server
bun run build        # Production build
bun run lint         # Lint
docker build -t movemonitor .   # Build Docker image
docker run -p 3000:3000 -v movemonitor-data:/app/data movemonitor  # Run container
```

# Knowledge System

The purpose of this system is to make each change to the code simpler than the last, by continually capturing gotchas, patterns, and decisions as they're discovered.

Project knowledge lives in three tiers. Each has a distinct purpose and update trigger.

| Tier        | Location                | Loads                | Contains                                               |
| ----------- | ----------------------- | -------------------- | ------------------------------------------------------ |
| Orientation | `CLAUDE.md` (this file) | Always               | Project structure, commands, design assumptions        |
| Rules       | `.claude/rules/`        | Always (path-scoped) | Concise do/don't rules                                 |
| Skills      | `.claude/skills/`       | On demand            | Deep reference: examples, anti-patterns, decision aids |

**Staging area** — the project-specific `MEMORY.md` (at `.claude/projects/<project-hash>/MEMORY.md`) holds unvalidated learnings discovered during work. This file is stable regardless of git worktree, so always use it even when working from a worktree.

**Critical patterns** — `.claude/rules/critical-patterns.md` captures high-impact WRONG/CORRECT patterns for mistakes that break builds, cause data loss, or create security issues.

### Workflow checkpoints

- **Before non-trivial tasks:** Scan `.claude/rules/` (including `critical-patterns.md`) and `.claude/skills/` for knowledge relevant to the task at hand. Skip for trivial changes (typos, copy edits, color tweaks, one-line fixes).
- **After completing tasks:** Check if anything discovered during the task should be staged in `MEMORY.md`.

### Updating the knowledge system

When you discover something worth capturing during work:

1. **Caused by a mistake or gotcha?** → Add a one-line rule to the relevant file in `.claude/rules/`. Update the matching skill's Anti-Patterns section with the full context (what went wrong, why, the fix).
2. **High-impact mistake (build-breaking, data loss, security)?** → Add a WRONG/CORRECT entry to `.claude/rules/critical-patterns.md`.
3. **New pattern, example, or decision aid?** → Update the relevant skill in `.claude/skills/`.
4. **New topic not covered by any existing skill?** → Create a new skill directory with `SKILL.md`. Keep description under 200 chars.
5. **Not validated yet?** → Add an entry to the project's `MEMORY.md` with date, context, and structured tags: `[type:gotcha|pattern|decision]`, `[area:<project-area>]`. Add `[promotion-candidate]` when the pattern recurs across 2+ sessions.

### Cross-referencing

- Rules reference backing skills: `(see skill: skill-name)` for deeper context.
- Skills reference the rules they support for quick lookup.

### Proactive maintenance

- After fixing a bug caused by a missing rule, suggest adding the rule.
- After a session where a skill would have prevented confusion, suggest updating it.
- When `MEMORY.md` staging entries have been validated across 2+ sessions, suggest promotion.
- When a rule or skill leads to incorrect behavior, flag it: critical issues → propose a direct fix (with user approval), minor issues → stage the correction in `MEMORY.md` with `[type:gotcha]` and `[promotion-candidate]` tags.
- Keep rules to one line each — no code examples, no rationale (that belongs in skills).
- Keep skill content timeless — no phase numbers, plan numbers, or session-specific context.
- Surface lint/type/test errors immediately rather than deferring them.
