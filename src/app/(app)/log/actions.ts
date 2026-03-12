"use server";

import { createMovement } from "@/lib/movements";
import { revalidatePath } from "next/cache";

export async function logMovement(
  intensity: string
): Promise<{ id: string }> {
  const result = await createMovement(intensity);
  revalidatePath("/history");
  return result;
}
