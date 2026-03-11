---
description: "General project conventions"
paths: ["**"]
---

# General

- Use `bun` or `bunx`, never `npm` or `npx`
- This is a single-user app — don't over-engineer with auth, RBAC, or multi-tenancy
- Mobile-first UI — the primary interaction is tapping a large button
- Use red/green TDD — write failing tests first, then implement to make them pass
- Use semantic Tailwind color tokens (`bg-primary`, `text-accent`, etc.) — never hardcoded color classes (`bg-blue-200`)
