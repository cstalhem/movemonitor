"use client";

import { useCallback, useRef, useTransition } from "react";
import { intensities } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { logMovement } from "./actions";

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
      {intensities.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          onClick={() => handleLog(value)}
          disabled={isPending}
          className='w-full max-w-sm rounded-2xl px-6 py-6 text-xl font-semibold touch-manipulation active:scale-95 transition-transform'
        >
          <Icon className='size-6' />
          {label}
        </Button>
      ))}
    </div>
  );
}
