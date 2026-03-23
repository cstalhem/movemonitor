"use client";

import { useCallback, useRef, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { intensities } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { logMovement, undoMovement } from "./actions";

const buttonColorMap = {
  "chart-1": "bg-chart-1 text-white hover:bg-chart-1/90 [--spring-glow:var(--color-chart-1)]",
  "chart-2": "bg-chart-2 text-white hover:bg-chart-2/90 [--spring-glow:var(--color-chart-2)]",
  "chart-3": "bg-chart-3 text-white hover:bg-chart-3/90 [--spring-glow:var(--color-chart-3)]",
} as const;

const DEBOUNCE_MS = 500;

export default function LogPage() {
  const [isPending, startTransition] = useTransition();
  const lastLogRef = useRef(0);
  const activeToastRef = useRef<string | number | undefined>(undefined);

  const handleLog = useCallback(
    (intensity: string) => {
      const now = Date.now();
      if (now - lastLogRef.current < DEBOUNCE_MS) return;

      lastLogRef.current = now;
      startTransition(() => {
        if (activeToastRef.current !== undefined) {
          toast.dismiss(activeToastRef.current);
        }

        const toastId = toast.promise(logMovement(intensity), {
          loading: "Registrerar...",
          success: ({ id }) => ({
            message: "Rörelse registrerad",
            action: {
              label: "Ångra",
              onClick: () => {
                startTransition(async () => {
                  try {
                    await undoMovement(id);
                  } catch {
                    toast.error("Ångra misslyckades");
                  }
                });
              },
            },
          }),
          error: "Kunde inte registrera",
        });
        activeToastRef.current =
          typeof toastId === "object" ? undefined : toastId;
      });
    },
    [startTransition],
  );

  return (
    <>
      <div className="shrink-0 pt-2">
        <h1 className="text-center text-xl font-bold uppercase tracking-[1.5px] text-foreground">
          Movemonitor
        </h1>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        {intensities.map(({ value, label, icon: Icon, color }) => (
          <Button
            key={value}
            onClick={() => handleLog(value)}
            disabled={isPending}
            className={cn(
              "w-full max-w-sm touch-manipulation rounded-2xl px-6 py-6 text-xl font-semibold spring-press",
              buttonColorMap[color],
            )}
          >
            <Icon className="size-6" />
            {label}
          </Button>
        ))}
      </div>
    </>
  );
}
