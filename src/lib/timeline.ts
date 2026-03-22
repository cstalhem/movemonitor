import { type Movement } from "./movements";
import { minuteOfDayInStockholm } from "@/lib/date";

export type TimelineItem =
  | { type: "movement"; movement: Movement; minuteOfDay: number }
  | { type: "hour"; hour: number; minuteOfDay: number }
  | { type: "now"; minuteOfDay: number };

const MIN_GAP_PX = 16;
const MAX_GAP_PX = 84;
const BASELINE_MINUTES = 240;

export function gapPx(minutesBetween: number): number {
  const t = Math.min(minutesBetween / BASELINE_MINUTES, 1);
  return MIN_GAP_PX + Math.sqrt(t) * (MAX_GAP_PX - MIN_GAP_PX);
}

export function buildTimelineItems(
  movements: Movement[],
  isToday: boolean,
  nowMinute: number,
): TimelineItem[] {
  const movementItems: TimelineItem[] = movements.map((m) => ({
    type: "movement" as const,
    movement: m,
    minuteOfDay: minuteOfDayInStockholm(m.occurred_at),
  }));

  if (movementItems.length === 0 && !isToday) return [];
  if (movementItems.length === 0 && isToday)
    return [{ type: "now", minuteOfDay: nowMinute }];

  const movementMinutes = movementItems.map((i) => i.minuteOfDay);
  let bracketMin = Math.min(...movementMinutes);
  let bracketMax = Math.max(...movementMinutes);

  if (isToday) {
    bracketMin = Math.min(bracketMin, nowMinute);
    bracketMax = Math.max(bracketMax, nowMinute);
  }

  const startHour = Math.floor(bracketMin / 60);
  const endHour = Math.floor(bracketMax / 60) + 1;

  const items: TimelineItem[] = [...movementItems];

  for (let h = startHour; h <= endHour; h++) {
    const hourMinute = h * 60;
    const tooClose = movementMinutes.some((m) => Math.abs(m - hourMinute) < 2);
    if (!tooClose) {
      items.push({ type: "hour", hour: h, minuteOfDay: hourMinute });
    }
  }

  if (isToday) {
    items.push({ type: "now", minuteOfDay: nowMinute });
  }

  items.sort((a, b) => {
    if (a.minuteOfDay !== b.minuteOfDay) return a.minuteOfDay - b.minuteOfDay;
    if (a.type === "movement" && b.type === "movement") {
      return a.movement.occurred_at.localeCompare(b.movement.occurred_at);
    }
    return 0;
  });

  return items;
}

export function buildMaskImage(
  canScrollUp: boolean,
  canScrollDown: boolean,
): string | undefined {
  if (!canScrollUp && !canScrollDown) return undefined;
  const top = canScrollUp ? "transparent 0, black 32px" : "black 0, black 0";
  const bottom = canScrollDown
    ? "black calc(100% - 32px), transparent 100%"
    : "black 100%, black 100%";
  return `linear-gradient(to bottom, ${top}, ${bottom})`;
}
