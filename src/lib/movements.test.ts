import { describe, it, expect } from "vitest";
import { createDb } from "./db";
import { createMovement } from "./movements";

describe("createMovement", () => {
  it("creates movement with 'mycket'", () => {
    const db = createDb(":memory:");
    createMovement("mycket", db);
    const row = db
      .prepare("SELECT intensity FROM movements WHERE id = 1")
      .get() as { intensity: string };
    expect(row.intensity).toBe("mycket");
    db.close();
  });

  it("creates movement with 'mellan'", () => {
    const db = createDb(":memory:");
    createMovement("mellan", db);
    const row = db
      .prepare("SELECT intensity FROM movements WHERE id = 1")
      .get() as { intensity: string };
    expect(row.intensity).toBe("mellan");
    db.close();
  });

  it("creates movement with 'lite'", () => {
    const db = createDb(":memory:");
    createMovement("lite", db);
    const row = db
      .prepare("SELECT intensity FROM movements WHERE id = 1")
      .get() as { intensity: string };
    expect(row.intensity).toBe("lite");
    db.close();
  });

  it("returns the movement id", () => {
    const db = createDb(":memory:");
    const result = createMovement("mycket", db);
    expect(result.id).toBeGreaterThan(0);
    expect(Number.isInteger(result.id)).toBe(true);
    db.close();
  });

  it("stores valid ISO 8601 timestamp with offset", () => {
    const db = createDb(":memory:");
    createMovement("mycket", db);
    const row = db
      .prepare("SELECT created_at FROM movements WHERE id = 1")
      .get() as { created_at: string };
    expect(row.created_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/
    );
    db.close();
  });

  it("rejects invalid intensity", () => {
    const db = createDb(":memory:");
    expect(() => createMovement("invalid", db)).toThrow();
    db.close();
  });
});
