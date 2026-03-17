"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDayLabel, offsetDay, stockholmDayRange } from "@/lib/date";
import { groupByDay, type DayCount } from "@/lib/day-counts";
import { createClient } from "@/lib/supabase/client";

type Props = {
  dayCounts: DayCount[];
  selectedDay: string;
  today: string;
};

export function DayCarousel({
  dayCounts: initialDayCounts,
  selectedDay,
  today,
}: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetching = useRef(false);

  const [dayCounts, setDayCounts] = useState(initialDayCounts);
  const [prevInitial, setPrevInitial] = useState(initialDayCounts);
  if (initialDayCounts !== prevInitial) {
    setPrevInitial(initialDayCounts);
    setDayCounts(initialDayCounts);
  }
  const [loadedRange, setLoadedRange] = useState({
    oldest: initialDayCounts[0]?.day ?? today,
    newest: initialDayCounts[initialDayCounts.length - 1]?.day ?? today,
  });
  // Tracks whichever day is currently under the center marker (updates live during scroll)
  const [centeredDay, setCenteredDay] = useState(selectedDay);

  const maxTotal = Math.max(
    ...dayCounts.map((dc) => dc.mycket + dc.mellan + dc.lite),
    0,
  );

  const centeredCount = dayCounts.find((dc) => dc.day === centeredDay) ?? {
    mycket: 0,
    mellan: 0,
    lite: 0,
  };

  // Find which bar is closest to center
  const findCenteredDay = useCallback(() => {
    const container = containerRef.current;
    if (!container) return null;
    const centerX = container.scrollLeft + container.clientWidth / 2;
    const bars = container.querySelectorAll<HTMLElement>("[data-day]");
    let closest: string | null = null;
    let minDist = Infinity;
    bars.forEach((bar) => {
      const barCenter = bar.offsetLeft + bar.offsetWidth / 2;
      const dist = Math.abs(barCenter - centerX);
      if (dist < minDist) {
        minDist = dist;
        closest = bar.dataset.day ?? null;
      }
    });
    return closest;
  }, []);

  // Settle handler — called when scrolling stops
  const handleSettle = useCallback(() => {
    if (isProgrammaticScroll.current) return;
    const day = findCenteredDay();
    if (day && day !== selectedDay) {
      router.replace(`/history?date=${day}`, { scroll: false });
    }
  }, [findCenteredDay, selectedDay, router]);

  // Scroll handling: live-update centered day + settle detection for URL
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const hasScrollEnd = "onscrollend" in window;

    const onScrollEnd = () => handleSettle();
    const onScroll = () => {
      // Live-update the centered day label during scroll
      if (!isProgrammaticScroll.current) {
        const day = findCenteredDay();
        if (day) setCenteredDay(day);
      }
      // Settle detection (debounce fallback for browsers without scrollend)
      if (hasScrollEnd) return;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(handleSettle, 150);
    };

    if (hasScrollEnd) {
      container.addEventListener("scrollend", onScrollEnd);
    }
    container.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (hasScrollEnd) {
        container.removeEventListener("scrollend", onScrollEnd);
      }
      container.removeEventListener("scroll", onScroll);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [handleSettle, findCenteredDay]);

  // Initial scroll to selected day
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const selectedBar = container.querySelector(`[data-day="${selectedDay}"]`);
    if (selectedBar) {
      isProgrammaticScroll.current = true;
      selectedBar.scrollIntoView({ inline: "center", behavior: "instant" });
      requestAnimationFrame(() => {
        isProgrammaticScroll.current = false;
      });
    }
  }, [selectedDay]);

  // Edge prefetching via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetching.current) {
          isFetching.current = true;
          const newEnd = offsetDay(loadedRange.oldest, -1);
          const newStart = offsetDay(newEnd, -13);
          fetchDayCounts(newStart, newEnd)
            .then((olderDays) => {
              const prevScrollLeft = container.scrollLeft;
              const prevScrollWidth = container.scrollWidth;

              setDayCounts((prev) => [...olderDays, ...prev]);
              setLoadedRange((prev) => ({ ...prev, oldest: newStart }));

              requestAnimationFrame(() => {
                const addedWidth = container.scrollWidth - prevScrollWidth;
                isProgrammaticScroll.current = true;
                if (settleTimer.current) clearTimeout(settleTimer.current);
                container.scrollLeft = prevScrollLeft + addedWidth;
                requestAnimationFrame(() => {
                  isProgrammaticScroll.current = false;
                });
              });
            })
            .catch(() => {
              // TODO(Step 5): show error toast
            })
            .finally(() => {
              isFetching.current = false;
            });
        }
      },
      { root: container, rootMargin: "0px 0px 0px 200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadedRange.oldest]);

  return (
    <div className="flex flex-col py-3">
      {/* Date label — above bars, updates live during scroll */}
      <p className="text-foreground text-center font-medium">
        {formatDayLabel(centeredDay, today)}
      </p>

      {/* Center marker — triangle + fading border */}
      <div className="text-primary relative mb-4 flex items-center justify-center">
        <div
          className="absolute inset-x-0 top-0.5 h-px"
          style={{
            background:
              "linear-gradient(to right, transparent, currentColor 40%, currentColor 60%, transparent)",
          }}
        />
        <div
          className="relative text-sm leading-none"
          data-testid="selected-indicator"
        >
          ▼
        </div>
      </div>

      {/* Bar chart strip */}
      <div
        ref={containerRef}
        className="scrollbar-hide mb-1 flex snap-x snap-mandatory items-end gap-1 overflow-x-auto px-[calc(50%-1rem)]"
      >
        <div ref={sentinelRef} className="w-px shrink-0" />
        {dayCounts.map((dc) => (
          <StackedBar key={dc.day} dayCount={dc} maxTotal={maxTotal} />
        ))}
      </div>

      {/* Legend */}
      <div className="mb-4 flex w-full justify-center gap-4 border-t py-4">
        <div className="flex w-1/6 flex-col items-center">
          <p className="text-chart-1 text-2xl font-bold">
            {centeredCount.mycket}
          </p>
          <p className="text-muted-foreground text-sm">Mycket</p>
        </div>
        <div className="flex w-1/6 flex-col items-center">
          <p className="text-chart-2 text-2xl font-bold">
            {centeredCount.mellan}
          </p>
          <p className="text-muted-foreground text-sm">Mellan</p>
        </div>
        <div className="flex w-1/6 flex-col items-center">
          <p className="text-chart-3 text-2xl font-bold">
            {centeredCount.lite}
          </p>
          <p className="text-muted-foreground text-sm">Lite</p>
        </div>
      </div>
    </div>
  );
}

// Client-side prefetch helper
async function fetchDayCounts(
  startDay: string,
  endDay: string,
): Promise<DayCount[]> {
  const supabase = createClient();
  const { start } = stockholmDayRange(startDay);
  const { end } = stockholmDayRange(endDay);

  const { data, error } = await supabase
    .from("movements")
    .select("intensity, occurred_at")
    .gte("occurred_at", start)
    .lt("occurred_at", end)
    .order("occurred_at", { ascending: true });

  if (error) throw error;
  return groupByDay(data ?? [], startDay, endDay);
}

const MAX_HEIGHT = 64; // px

function StackedBar({
  dayCount,
  maxTotal,
}: {
  dayCount: DayCount;
  maxTotal: number;
}) {
  const total = dayCount.mycket + dayCount.mellan + dayCount.lite;
  const barHeight = maxTotal > 0 ? (total / maxTotal) * MAX_HEIGHT : 0;

  return (
    <div
      className="flex w-8 shrink-0 snap-center flex-col items-center"
      data-day={dayCount.day}
      data-testid="stacked-bar"
    >
      <div
        className="flex w-full flex-col justify-end"
        style={{ height: MAX_HEIGHT }}
      >
        {total > 0 ? (
          <div
            className="flex w-full flex-col overflow-hidden rounded-sm"
            style={{ height: barHeight }}
            data-testid="bar-stack"
          >
            {dayCount.mycket > 0 && (
              <div
                className="bg-chart-1"
                style={{ flexGrow: dayCount.mycket }}
                data-testid="bar-segment"
              />
            )}
            {dayCount.mellan > 0 && (
              <div
                className="bg-chart-2"
                style={{ flexGrow: dayCount.mellan }}
                data-testid="bar-segment"
              />
            )}
            {dayCount.lite > 0 && (
              <div
                className="bg-chart-3"
                style={{ flexGrow: dayCount.lite }}
                data-testid="bar-segment"
              />
            )}
          </div>
        ) : (
          <div data-testid="bar-stack" style={{ height: 0 }} />
        )}
      </div>
    </div>
  );
}
