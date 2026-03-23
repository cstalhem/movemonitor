#!/usr/bin/env python3
"""
Generate realistic fetal movement seed data for the Movemonitor app.

Based on clinical literature:
- Peak frequency around week 32, gradual decline toward week 40
- Evening peak (21:00-23:00), morning trough (01:00-05:00)
- Post-meal activity bumps
- Day-to-day variance ~30-40% of mean
- Edge cases: very quiet days (8-10) and very active days (50-60+)

Output:
  1. Pipe-delimited CSV (seed_movements.csv) for inspection
  2. SQL file (seed.sql) with embedded VALUES for supabase db execute
"""

import random
import math
from datetime import datetime, timedelta, timezone

# ── Config ──────────────────────────────────────────────────────────────
DAYS_BACK = 90
EMAIL = "carl@stalhem.se"
OUTPUT_FILE = "supabase/seed_movements.csv"
SQL_OUTPUT_FILE = "supabase/seed.sql"

# Stockholm timezone (CET/CEST) — March is CET (+1), summer is CEST (+2)
# For simplicity, use +1 for winter months and +2 for summer months
# The cutover in 2026 is last Sunday of March (Mar 29)
CET = timezone(timedelta(hours=1))
CEST = timezone(timedelta(hours=2))

def stockholm_tz(dt: datetime) -> timezone:
    """Rough CET/CEST for 2026: CEST from last Sunday in March to last Sunday in October."""
    year = dt.year
    # Last Sunday in March
    mar31 = datetime(year, 3, 31)
    cest_start = mar31 - timedelta(days=(mar31.weekday() + 1) % 7)
    # Last Sunday in October
    oct31 = datetime(year, 10, 31)
    cest_end = oct31 - timedelta(days=(oct31.weekday() + 1) % 7)
    if cest_start.day <= dt.day and dt.month == 3 and dt.day >= cest_start.day:
        pass  # edge case, keep simple
    if (dt.month > 3 or (dt.month == 3 and dt.day >= cest_start.day)) and \
       (dt.month < 10 or (dt.month == 10 and dt.day < cest_end.day)):
        return CEST
    return CET


# ── Hourly activity weights ────────────────────────────────────────────
# Index = hour of day (Stockholm time). Weight 0-1, where 1 = peak.
HOURLY_WEIGHTS = [
    0.15, 0.10, 0.08, 0.05, 0.05, 0.10,  # 00-05: deep trough
    0.30, 0.55, 0.65, 0.50, 0.45, 0.50,  # 06-11: morning rise + post-breakfast
    0.65, 0.60, 0.45, 0.40, 0.45, 0.55,  # 12-17: post-lunch bump, afternoon
    0.70, 0.80, 0.90, 1.00, 0.95, 0.60,  # 18-23: evening peak at 21:00
]

# ── Weekly multiplier (gestational week → activity multiplier) ─────────
# We don't know the actual gestational week, so we model a curve that
# peaks ~30 days ago (simulating ~week 32) and tapers toward present.
def week_multiplier(days_ago: int) -> float:
    """Bell curve peaking at ~45 days ago (mid-point of 90-day window)."""
    peak_days_ago = 45
    sigma = 35
    return 0.75 + 0.25 * math.exp(-((days_ago - peak_days_ago) ** 2) / (2 * sigma ** 2))


# ── Intensity distribution ─────────────────────────────────────────────
# "mellan" is most common, "mycket" and "lite" are less frequent
INTENSITY_WEIGHTS = {
    "mellan": 0.50,
    "mycket": 0.25,
    "lite": 0.25,
}
INTENSITIES = list(INTENSITY_WEIGHTS.keys())
INTENSITY_CUM_WEIGHTS = list(INTENSITY_WEIGHTS.values())


def pick_intensity() -> str:
    return random.choices(INTENSITIES, weights=INTENSITY_CUM_WEIGHTS, k=1)[0]


# ── Edge case days ──────────────────────────────────────────────────────
# Pre-select some days for edge cases
def plan_edge_cases(total_days: int) -> dict[int, str]:
    """Returns {days_ago: 'quiet' | 'active'} for edge-case days."""
    edges: dict[int, str] = {}
    # 3-4 very quiet days (scattered)
    quiet_days = random.sample(range(2, total_days - 2), 3)
    for d in quiet_days:
        edges[d] = "quiet"
    # 2-3 very active days
    active_days = random.sample(
        [d for d in range(2, total_days - 2) if d not in quiet_days], 3
    )
    for d in active_days:
        edges[d] = "active"
    return edges


# ── Main generation ────────────────────────────────────────────────────
def generate() -> list[tuple[str, str]]:
    """Generate (intensity, occurred_at_iso) tuples."""
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    edge_cases = plan_edge_cases(DAYS_BACK)
    rows: list[tuple[str, str]] = []

    for days_ago in range(DAYS_BACK, 0, -1):
        day = today - timedelta(days=days_ago)
        tz = stockholm_tz(day)
        multiplier = week_multiplier(days_ago)

        # Base count: mean ~28, std ~8
        base_count = int(random.gauss(28, 8) * multiplier)

        # Apply edge cases
        edge = edge_cases.get(days_ago)
        if edge == "quiet":
            base_count = random.randint(4, 10)
        elif edge == "active":
            base_count = random.randint(50, 65)

        # Clamp
        base_count = max(3, min(70, base_count))

        # Distribute movements across hours using weighted random
        for _ in range(base_count):
            # Pick hour weighted by activity pattern
            hour = random.choices(range(24), weights=HOURLY_WEIGHTS, k=1)[0]
            minute = random.randint(0, 59)
            second = random.randint(0, 59)

            occurred = day.replace(hour=hour, minute=minute, second=second, tzinfo=tz)
            intensity = pick_intensity()

            rows.append((intensity, occurred.isoformat()))

    # Sort by timestamp
    rows.sort(key=lambda r: r[1])
    return rows


def write_csv(rows: list[tuple[str, str]]) -> None:
    with open(OUTPUT_FILE, "w") as f:
        f.write("intensity|occurred_at\n")
        for intensity, occurred_at in rows:
            f.write(f"{intensity}|{occurred_at}\n")


def write_sql(rows: list[tuple[str, str]]) -> None:
    values_lines = []
    for i, (intensity, occurred_at) in enumerate(rows):
        sep = "," if i < len(rows) - 1 else ";"
        values_lines.append(f"  ('{intensity}', '{occurred_at}'){sep}")

    sql = f"""\
-- Seed the movements table with dummy data
-- Generated by generate_seed_data.py — do not edit manually
-- Usage: supabase db execute --project-ref <ref> -f supabase/seed.sql

BEGIN;

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = '{EMAIL}';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User {EMAIL} not found in auth.users';
  END IF;

  -- Clean up previous seed data for this user
  DELETE FROM movements WHERE user_id = v_user_id;

  -- Load seed data via temp table
  CREATE TEMP TABLE _seed_movements (
    intensity TEXT,
    occurred_at TIMESTAMPTZ
  ) ON COMMIT DROP;

  INSERT INTO _seed_movements (intensity, occurred_at) VALUES
{chr(10).join(values_lines)}

  INSERT INTO movements (user_id, intensity, occurred_at)
  SELECT v_user_id, s.intensity, s.occurred_at
  FROM _seed_movements s;

  RAISE NOTICE 'Inserted % movements for user %', (SELECT count(*) FROM _seed_movements), v_user_id;
END $$;

COMMIT;
"""
    with open(SQL_OUTPUT_FILE, "w") as f:
        f.write(sql)


def main():
    random.seed(42)  # Reproducible output
    rows = generate()

    write_csv(rows)
    write_sql(rows)

    print(f"Generated {len(rows)} movements across {DAYS_BACK} days")
    print(f"  CSV: {OUTPUT_FILE}")
    print(f"  SQL: {SQL_OUTPUT_FILE}")

    # Quick stats
    from collections import Counter
    intensities = Counter(r[0] for r in rows)
    print(f"  Intensities: {dict(intensities)}")
    print(f"  Date range: {rows[0][1][:10]} to {rows[-1][1][:10]}")


if __name__ == "__main__":
    main()
