---
description: "Deployment rules"
paths: ["next.config*", "vercel.json"]
---

# Deployment

- Deployed on Vercel — no Docker, no self-hosting
- Do not set `output: 'standalone'` — Vercel handles its own build output
- NEXT_PUBLIC_* vars are baked in at build time — set them in the Vercel dashboard
