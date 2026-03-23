import { createClient } from "@/lib/supabase/server";
import { type Intensity } from "./constants";
import { groupByDay, type DayCount } from "./day-counts";
import { stockholmDayRange } from "./date";

export type { DayCount };

export type Movement = {
  id: string;
  intensity: Intensity;
  occurred_at: string;
};

export async function getMovementsByDay(day: string): Promise<Movement[]> {
  const supabase = await createClient();
  const { start, end } = stockholmDayRange(day);

  const { data, error } = await supabase
    .from("movements")
    .select("id, intensity, occurred_at")
    .gte("occurred_at", start)
    .lt("occurred_at", end)
    .order("occurred_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Movement[];
}

export async function getDayCounts(
  startDay: string,
  endDay: string,
): Promise<DayCount[]> {
  const supabase = await createClient();
  const { start } = stockholmDayRange(startDay);
  const { end } = stockholmDayRange(endDay);

  // Paginate to avoid Supabase's default 1000-row limit (db-max-rows).
  const PAGE_SIZE = 1000;
  let allRows: Array<{ intensity: string; occurred_at: string }> = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("movements")
      .select("intensity, occurred_at")
      .gte("occurred_at", start)
      .lt("occurred_at", end)
      .order("occurred_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    allRows = allRows.concat(data ?? []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return groupByDay(allRows, startDay, endDay);
}

export async function createMovement(
  intensity: string,
): Promise<{ id: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("movements")
    .insert({ intensity, user_id: user.id })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id };
}

export async function deleteMovement(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("movements").delete().eq("id", id);
  if (error) throw error;
}
