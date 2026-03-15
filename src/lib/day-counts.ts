export type DayCount = {
  day: string;
  mycket: number;
  mellan: number;
  lite: number;
};

const VALID_INTENSITIES = ["mycket", "mellan", "lite"] as const;
type Intensity = (typeof VALID_INTENSITIES)[number];

export function groupByDay(
  rows: Array<{ intensity: string; occurred_at: string }>,
  startDay: string,
  endDay: string,
): DayCount[] {
  // 1. Generate full day range using UTC-noon arithmetic
  const days: string[] = [];
  const cursor = new Date(`${startDay}T12:00:00Z`);
  const last = new Date(`${endDay}T12:00:00Z`);
  while (cursor <= last) {
    days.push(cursor.toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" }));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // 2. Create map with zero counts for every day
  const map = new Map<string, DayCount>();
  for (const day of days) {
    map.set(day, { day, mycket: 0, mellan: 0, lite: 0 });
  }

  // 3. Count each row into the correct day/intensity bucket
  for (const row of rows) {
    if (!VALID_INTENSITIES.includes(row.intensity as Intensity)) continue;

    const day = new Date(row.occurred_at).toLocaleDateString("sv-SE", {
      timeZone: "Europe/Stockholm",
    });

    const entry = map.get(day);
    if (entry) {
      entry[row.intensity as Intensity]++;
    }
  }

  // 4. Return sorted by day ascending
  return days.map((d) => map.get(d)!);
}
