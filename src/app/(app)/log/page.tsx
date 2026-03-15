"use client";

import { useCallback, useRef, useTransition } from "react";
import { cn } from "@/lib/utils";
import { intensities } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { logMovement } from "./actions";

const buttonColorMap = {
  "chart-1": "bg-chart-1 text-white hover:bg-chart-1/90",
  "chart-2": "bg-chart-2 text-white hover:bg-chart-2/90",
  "chart-3": "bg-chart-3 text-white hover:bg-chart-3/90",
} as const;

const DEBOUNCE_MS = 500;

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
      {intensities.map(({ value, label, icon: Icon, color }) => (
        <Button
          key={value}
          onClick={() => handleLog(value)}
          disabled={isPending}
          className={cn(
            'w-full max-w-sm rounded-2xl px-6 py-6 text-xl font-semibold touch-manipulation active:scale-95 transition-transform',
            buttonColorMap[color],
          )}
        >
          <Icon className='size-6' />
          {label}
        </Button>
      ))}
    </div>
  );
}
