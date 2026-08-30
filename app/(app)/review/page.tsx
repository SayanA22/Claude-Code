import { redirect } from "next/navigation";
import { ReviewScreen } from "@/components/review/review-screen";
import { getUserContext } from "@/lib/data/profile";
import { listBlocksForDate } from "@/lib/data/schedule";
import { listRecentlyCompleted } from "@/lib/data/tasks";
import { computeDailyStats } from "@/lib/data/reviews";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fromLocalParts,
  localDateKey,
  startOfWeekKey,
} from "@/lib/utils/time";
import type { DailyReview, WeeklyReview } from "@/types/db";

export const metadata = { title: "Review" };

export default async function ReviewPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const now = new Date();
  const todayKey = localDateKey(now, ctx.timeZone);
  const weekStart = startOfWeekKey(todayKey);
  const supabase = await createSupabaseServerClient();

  const [blocks, completedToday, dailyRes, weeklyRes] = await Promise.all([
    listBlocksForDate(ctx.userId, todayKey),
    listRecentlyCompleted(
      ctx.userId,
      fromLocalParts(todayKey, "00:00", ctx.timeZone),
    ),
    supabase
      .from("daily_reviews")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("local_date", todayKey)
      .maybeSingle(),
    supabase
      .from("weekly_reviews")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("week_start", weekStart)
      .maybeSingle(),
  ]);

  const stats = computeDailyStats(todayKey, blocks, completedToday);

  return (
    <ReviewScreen
      todayKey={todayKey}
      existingDaily={(dailyRes.data as DailyReview | null) ?? null}
      existingWeekly={(weeklyRes.data as WeeklyReview | null) ?? null}
      liveStats={{
        completedCount: stats.completedCount,
        postponedCount: stats.postponedCount,
        plannedMinutes: stats.plannedMinutes,
        actualMinutes: stats.actualMinutes,
      }}
    />
  );
}
