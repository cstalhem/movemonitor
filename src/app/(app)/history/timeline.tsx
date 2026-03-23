"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from "react";
import { cn } from "@/lib/utils";
import { formatTime, nowMinuteInStockholm } from "@/lib/date";
import { intensities } from "@/lib/constants";
import { type Movement } from "@/lib/movements";
import { buildTimelineItems, gapPx, buildMaskImage } from "@/lib/timeline";
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
  "chart-1": {
    bg: "bg-chart-1/20",
    text: "text-chart-1",
    fill: "bg-chart-1",
  },
  "chart-2": {
    bg: "bg-chart-2/20",
    text: "text-chart-2",
    fill: "bg-chart-2",
  },
  "chart-3": {
    bg: "bg-chart-3/20",
    text: "text-chart-3",
    fill: "bg-chart-3",
  },
} as const;

type Props = {
  movements: Movement[];
  isToday: boolean;
};

export function Timeline({ movements, isToday }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Now minute state (for live-updating now marker)
  const [nowMinute, setNowMinute] = useState(() => nowMinuteInStockholm());

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLLIElement>(null);
  const firstEntryRef = useRef<HTMLLIElement>(null);

  // Scroll state for fade edges
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  // Off-screen counts
  const [aboveCount, setAboveCount] = useState(0);
  const [belowCount, setBelowCount] = useState(0);
  const entryRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  // Build unified timeline items
  const items = buildTimelineItems(movements, isToday, nowMinute);
  const firstMovementIndex = items.findIndex((i) => i.type === "movement");

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

  // Now marker interval (aligned to minute boundary)
  useEffect(() => {
    if (!isToday) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const timeout = setTimeout(() => {
      setNowMinute(nowMinuteInStockholm());
      interval = setInterval(() => {
        setNowMinute(nowMinuteInStockholm());
      }, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(timeout);
      if (interval !== null) clearInterval(interval);
    };
  }, [isToday]);

  // Scroll on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      const target = isToday ? nowRef.current : firstEntryRef.current;
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
  }, [isToday]);

  // Scroll tracking for fade edges
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollUp(el.scrollTop > 0);
      setCanScrollDown(
        el.scrollTop + el.clientHeight < el.scrollHeight - 1,
      );
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  // IntersectionObserver for off-screen indicators
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const visibleSet = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-id");
          if (!id) continue;
          if (entry.isIntersecting) visibleSet.add(id);
          else visibleSet.delete(id);
        }
        let above = 0;
        let below = 0;
        const containerRect = container.getBoundingClientRect();
        for (const [id, ref] of entryRefs.current) {
          if (visibleSet.has(id)) continue;
          const rect = ref.getBoundingClientRect();
          if (rect.bottom < containerRect.top) above++;
          else if (rect.top > containerRect.bottom) below++;
        }
        setAboveCount(above);
        setBelowCount(below);
      },
      { root: container, threshold: 0 },
    );
    for (const [, ref] of entryRefs.current) observer.observe(ref);
    return () => observer.disconnect();
  }, [movements]);

  const maskImage = buildMaskImage(canScrollUp, canScrollDown);

  // Ref callback for movement entries
  const setEntryRef = useCallback(
    (id: string, el: HTMLLIElement | null) => {
      if (el) entryRefs.current.set(id, el);
      else entryRefs.current.delete(id);
    },
    [],
  );

  return (
    <>
      <div className="relative flex-1 overflow-hidden">
        {/* Off-screen indicator: above */}
        {aboveCount > 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center py-1.5">
            <span className="rounded-full border border-border bg-card px-3 py-0.5 text-xs font-medium text-muted-foreground shadow-md backdrop-blur-sm">
              {aboveCount} tidigare
            </span>
          </div>
        )}

        <div
          ref={scrollRef}
          className="h-full overflow-y-auto"
          style={
            maskImage
              ? {
                  maskImage,
                  WebkitMaskImage: maskImage,
                }
              : undefined
          }
        >
        <ol
          className={cn(
            "flex flex-col px-6",
            isPending && "pointer-events-none opacity-50",
          )}
        >
          {items.map((item, index) => {
            const prevMinute =
              index > 0 ? items[index - 1].minuteOfDay : item.minuteOfDay;
            const gap = item.minuteOfDay - prevMinute;
            const marginTop = index === 0 ? 0 : gapPx(gap);

            if (item.type === "hour") {
              return (
                <li
                  key={`hour-${item.hour}`}
                  className="flex items-center gap-3"
                  style={{ marginTop: `${marginTop}px` }}
                >
                  <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground/50">
                    {`${String(item.hour).padStart(2, "0")}:00`}
                  </span>
                  <div className="h-px flex-1 bg-border/30" />
                </li>
              );
            }

            if (item.type === "now") {
              return (
                <li
                  key="now"
                  ref={nowRef}
                  className="flex items-center gap-3"
                  style={{ marginTop: `${marginTop}px` }}
                  data-testid="now-marker"
                >
                  <span className="w-14 shrink-0 text-xs font-medium tabular-nums text-primary">
                    {formatTime(new Date().toISOString())}
                  </span>
                  <div className="h-0.5 flex-1 bg-primary/60" />
                </li>
              );
            }

            // item.type === "movement"
            const movement = item.movement;
            const intensity = intensities.find(
              (i) => i.value === movement.intensity,
            );
            const label = intensity?.label;
            const Icon = intensity?.icon;
            const isLast =
              index === items.length - 1 ||
              items.slice(index + 1).every((i) => i.type !== "movement");
            const colorClasses = colorMap[intensity?.color ?? "chart-1"];
            const isFirstMovement = index === firstMovementIndex;

            return (
              <li
                key={movement.id}
                ref={(el) => {
                  setEntryRef(movement.id, el);
                  if (isFirstMovement) {
                    firstEntryRef.current = el;
                  }
                }}
                data-id={movement.id}
                style={{ marginTop: `${marginTop}px` }}
              >
                <button
                  type="button"
                  onClick={() => setConfirmId(movement.id)}
                  className="active:bg-muted/50 flex w-full gap-3 text-left transition-colors"
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
                          className={cn(
                            "size-4 rounded-full",
                            colorClasses.fill,
                          )}
                        />
                      )}
                    </span>
                    {!isLast && <span className="bg-border w-px flex-1" />}
                  </div>

                  {/* Label column */}
                  <span className="text-foreground ml-4 text-xl leading-7">
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        </div>

        {/* Off-screen indicator: below */}
        {belowCount > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center py-1.5">
            <span className="rounded-full border border-border bg-card px-3 py-0.5 text-xs font-medium text-muted-foreground shadow-md backdrop-blur-sm">
              {belowCount} senare
            </span>
          </div>
        )}
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
