import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { todayInStockholm, stockholmDayRange, formatTime } from "./date";

describe("todayInStockholm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns YYYY-MM-DD format", () => {
    vi.setSystemTime(new Date("2026-03-12T10:00:00Z"));
    const result = todayInStockholm();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe("2026-03-12");
  });
});

describe("formatTime", () => {
  it("returns HH:mm format", () => {
    const result = formatTime("2026-03-12T08:23:00Z");
    expect(result).toBe("09:23");
  });

  it("handles timezone conversion from UTC midnight", () => {
    const result = formatTime("2026-03-12T00:00:00Z");
    expect(result).toBe("01:00");
  });

  it("at spring-forward DST boundary", () => {
    // 2026-03-29: CET→CEST, clocks jump from 02:00 to 03:00
    expect(formatTime("2026-03-29T00:30:00Z")).toBe("01:30"); // Still CET
    expect(formatTime("2026-03-29T01:00:00Z")).toBe("03:00"); // CEST kicks in
  });

  it("at fall-back DST boundary", () => {
    // 2026-10-25: CEST→CET, clocks fall back at 03:00 CEST (01:00 UTC) to 02:00 CET
    expect(formatTime("2026-10-25T00:30:00Z")).toBe("02:30"); // CEST before fall-back
    // After fall-back: 02:30 UTC = 03:30 CET (UTC+1)
    expect(formatTime("2026-10-25T02:30:00Z")).toBe("03:30"); // CET after fall-back
  });
});

describe("stockholmDayRange", () => {
  it("returns correct UTC boundaries for a normal CET day", () => {
    const range = stockholmDayRange("2026-03-12");
    expect(range.start).toBe("2026-03-11T23:00:00.000Z");
    expect(range.end).toBe("2026-03-12T23:00:00.000Z");
  });

  it("handles spring-forward DST", () => {
    // 2026-03-29: CET→CEST transition, 23-hour day
    const range = stockholmDayRange("2026-03-29");
    expect(range.start).toBe("2026-03-28T23:00:00.000Z"); // midnight in CET (UTC+1)
    expect(range.end).toBe("2026-03-29T22:00:00.000Z"); // midnight in CEST (UTC+2)
  });

  it("handles fall-back DST", () => {
    // 2026-10-25: CEST→CET transition, 25-hour day
    const range = stockholmDayRange("2026-10-25");
    expect(range.start).toBe("2026-10-24T22:00:00.000Z"); // midnight in CEST (UTC+2)
    expect(range.end).toBe("2026-10-25T23:00:00.000Z"); // midnight in CET (UTC+1)
  });
});
