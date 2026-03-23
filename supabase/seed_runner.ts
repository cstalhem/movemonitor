/**
 * Seed runner — loads seed_movements.csv into the remote Supabase database.
 *
 * Usage: bun supabase/seed_runner.ts [--dry-run] [--limit N]
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (bypasses RLS).
 * Reads NEXT_PUBLIC_SUPABASE_URL from .env.local for the project URL.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const limitIdx = process.argv.indexOf("--limit");
const LIMIT = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;
const CSV_PATH = join(import.meta.dir, "seed_movements.csv");
const EMAIL = "carl@stalhem.se";

// ── Env validation ─────────────────────────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing env vars. Ensure .env.local contains:\n" +
      "  NEXT_PUBLIC_SUPABASE_URL=...\n" +
      "  SUPABASE_SERVICE_ROLE_KEY=...\n\n" +
      "Get the service role key from: Supabase Dashboard → Settings → API",
  );
  process.exit(1);
}

// Service role client bypasses RLS
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Parse CSV ──────────────────────────────────────────────────────────
function parseCSV(): Array<{ intensity: string; occurred_at: string }> {
  const raw = readFileSync(CSV_PATH, "utf-8");
  const lines = raw.trim().split("\n").slice(1); // skip header
  return lines.map((line) => {
    const [intensity, occurred_at] = line.split("|");
    return { intensity, occurred_at };
  });
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  const allRows = parseCSV();
  const rows = allRows.slice(0, LIMIT);
  console.log(`Parsed ${allRows.length} movements from CSV (using ${rows.length})`);

  if (DRY_RUN) {
    console.log("Dry run — first 5 rows:");
    rows.slice(0, 5).forEach((r) => console.log(`  ${r.intensity} | ${r.occurred_at}`));
    console.log(`  ... and ${rows.length - 5} more`);
    return;
  }

  // Look up user
  const { data: userData, error: userError } =
    await supabase.auth.admin.listUsers();
  if (userError) throw userError;

  const user = userData.users.find((u) => u.email === EMAIL);
  if (!user) throw new Error(`User ${EMAIL} not found in auth.users`);
  console.log(`Found user ${EMAIL} → ${user.id}`);

  // Delete existing movements for this user
  const { error: deleteError } = await supabase
    .from("movements")
    .delete()
    .eq("user_id", user.id);
  if (deleteError) throw deleteError;
  console.log("Cleared existing movements");

  // Insert in batches of 500 (Supabase limit is ~1000 per request)
  const BATCH_SIZE = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map((r) => ({
      user_id: user.id,
      intensity: r.intensity,
      occurred_at: r.occurred_at,
    }));

    const { error } = await supabase.from("movements").insert(batch);
    if (error) throw error;

    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${rows.length}`);
  }

  console.log(`Done — ${inserted} movements seeded for ${EMAIL}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
