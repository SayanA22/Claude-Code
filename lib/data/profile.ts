import "server-only";

import { cache } from "react";
import type { Profile, UserPreferences } from "@/types/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeTimeZone } from "@/lib/utils/time";

export interface UserContext {
  userId: string;
  email: string;
  profile: Profile;
  preferences: UserPreferences;
  timeZone: string;
}

const FALLBACK_PROFILE = (id: string): Profile => ({
  id,
  full_name: null,
  timezone: "UTC",
  wake_time: "07:00:00",
  bed_time: "22:30:00",
  school_label: null,
  areas: [],
  onboarded: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const FALLBACK_PREFS = (userId: string): UserPreferences => ({
  user_id: userId,
  focus_session_minutes: 45,
  break_minutes: 10,
  energy_peak: "evening",
  free_windows: [],
  estimate_multiplier: 1,
  notifications: {
    enabled: true,
    sessionStart: true,
    dailyPlanReminder: true,
    deadlineWarnings: true,
    quietHours: { start: "22:00", end: "07:00" },
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

/**
 * Loads the signed-in user with their profile and preferences.
 *
 * Deduped per request with `cache`, so the layout and the page it renders
 * share one round trip. Returns null when there is no session.
 *
 * If the bootstrap trigger hasn't run yet (a user created before the migration,
 * say), the rows are created on the fly rather than failing the render.
 */
export const getUserContext = cache(async (): Promise<UserContext | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, prefsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  let profile = profileRes.data as Profile | null;
  let preferences = prefsRes.data as UserPreferences | null;

  if (!profile) {
    const { data } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        full_name: (user.user_metadata?.full_name as string) ?? null,
      })
      .select()
      .maybeSingle();
    profile = (data as Profile | null) ?? FALLBACK_PROFILE(user.id);
  }

  if (!preferences) {
    const { data } = await supabase
      .from("user_preferences")
      .upsert({ user_id: user.id })
      .select()
      .maybeSingle();
    preferences = (data as UserPreferences | null) ?? FALLBACK_PREFS(user.id);
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    profile,
    preferences,
    timeZone: safeTimeZone(profile.timezone),
  };
});

/** First name, for greetings. Falls back to something friendly. */
export function displayName(profile: Profile): string {
  const name = profile.full_name?.trim();
  if (!name) return "there";
  return name.split(/\s+/)[0];
}
