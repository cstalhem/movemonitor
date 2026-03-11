"use server";

import { createMovement } from "@/lib/movements";

export async function logMovement(intensity: string): Promise<{ id: number }> {
  return createMovement(intensity);
}
