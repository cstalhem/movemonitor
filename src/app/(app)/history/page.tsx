import { Suspense } from "react";
import { redirect } from "next/navigation";
import { todayInStockholm, offsetDay, isValidDateString } from "@/lib/date";
import { getDayCounts } from "@/lib/movements";
import { DayCarousel } from "./day-carousel";
import DayTimeline from "./day-timeline";
import { TimelineSkeleton } from "./timeline-skeleton";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const today = todayInStockholm();

  // Validate date param — strip invalid/future dates
  if (date !== undefined) {
    if (!isValidDateString(date) || date > today) {
      redirect("/history");
    }
  }

  const selectedDay = date ?? today;

  // Seed carousel window: 14 days ending at today, shifted if selectedDay is older
  const defaultStart = offsetDay(today, -13);
  const startDay =
    selectedDay < defaultStart ? offsetDay(selectedDay, -6) : defaultStart;
  const dayCounts = await getDayCounts(startDay, today);

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-2">
      <div className="shrink-0">
        <DayCarousel
          key={startDay}
          dayCounts={dayCounts}
          selectedDay={selectedDay}
          today={today}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense key={selectedDay} fallback={<TimelineSkeleton />}>
          <DayTimeline day={selectedDay} />
        </Suspense>
      </div>
    </div>
  );
}
