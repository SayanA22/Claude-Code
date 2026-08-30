import { redirect } from "next/navigation";
import { AppChrome } from "@/components/chrome/app-chrome";
import { BottomNav } from "@/components/nav/bottom-nav";
import { Sidebar } from "@/components/nav/sidebar";
import { getUserContext } from "@/lib/data/profile";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { localDateKey } from "@/lib/utils/time";

/**
 * The signed-in shell: a sidebar on desktop, a bottom bar on phones, and a
 * single scrolling column of content between them.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) redirect("/setup");

  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile.onboarded) redirect("/onboarding");

  return (
    <div className="min-h-svh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-lg"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="md:pl-60">
        <main
          id="main"
          className="mx-auto w-full max-w-2xl px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-16"
        >
          {children}
        </main>
      </div>
      <AppChrome
        timeZone={ctx.timeZone}
        todayKey={localDateKey(new Date(), ctx.timeZone)}
        aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)}
      />
      <BottomNav />
    </div>
  );
}
