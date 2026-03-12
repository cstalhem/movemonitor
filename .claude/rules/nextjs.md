---
description: "Next.js App Router patterns and sharp edges"
paths: ["**/*.ts", "**/*.tsx", "src/**", "app/**", "next.config*"]
---

# Next.js App Router

## Components

- Use App Router exclusively — no Pages Router patterns
- Import useRouter, usePathname, useSearchParams from `next/navigation`, not `next/router`
- Never pass event handlers or functions from Server Components to non-"use client" children
- Never import Server Components into Client Components — pass them as `children` props instead
- "use client" marks a boundary — all transitive imports become client bundle, so keep it narrow

## Data & Actions

- Use Server Components for data reads; use Server Actions for mutations only
- Use Server Components for initial/static data loads — introduce Route Handlers only when client-side interactions need dynamic fetching
- Never fetch your own Route Handlers from Server Components — call the underlying function directly
- Call redirect() only after revalidatePath/revalidateTag — redirect() throws and aborts execution
- Server Action arguments and return values must be serializable — no functions or class instances
- Server Actions are public HTTP endpoints — always validate authorization even if "only called from our form"

## Configuration

- `proxy.ts` is the session handler (Next.js 16 convention, replaces `middleware.ts`) — call `getUser()` immediately after creating the Supabase client
- In Next.js 15+, cookies(), headers(), params, searchParams are async — always await them
- Tailwind v4 uses CSS-first config (`@theme` in globals.css) — not `tailwind.config.ts`
- Use `h-dvh` not `h-screen` — Safari's `100vh` is taller than visible area
- Wrap Server Action calls in `useTransition` to get `isPending` and prevent double-submissions
