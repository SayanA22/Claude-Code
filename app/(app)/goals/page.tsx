import { redirect } from "next/navigation";
import { GoalsScreen } from "@/components/goals/goals-screen";
import { getUserContext } from "@/lib/data/profile";
import { listGoals } from "@/lib/data/projects";
import { localDateKey } from "@/lib/utils/time";

export const metadata = { title: "Goals" };

export default async function GoalsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const goals = await listGoals(ctx.userId);

  return (
    <GoalsScreen
      goals={goals}
      todayKey={localDateKey(new Date(), ctx.timeZone)}
    />
  );
}
