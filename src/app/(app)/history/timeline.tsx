"use client";

import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/date";
import { intensities } from "@/lib/constants";
import { type Movement } from "@/lib/movements";

type Props = {
  movements: Movement[];
};

export function Timeline({ movements }: Props) {
  return (
    <ol className="flex flex-col">
      {movements.map((movement, index) => {
        const label = intensities.find(
          (i) => i.value === movement.intensity
        )?.label;
        const isLast = index === movements.length - 1;

        return (
          <li key={movement.id} className="flex gap-3">
            {/* Time column */}
            <span className="w-14 shrink-0 leading-7 text-lg tabular-nums text-muted-foreground">
              {formatTime(movement.occurred_at)}
            </span>

            {/* Dot + connector column */}
            <div className="flex flex-col items-center">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/20">
                <span className="size-4 rounded-full bg-primary" />
              </span>
              {!isLast && <span className="w-px flex-1 bg-border" />}
            </div>

            {/* Label column */}
            <span className={cn("pb-8 leading-7 text-lg text-foreground", isLast && "pb-0")}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
