"use client";

import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/date";
import { intensities } from "@/lib/constants";
import { type Movement } from "@/lib/movements";

const colorMap = {
  "chart-1": { bg: "bg-chart-1/20", text: "text-chart-1", fill: "bg-chart-1" },
  "chart-2": { bg: "bg-chart-2/20", text: "text-chart-2", fill: "bg-chart-2" },
  "chart-3": { bg: "bg-chart-3/20", text: "text-chart-3", fill: "bg-chart-3" },
} as const;

type Props = {
  movements: Movement[];
};

export function Timeline({ movements }: Props) {
  return (
    <ol className='flex flex-col px-6'>
      {movements.map((movement, index) => {
        const intensity = intensities.find(
          (i) => i.value === movement.intensity,
        );
        const label = intensity?.label;
        const Icon = intensity?.icon;
        const isLast = index === movements.length - 1;

        const colorClasses = colorMap[intensity?.color ?? "chart-1"];

        return (
          <li key={movement.id} className='flex gap-3'>
            {/* Time column */}
            <span className='w-14 shrink-0 leading-7 text-lg tabular-nums text-muted-foreground'>
              {formatTime(movement.occurred_at)}
            </span>

            {/* Dot + connector column */}
            <div className='flex flex-col items-center'>
              <span className={cn('flex size-7 items-center justify-center rounded-full', colorClasses.bg)}>
                {Icon ? (
                  <Icon className={cn('size-4', colorClasses.text)} />
                ) : (
                  <span className={cn('size-4 rounded-full', colorClasses.fill)} />
                )}
              </span>
              {!isLast && <span className='w-px flex-1 bg-border' />}
            </div>

            {/* Label column */}
            <span
              className={cn(
                "ml-4 pb-8 leading-7 text-xl text-foreground",
                isLast && "pb-0",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
