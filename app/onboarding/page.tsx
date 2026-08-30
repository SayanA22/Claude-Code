import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getUserContext } from "@/lib/data/profile";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Set up" };

export default async function OnboardingPage() {
  if (!isSupabaseConfigured) redirect("/setup");

  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.profile.onboarded) redirect("/today");

  return (
    <OnboardingFlow
      defaultName={ctx.profile.full_name ?? ""}
      defaultTimeZone={ctx.profile.timezone}
    />
  );
}
