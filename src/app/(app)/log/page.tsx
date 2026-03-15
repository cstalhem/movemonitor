"use client";

import { useCallback, useRef, useTransition } from "react";
import { logMovement } from "./actions";

const DEBOUNCE_MS = 500;

const intensities = [
  { value: "mycket", label: "Mycket" },
  { value: "mellan", label: "Mellan" },
  { value: "lite", label: "Lite" },
] as const;

export default function LogPage() {
  const [isPending, startTransition] = useTransition();
  const lastLogRef = useRef(0);

  const handleLog = useCallback(
    (intensity: string) => {
      const now = Date.now();
      if (now - lastLogRef.current < DEBOUNCE_MS) return;

      lastLogRef.current = now;
      startTransition(async () => {
        await logMovement(intensity);
      });
    },
    [startTransition],
  );

  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-4 px-6'>
      {intensities.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => handleLog(value)}
          disabled={isPending}
          className='w-full max-w-sm rounded-2xl bg-primary px-6 py-6 text-xl font-semibold text-primary-foreground touch-manipulation active:scale-95 transition-transform disabled:opacity-50'
        >
          {label}
        </button>
      ))}
    </div>
  );
}
