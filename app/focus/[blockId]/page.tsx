import { notFound, redirect } from "next/navigation";
import { FocusSession } from "@/components/focus/focus-session";
import { getUserContext } from "@/lib/data/profile";
import { listBlocksForDate } from "@/lib/data/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ScheduleBlockWithTask, Task, ScheduleBlock } from "@/types/db";

export const metadata = { title: "Focus" };

export default async function FocusPage({
  params,
}: {
  params: Promise<{ blockId: string }>;
}) {
  const { blockId } = await params;
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("schedule_blocks")
    .select("*, task:tasks(*)")
    .eq("user_id", ctx.userId)
    .eq("id", blockId)
    .maybeSingle();

  if (!data) notFound();

  const { task, ...rest } = data as ScheduleBlock & { task: Task | null };
  const block: ScheduleBlockWithTask = { ...rest, task: task ?? null };

  // Whatever comes after this one, so "what's next?" is answerable on the spot.
  const dayBlocks = await listBlocksForDate(ctx.userId, block.local_date);
  const nextBlock =
    dayBlocks.find(
      (b) =>
        b.kind !== "break" &&
        b.id !== block.id &&
        b.status === "planned" &&
        new Date(b.start_at) >= new Date(block.start_at),
    ) ?? null;

  return (
    <FocusSession
      block={block}
      nextBlock={nextBlock}
      timeZone={ctx.timeZone}
      serverNow={new Date().toISOString()}
    />
  );
}
