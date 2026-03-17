import { describe, it, expect } from "vitest";
import { groupByDay } from "./day-counts";

describe("groupByDay", () => {
  it("returns all-zero entries for empty rows", () => {
    const result = groupByDay([], "2026-03-13", "2026-03-15");
    expect(result).toEqual([
      { day: "2026-03-13", mycket: 0, mellan: 0, lite: 0 },
      { day: "2026-03-14", mycket: 0, mellan: 0, lite: 0 },
      { day: "2026-03-15", mycket: 0, mellan: 0, lite: 0 },
    ]);
  });

  it("counts intensities for a single day", () => {
    const rows = [
      { intensity: "mycket", occurred_at: "2026-03-14T10:00:00Z" },
      { intensity: "mycket", occurred_at: "2026-03-14T11:00:00Z" },
      { intensity: "lite", occurred_at: "2026-03-14T12:00:00Z" },
    ];
    const result = groupByDay(rows, "2026-03-14", "2026-03-14");
    expect(result).toEqual([
      { day: "2026-03-14", mycket: 2, mellan: 0, lite: 1 },
    ]);
  });

  it("groups rows across multiple days", () => {
    const rows = [
      { intensity: "mycket", occurred_at: "2026-03-13T10:00:00Z" },
      { intensity: "mellan", occurred_at: "2026-03-14T08:00:00Z" },
      { intensity: "lite", occurred_at: "2026-03-15T14:00:00Z" },
    ];
    const result = groupByDay(rows, "2026-03-13", "2026-03-15");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      day: "2026-03-13",
      mycket: 1,
      mellan: 0,
      lite: 0,
    });
    expect(result[1]).toEqual({
      day: "2026-03-14",
      mycket: 0,
      mellan: 1,
      lite: 0,
    });
    expect(result[2]).toEqual({
      day: "2026-03-15",
      mycket: 0,
      mellan: 0,
      lite: 1,
    });
  });

  it("fills missing days with zeros", () => {
    const rows = [
      { intensity: "mycket", occurred_at: "2026-03-13T10:00:00Z" },
      // No rows for 2026-03-14
      { intensity: "lite", occurred_at: "2026-03-15T14:00:00Z" },
    ];
    const result = groupByDay(rows, "2026-03-13", "2026-03-15");
    expect(result[1]).toEqual({
      day: "2026-03-14",
      mycket: 0,
      mellan: 0,
      lite: 0,
    });
  });

  it("assigns midnight-boundary rows to correct Stockholm date", () => {
    // 2026-03-14 in CET: midnight Stockholm = 2026-03-13T23:00:00Z
    // So an event at 2026-03-13T23:30:00Z is actually 2026-03-14 00:30 Stockholm time
    const rows = [{ intensity: "mellan", occurred_at: "2026-03-13T23:30:00Z" }];
    const result = groupByDay(rows, "2026-03-13", "2026-03-14");
    // Should be counted in 2026-03-14 (Stockholm time), not 2026-03-13
    expect(result[0]).toEqual({
      day: "2026-03-13",
      mycket: 0,
      mellan: 0,
      lite: 0,
    });
    expect(result[1]).toEqual({
      day: "2026-03-14",
      mycket: 0,
      mellan: 1,
      lite: 0,
    });
  });

  it("handles single-day range", () => {
    const result = groupByDay([], "2026-03-15", "2026-03-15");
    expect(result).toEqual([
      { day: "2026-03-15", mycket: 0, mellan: 0, lite: 0 },
    ]);
  });

  it("ignores unknown intensity values", () => {
    const rows = [
      { intensity: "unknown", occurred_at: "2026-03-14T10:00:00Z" },
    ];
    const result = groupByDay(rows, "2026-03-14", "2026-03-14");
    expect(result).toEqual([
      { day: "2026-03-14", mycket: 0, mellan: 0, lite: 0 },
    ]);
  });
});
