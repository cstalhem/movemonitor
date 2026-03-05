---
description: "Docker deployment rules for Next.js standalone"
paths: ["Dockerfile", "docker-compose*", ".dockerignore"]
---

# Docker

- Use `output: 'standalone'` in next.config and start with `node server.js`, not `next start`
- COPY `.next/static` and `public` separately — standalone output excludes them
- Set `ENV HOSTNAME="0.0.0.0"` — without it the server binds to localhost only and is unreachable
- Mount a volume for the SQLite database file so data persists across container restarts
- NEXT_PUBLIC_* vars are baked in at build time — use server-side env vars for runtime configuration
