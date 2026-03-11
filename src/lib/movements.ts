import { getDb } from "./db";
import type Database from "better-sqlite3";

function nowLocalISO(): string {
  const now = new Date();
  const off = -now.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, "0");
  const m = String(Math.abs(off) % 60).padStart(2, "0");
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(now.getMilliseconds()).padStart(3, "0")}${sign}${h}:${m}`;
}

export function createMovement(
  intensity: string,
  db: Database.Database = getDb()
): { id: number } {
  const result = db
    .prepare("INSERT INTO movements (intensity, created_at) VALUES (?, ?)")
    .run(intensity, nowLocalISO());
  return { id: Number(result.lastInsertRowid) };
}
