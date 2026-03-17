"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/date";
import { intensities } from "@/lib/constants";
import { type Movement } from "@/lib/movements";
import { toast } from "sonner";
import { deleteTimelineMovement } from "./actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const colorMap = {
  "chart-1": { bg: "bg-chart-1/20", text: "text-chart-1", fill: "bg-chart-1" },
  "chart-2": { bg: "bg-chart-2/20", text: "text-chart-2", fill: "bg-chart-2" },
  "chart-3": { bg: "bg-chart-3/20", text: "text-chart-3", fill: "bg-chart-3" },
} as const;

type Props = {
  movements: Movement[];
};

export function Timeline({ movements }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!confirmId) return;
    startTransition(async () => {
      try {
        await deleteTimelineMovement(confirmId);
        setConfirmId(null);
      } catch {
        setConfirmId(null);
        toast.error("Radering misslyckades");
      }
    });
  }

  return (
    <>
      <div className="flex flex-col px-6">
        {movements.map((movement, index) => {
          const intensity = intensities.find(
            (i) => i.value === movement.intensity,
          );
          const label = intensity?.label;
          const Icon = intensity?.icon;
          const isLast = index === movements.length - 1;

          const colorClasses = colorMap[intensity?.color ?? "chart-1"];

          return (
            <button
              key={movement.id}
              type="button"
              onClick={() => setConfirmId(movement.id)}
              className={cn(
                "active:bg-muted/50 flex gap-3 text-left transition-colors",
                isPending && "pointer-events-none opacity-50",
              )}
            >
              {/* Time column */}
              <span className="text-muted-foreground w-14 shrink-0 text-lg leading-7 tabular-nums">
                {formatTime(movement.occurred_at)}
              </span>

              {/* Dot + connector column */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border border-current/20",
                    colorClasses.bg,
                    colorClasses.text,
                  )}
                >
                  {Icon ? (
                    <Icon className={cn("size-4", colorClasses.text)} />
                  ) : (
                    <span
                      className={cn("size-4 rounded-full", colorClasses.fill)}
                    />
                  )}
                </span>
                {!isLast && <span className="bg-border w-px flex-1" />}
              </div>

              {/* Label column */}
              <span
                className={cn(
                  "text-foreground ml-4 pb-8 text-xl leading-7",
                  isLast && "pb-0",
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <AlertDialog
        open={confirmId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera rörelse?</AlertDialogTitle>
            <AlertDialogDescription>
              Rörelsen tas bort permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? "Raderar..." : "Radera"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
