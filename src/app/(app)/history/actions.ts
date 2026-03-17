"use server";

import { deleteMovement } from "@/lib/movements";
import { revalidatePath } from "next/cache";

export async function deleteTimelineMovement(id: string): Promise<void> {
  await deleteMovement(id);
  revalidatePath("/history");
}
