import { describe, it, expect, vi } from "vitest";
import { type Movement } from "./movements";
import { type TimelineItem } from "./timeline";

vi.mock("@/lib/date", () => ({
  minuteOfDayInStockholm: vi.fn((iso: string) => {
    const map: Record<string, number> = {
      "2026-03-12T08:23:00Z": 563, // 09:23 CET
      "2026-03-12T10:45:00Z": 705, // 11:45 CET
      "2026-03-12T14:12:00Z": 912, // 15:12 CET
      "2026-03-12T09:01:00Z": 601, // 10:01 CET (near hour boundary)
    };
    return map[iso] ?? 0;
  }),
}));

import { gapPx, buildTimelineItems, buildMaskImage } from "./timeline";

const movements: Movement[] = [
  { id: "1", intensity: "mycket", occurred_at: "2026-03-12T08:23:00Z" },
  { id: "2", intensity: "mellan", occurred_at: "2026-03-12T10:45:00Z" },
  { id: "3", intensity: "lite", occurred_at: "2026-03-12T14:12:00Z" },
];

// ─── gapPx ───────────────────────────────────────────────────

describe("gapPx", () => {
  it("returns MIN_GAP_PX for 0 minutes", () => {
    expect(gapPx(0)).toBe(16);
  });

  it("returns MAX_GAP_PX at baseline (240 min)", () => {
    expect(gapPx(240)).toBe(84);
  });

  it("clamps above baseline", () => {
    expect(gapPx(500)).toBe(84);
  });

  it("interpolates for 60 minutes", () => {
    expect(gapPx(60)).toBeCloseTo(50, 0);
  });

  it("is monotonically increasing", () => {
    expect(gapPx(30)).toBeLessThan(gapPx(60));
    expect(gapPx(60)).toBeLessThan(gapPx(120));
  });
});

// ─── buildTimelineItems ──────────────────────────────────────

describe("buildTimelineItems", () => {
  it("returns all 3 movements sorted by minuteOfDay", () => {
    const items = buildTimelineItems(movements, false, 0);
    const movementItems = items.filter(
      (i: TimelineItem) => i.type === "movement",
    );
    expect(movementItems).toHaveLength(3);
    expect(movementItems[0].minuteOfDay).toBe(563);
    expect(movementItems[1].minuteOfDay).toBe(705);
    expect(movementItems[2].minuteOfDay).toBe(912);
  });

  it("adds hour markers within the activity bracket", () => {
    const items = buildTimelineItems(movements, false, 0);
    const hours = items
      .filter((i: TimelineItem) => i.type === "hour")
      .map(
        (i: TimelineItem) =>
          (i as { type: "hour"; hour: number; minuteOfDay: number }).hour,
      );
    // bracket 563..912, startHour=9, endHour=floor(912/60)+1=16
    // hours: 9(540), 10(600), 11(660), 12(720), 13(780), 14(840), 15(900), 16(960)
    // 900 is within 2 min of 912? |912-900|=12, not suppressed
    expect(hours).toContain(9);
    expect(hours).toContain(10);
    expect(hours).toContain(11);
    expect(hours).toContain(12);
    expect(hours).toContain(13);
    expect(hours).toContain(14);
    expect(hours).toContain(15);
    expect(hours).toContain(16);
  });

  it("suppresses hour marker within 2 min of a movement", () => {
    // Movement at 601, hour 10 = 600 → |601-600|=1 < 2 → suppressed
    const movementsWithNearHour: Movement[] = [
      { id: "1", intensity: "mycket", occurred_at: "2026-03-12T08:23:00Z" },
      { id: "4", intensity: "lite", occurred_at: "2026-03-12T09:01:00Z" },
    ];
    const items = buildTimelineItems(movementsWithNearHour, false, 0);
    const hours = items
      .filter((i: TimelineItem) => i.type === "hour")
      .map(
        (i: TimelineItem) =>
          (i as { type: "hour"; hour: number; minuteOfDay: number }).hour,
      );
    expect(hours).not.toContain(10); // 600 suppressed
  });

  it("includes now marker when isToday=true", () => {
    const items = buildTimelineItems(movements, true, 700);
    const nowItems = items.filter((i: TimelineItem) => i.type === "now");
    expect(nowItems).toHaveLength(1);
    expect(nowItems[0].minuteOfDay).toBe(700);
  });

  it("excludes now marker when isToday=false", () => {
    const items = buildTimelineItems(movements, false, 700);
    const nowItems = items.filter((i: TimelineItem) => i.type === "now");
    expect(nowItems).toHaveLength(0);
  });

  it("returns items sorted by minuteOfDay", () => {
    const items = buildTimelineItems(movements, true, 700);
    for (let i = 1; i < items.length; i++) {
      expect(items[i].minuteOfDay).toBeGreaterThanOrEqual(
        items[i - 1].minuteOfDay,
      );
    }
  });

  it("single movement produces bracketing hour markers", () => {
    const single: Movement[] = [
      { id: "1", intensity: "mycket", occurred_at: "2026-03-12T08:23:00Z" },
    ];
    const items = buildTimelineItems(single, false, 0);
    const hours = items
      .filter((i: TimelineItem) => i.type === "hour")
      .map(
        (i: TimelineItem) =>
          (i as { type: "hour"; hour: number; minuteOfDay: number }).hour,
      );
    // bracket 563..563 → startHour=9, endHour=floor(563/60)+1=10
    expect(hours).toContain(9);
    expect(hours).toContain(10);
  });

  it("extends hour bracket to cover now marker", () => {
    const items = buildTimelineItems(movements, true, 1020);
    const hours = items
      .filter((i: TimelineItem) => i.type === "hour")
      .map(
        (i: TimelineItem) =>
          (i as { type: "hour"; hour: number; minuteOfDay: number }).hour,
      );
    // bracket extends to 1020, endHour=floor(1020/60)+1=18
    expect(hours).toContain(17);
  });

  it("returns [] for empty movements, not today", () => {
    const items = buildTimelineItems([], false, 0);
    expect(items).toEqual([]);
  });

  it("returns just now marker for empty movements, isToday", () => {
    const items = buildTimelineItems([], true, 700);
    expect(items).toEqual([{ type: "now", minuteOfDay: 700 }]);
  });
});

// ─── buildMaskImage ──────────────────────────────────────────

describe("buildMaskImage", () => {
  it("returns undefined when no scroll in either direction", () => {
    expect(buildMaskImage(false, false)).toBeUndefined();
  });

  it("returns top fade when canScrollUp", () => {
    const result = buildMaskImage(true, false);
    expect(result).toContain("transparent 0");
  });

  it("returns bottom fade when canScrollDown", () => {
    const result = buildMaskImage(false, true);
    expect(result).toContain("transparent 100%");
  });

  it("returns both fades when both directions", () => {
    const result = buildMaskImage(true, true);
    expect(result).toContain("transparent 0");
    expect(result).toContain("transparent 100%");
  });
});
