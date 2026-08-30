import { redirect } from "next/navigation";
import { ProfileScreen } from "@/components/profile/profile-screen";
import { getUserContext } from "@/lib/data/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const [openRes, doneRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .in("status", ["todo", "in_progress"]),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .eq("status", "completed"),
  ]);

  return (
    <ProfileScreen
      profile={ctx.profile}
      preferences={ctx.preferences}
      email={ctx.email}
      demoEnabled={process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true"}
      aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)}
      stats={{
        openTasks: openRes.count ?? 0,
        completedAllTime: doneRes.count ?? 0,
      }}
    />
  );
}
