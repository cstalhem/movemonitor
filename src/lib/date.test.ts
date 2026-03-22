import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  todayInStockholm,
  stockholmDayRange,
  formatTime,
  offsetDay,
  formatDayLabel,
  isValidDateString,
  minuteOfDayInStockholm,
  nowMinuteInStockholm,
} from "./date";

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

describe("offsetDay", () => {
  it("returns same day for offset 0", () => {
    expect(offsetDay("2026-03-15", 0)).toBe("2026-03-15");
  });

  it("moves backward by 1 day", () => {
    expect(offsetDay("2026-03-15", -1)).toBe("2026-03-14");
  });

  it("moves forward by 7 days", () => {
    expect(offsetDay("2026-03-15", 7)).toBe("2026-03-22");
  });

  it("handles month boundary", () => {
    expect(offsetDay("2026-04-01", -1)).toBe("2026-03-31");
  });

  it("handles DST spring-forward", () => {
    // 2026-03-29 is a 23-hour day in Stockholm — offsetDay must still work
    expect(offsetDay("2026-03-29", -1)).toBe("2026-03-28");
    expect(offsetDay("2026-03-28", 1)).toBe("2026-03-29");
  });

  it("moves backward by 13 days", () => {
    expect(offsetDay("2026-03-15", -13)).toBe("2026-03-02");
  });
});

describe("formatDayLabel", () => {
  it('returns "Idag" for today', () => {
    expect(formatDayLabel("2026-03-15", "2026-03-15")).toBe("Idag");
  });

  it('returns "Igår" for yesterday', () => {
    expect(formatDayLabel("2026-03-14", "2026-03-15")).toBe("Igår");
  });

  it("returns Swedish short date for other days", () => {
    const result = formatDayLabel("2026-03-11", "2026-03-15");
    // Should be like "ons 11 mar" (Swedish weekday short + day + month short)
    expect(result).toMatch(/\w+ 11 mar/);
  });
});

describe("isValidDateString", () => {
  it("accepts valid dates", () => {
    expect(isValidDateString("2026-03-15")).toBe(true);
    expect(isValidDateString("2026-02-28")).toBe(true);
    expect(isValidDateString("2024-02-29")).toBe(true); // leap year
  });

  it("rejects malformed strings", () => {
    expect(isValidDateString("not-a-date")).toBe(false);
    expect(isValidDateString("")).toBe(false);
    expect(isValidDateString("2026-3-15")).toBe(false);
  });

  it("rejects impossible dates", () => {
    expect(isValidDateString("2026-02-29")).toBe(false); // not a leap year
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("2026-02-30")).toBe(false);
  });
});

describe("minuteOfDayInStockholm", () => {
  it("returns correct minute for a normal CET time", () => {
    // 08:23 UTC = 09:23 CET → 9*60+23 = 563
    expect(minuteOfDayInStockholm("2026-03-12T08:23:00Z")).toBe(563);
  });

  it("returns 0 for Stockholm midnight", () => {
    // 23:00 UTC = 00:00 CET (next day)
    expect(minuteOfDayInStockholm("2026-03-11T23:00:00Z")).toBe(0);
  });

  it("returns 1439 for 23:59 Stockholm", () => {
    // 22:59 UTC = 23:59 CET → 23*60+59 = 1439
    expect(minuteOfDayInStockholm("2026-03-12T22:59:00Z")).toBe(1439);
  });

  it("handles DST spring-forward", () => {
    // 2026-03-29: CET→CEST, 02:00 skipped to 03:00
    // 01:00 UTC = 03:00 CEST → 3*60 = 180
    expect(minuteOfDayInStockholm("2026-03-29T01:00:00Z")).toBe(180);
  });

  it("handles DST fall-back", () => {
    // 2026-10-25: CEST→CET at 03:00 CEST (01:00 UTC)
    // 00:30 UTC = 02:30 CEST (before fall-back) → 2*60+30 = 150
    expect(minuteOfDayInStockholm("2026-10-25T00:30:00Z")).toBe(150);
  });
});

describe("nowMinuteInStockholm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns minuteOfDay for the current time", () => {
    vi.setSystemTime(new Date("2026-03-12T08:23:00Z"));
    expect(nowMinuteInStockholm()).toBe(563);
  });
});
