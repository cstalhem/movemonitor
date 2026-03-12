import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { createDb } from "./db";

describe("createDb", () => {
  it("creates movements table on init", () => {
    const db = createDb(":memory:");
    const row = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='movements'"
      )
      .get() as { name: string } | undefined;
    expect(row?.name).toBe("movements");
    db.close();
  });

  it("creates index on created_at", () => {
    const db = createDb(":memory:");
    const row = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_movements_created_at'"
      )
      .get() as { name: string } | undefined;
    expect(row?.name).toBe("idx_movements_created_at");
    db.close();
  });

  it("sets WAL mode on file-based DB", () => {
    // In-memory databases always return 'memory' for journal_mode,
    // so we test WAL on a file-based DB in a temp directory.
    const dir = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "db-test-"));
    const db = createDb(join(dir, "test.db"));
    const result = db.pragma("journal_mode") as { journal_mode: string }[];
    expect(result[0].journal_mode).toBe("wal");
    db.close();
  });

  it("sets user_version to 1", () => {
    const db = createDb(":memory:");
    const result = db.pragma("user_version") as { user_version: number }[];
    expect(result[0].user_version).toBe(1);
    db.close();
  });
});
