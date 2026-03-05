---
description: "SQLite and better-sqlite3 usage rules"
paths: ["**/*.ts", "**/*.tsx"]
---

# Database

- Enable WAL mode (`PRAGMA journal_mode=WAL`) to prevent SQLITE_BUSY errors under concurrent access
- Use a singleton database connection — never open multiple handles to the same file
- Keep queries fast — better-sqlite3 is synchronous and blocks the Node.js event loop
- Store the database file outside the app directory (e.g., `/app/data/movemonitor.db`) for Docker volume mounting
