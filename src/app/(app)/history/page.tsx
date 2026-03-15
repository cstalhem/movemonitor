import { getMovementsByDay } from "@/lib/movements";
import { todayInStockholm } from "@/lib/date";
import { Timeline } from "./timeline";

export default async function HistoryPage() {
  const today = todayInStockholm();
  const movements = await getMovementsByDay(today);

  return (
    <div className="flex flex-1 flex-col px-4 pt-4">
      <h1 className="text-2xl font-bold text-foreground mb-6">Idag</h1>
      {movements.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Inga rörelser registrerade idag</p>
        </div>
      ) : (
        <Timeline movements={movements} />
      )}
    </div>
  );
}
