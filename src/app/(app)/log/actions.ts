"use server";

import { createMovement, deleteMovement } from "@/lib/movements";
import { revalidatePath } from "next/cache";

export async function logMovement(
  intensity: string
): Promise<{ id: string }> {
  const result = await createMovement(intensity);
  revalidatePath("/history");
  return result;
}

export async function undoMovement(id: string): Promise<void> {
  await deleteMovement(id);
  revalidatePath("/history");
}
