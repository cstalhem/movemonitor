---
description: "General project conventions"
paths: ["**"]
---

# General

- Use `bun` or `bunx`, never `npm` or `npx`
- Multi-user app — use Supabase Auth (email OTP) and RLS for data isolation, don't add RBAC or roles
- Mobile-first UI — the primary interaction is tapping a large button
- Use red/green TDD — write failing tests first, then implement to make them pass
- Use shadcn/ui semantic color tokens (`bg-primary`, `text-muted-foreground`, `bg-card`, etc.) — never hardcoded color classes (`bg-blue-200`)
- Use `cn()` from `@/lib/utils` for conditional className composition
