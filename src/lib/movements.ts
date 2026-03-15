import { createClient } from "@/lib/supabase/server";
import { type Intensity } from "./constants";
import { stockholmDayRange } from "./date";

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

export async function createMovement(
  intensity: string
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
