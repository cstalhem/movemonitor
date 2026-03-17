const TZ = "Europe/Stockholm";

export function todayInStockholm(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function stockholmDayRange(day: string): { start: string; end: string } {
  const getStockholmMidnightUTC = (dateStr: string): string => {
    const [year, month, dayNum] = dateStr.split("-").map(Number);

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const getLocalParts = (d: Date) => {
      const parts = formatter.formatToParts(d);
      const get = (type: string) => parts.find((p) => p.type === type)!.value;
      return {
        hour: parseInt(get("hour"), 10),
        minute: parseInt(get("minute"), 10),
        second: parseInt(get("second"), 10),
      };
    };

    // First guess: midnight UTC on that day (close to Stockholm midnight)
    const guess = new Date(Date.UTC(year, month - 1, dayNum, 0, 0, 0));
    let local = getLocalParts(guess);
    let localMs = (local.hour * 3600 + local.minute * 60 + local.second) * 1000;
    // Adjust: subtract the local time offset to get to midnight Stockholm
    let midnight = new Date(guess.getTime() - localMs);

    // Verify: the offset might differ at the computed midnight vs at the guess
    // Re-check using the computed midnight time
    local = getLocalParts(midnight);
    if (local.hour !== 0 || local.minute !== 0) {
      localMs = (local.hour * 3600 + local.minute * 60 + local.second) * 1000;
      midnight = new Date(midnight.getTime() - localMs);
    }

    return midnight.toISOString();
  };

  // Compute next day string
  const [y, m, d] = day.split("-").map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
  const nextDayStr = nextDay.toISOString().slice(0, 10);

  return {
    start: getStockholmMidnightUTC(day),
    end: getStockholmMidnightUTC(nextDayStr),
  };
}

export function offsetDay(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function formatDayLabel(day: string, today: string): string {
  if (day === today) return "Idag";
  if (day === offsetDay(today, -1)) return "Igår";
  const date = new Date(`${day}T12:00:00Z`);
  return date.toLocaleDateString("sv-SE", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const date = new Date(`${s}T12:00:00Z`);
  if (isNaN(date.getTime())) return false;
  const [year, month, day] = s.split("-").map(Number);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("sv-SE", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}
