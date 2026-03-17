import { getMovementsByDay } from "@/lib/movements";
import { Timeline } from "./timeline";

export default async function DayTimeline({ day }: { day: string }) {
  const movements = await getMovementsByDay(day);

  if (movements.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Inga rörelser registrerade</p>
      </div>
    );
  }

  return <Timeline movements={movements} />;
}
