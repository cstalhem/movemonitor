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
    <div className='flex flex-col py-3'>
      {/* Date label — above bars, updates live during scroll */}
      <p className='text-center font-medium text-foreground'>
        {formatDayLabel(centeredDay, today)}
      </p>

      {/* Center marker — triangle + fading border */}
      <div className='relative flex items-center justify-center text-primary mb-4'>
        <div
          className='absolute inset-x-0 top-0.5 h-px'
          style={{
            background:
              "linear-gradient(to right, transparent, currentColor 40%, currentColor 60%, transparent)",
          }}
        />
        <div
          className='relative text-sm leading-none'
          data-testid='selected-indicator'
        >
          ▼
        </div>
      </div>

      {/* Bar chart strip */}
      <div
        ref={containerRef}
        className='flex items-end overflow-x-auto mb-1 snap-x snap-mandatory scrollbar-hide gap-1 px-[calc(50%-1rem)]'
      >
        <div ref={sentinelRef} className='shrink-0 w-px' />
        {dayCounts.map((dc) => (
          <StackedBar key={dc.day} dayCount={dc} maxTotal={maxTotal} />
        ))}
      </div>

      {/* Legend */}
      <div className='flex justify-center gap-4 w-full mb-4 py-4 border-t'>
        <div className='flex flex-col items-center w-1/6'>
          <p className='text-2xl font-bold text-chart-1'>
            {centeredCount.mycket}
          </p>
          <p className='text-sm text-muted-foreground'>Mycket</p>
        </div>
        <div className='flex flex-col items-center w-1/6'>
          <p className='text-2xl font-bold text-chart-2'>
            {centeredCount.mellan}
          </p>
          <p className='text-sm text-muted-foreground'>Mellan</p>
        </div>
        <div className='flex flex-col items-center w-1/6'>
          <p className='text-2xl font-bold text-chart-3'>
            {centeredCount.lite}
          </p>
          <p className='text-sm text-muted-foreground'>Lite</p>
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
      className='flex flex-col items-center w-8 snap-center shrink-0'
      data-day={dayCount.day}
      data-testid='stacked-bar'
    >
      <div
        className='flex flex-col justify-end w-full'
        style={{ height: MAX_HEIGHT }}
      >
        {total > 0 ? (
          <div
            className='flex flex-col w-full rounded-sm overflow-hidden'
            style={{ height: barHeight }}
            data-testid='bar-stack'
          >
            {dayCount.mycket > 0 && (
              <div
                className='bg-chart-1'
                style={{ flexGrow: dayCount.mycket }}
                data-testid='bar-segment'
              />
            )}
            {dayCount.mellan > 0 && (
              <div
                className='bg-chart-2'
                style={{ flexGrow: dayCount.mellan }}
                data-testid='bar-segment'
              />
            )}
            {dayCount.lite > 0 && (
              <div
                className='bg-chart-3'
                style={{ flexGrow: dayCount.lite }}
                data-testid='bar-segment'
              />
            )}
          </div>
        ) : (
          <div data-testid='bar-stack' style={{ height: 0 }} />
        )}
      </div>
    </div>
  );
}
