import { createClient } from "@/lib/supabase/server";

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
