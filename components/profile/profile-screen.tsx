"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Database,
  LogOut,
  Palette,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { SwitchRow } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { AppearanceSettings } from "./appearance-settings";
import {
  seedDemoData,
  updatePreferences,
  updateProfile,
} from "@/app/actions/preferences";
import { signOut } from "@/app/(auth)/actions";
import type { NotificationPrefs, Profile, UserPreferences } from "@/types/db";

/**
 * Profile and settings.
 *
 * Everything here feeds the planner, so each control says what it changes
 * rather than just naming a field.
 */
export function ProfileScreen({
  profile,
  preferences,
  email,
  demoEnabled,
  aiEnabled,
  stats,
}: {
  profile: Profile;
  preferences: UserPreferences;
  email: string;
  demoEnabled: boolean;
  aiEnabled: boolean;
  stats: { openTasks: number; completedAllTime: number };
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [fullName, setFullName] = React.useState(profile.full_name ?? "");
  const [wakeTime, setWakeTime] = React.useState(profile.wake_time.slice(0, 5));
  const [bedTime, setBedTime] = React.useState(profile.bed_time.slice(0, 5));
  const [focusMinutes, setFocusMinutes] = React.useState(
    preferences.focus_session_minutes,
  );
  const [breakMinutes, setBreakMinutes] = React.useState(
    preferences.break_minutes,
  );
  const [energyPeak, setEnergyPeak] = React.useState(preferences.energy_peak);
  const [notifications, setNotifications] = React.useState<NotificationPrefs>(
    preferences.notifications,
  );
  const [pending, setPending] = React.useState<string | null>(null);

  async function saveProfile() {
    setPending("profile");
    const result = await updateProfile({
      fullName,
      timezone: profile.timezone,
      wakeTime,
      bedTime,
    });
    setPending(null);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Saved", "success");
    router.refresh();
  }

  async function savePreferences(next: Partial<NotificationPrefs> = {}) {
    const merged = { ...notifications, ...next };
    setNotifications(merged);
    setPending("prefs");
    const result = await updatePreferences({
      focusMinutes,
      breakMinutes,
      energyPeak,
      notifications: merged,
    });
    setPending(null);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Saved", "success");
    router.refresh();
  }

  /**
   * Turning notifications on is what asks the browser for permission — DayOS
   * never prompts unprompted.
   */
  async function toggleNotifications(enabled: boolean) {
    if (enabled && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        const result = await Notification.requestPermission();
        if (result !== "granted") {
          toast(
            "Your browser blocked notifications. DayOS will keep them off.",
            "error",
          );
          await savePreferences({ enabled: false });
          return;
        }
      } else if (Notification.permission === "denied") {
        toast("Notifications are blocked in your browser settings.", "error");
        return;
      }
    }
    await savePreferences({ enabled });
  }

  async function loadDemo() {
    setPending("demo");
    const result = await seedDemoData();
    setPending(null);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`Added ${result.data.tasks} demo tasks`, "success");
    router.push("/today");
    router.refresh();
  }

  return (
    <>
      <PageHeader title="Profile" subtitle={email} />

      <div className="mb-5 grid grid-cols-2 gap-2.5">
        <Card>
          <CardContent className="pt-4">
            <p className="text-[0.75rem] tracking-wider text-faint uppercase">
              Open tasks
            </p>
            <p className="tnum mt-1 text-xl font-semibold">{stats.openTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[0.75rem] tracking-wider text-faint uppercase">
              Completed
            </p>
            <p className="tnum mt-1 text-xl font-semibold">
              {stats.completedAllTime}
            </p>
          </CardContent>
        </Card>
      </div>

      <Section title="You">
        <div className="space-y-4">
          <Field label="Name" htmlFor="profile-name">
            <Input
              id="profile-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={80}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Usually up at" htmlFor="profile-wake">
              <Input
                id="profile-wake"
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
              />
            </Field>
            <Field label="In bed by" htmlFor="profile-bed">
              <Input
                id="profile-bed"
                type="time"
                value={bedTime}
                onChange={(e) => setBedTime(e.target.value)}
              />
            </Field>
          </div>
          <p className="text-xs text-faint">
            Timezone: {profile.timezone}. DayOS never schedules outside these
            hours.
          </p>
          <Button
            onClick={saveProfile}
            loading={pending === "profile"}
            className="w-full"
          >
            Save
          </Button>
        </div>
      </Section>

      <Section title="How you work">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Focus session" htmlFor="pref-focus">
              <Select
                id="pref-focus"
                value={String(focusMinutes)}
                onChange={(e) => setFocusMinutes(Number(e.target.value))}
              >
                {[20, 25, 30, 45, 60, 90].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Break" htmlFor="pref-break">
              <Select
                id="pref-break"
                value={String(breakMinutes)}
                onChange={(e) => setBreakMinutes(Number(e.target.value))}
              >
                {[0, 5, 10, 15, 20].map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "No break" : `${m} minutes`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Best work happens in the" htmlFor="pref-energy">
            <Select
              id="pref-energy"
              value={energyPeak}
              onChange={(e) =>
                setEnergyPeak(e.target.value as typeof energyPeak)
              }
            >
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </Select>
          </Field>

          <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
            <p className="text-[0.8125rem] text-muted">
              DayOS currently plans{" "}
              <span className="font-medium text-fg">
                {Math.round(preferences.estimate_multiplier * 100)}%
              </span>{" "}
              of the time you estimate, learned from how long your tasks
              actually take.
            </p>
          </div>

          <Button
            onClick={() => savePreferences()}
            loading={pending === "prefs"}
            className="w-full"
          >
            Save
          </Button>
        </div>
      </Section>

      <Section title="Notifications" icon={Bell}>
        <div className="divide-y divide-border">
          <SwitchRow
            id="notif-enabled"
            label="Notifications"
            hint="DayOS keeps these rare — at most a handful a day."
            checked={notifications.enabled}
            onCheckedChange={toggleNotifications}
          />
          <SwitchRow
            id="notif-session"
            label="Before a session starts"
            hint="Ten minutes ahead."
            checked={notifications.sessionStart}
            disabled={!notifications.enabled}
            onCheckedChange={(v) => savePreferences({ sessionStart: v })}
          />
          <SwitchRow
            id="notif-remaining"
            label="Evening check-in"
            hint="Only when important work is still open."
            checked={notifications.dailyPlanReminder}
            disabled={!notifications.enabled}
            onCheckedChange={(v) => savePreferences({ dailyPlanReminder: v })}
          />
          <SwitchRow
            id="notif-deadline"
            label="Deadline warnings"
            hint="One reminder, a day before something is due."
            checked={notifications.deadlineWarnings}
            disabled={!notifications.enabled}
            onCheckedChange={(v) => savePreferences({ deadlineWarnings: v })}
          />
        </div>
        <p className="mt-2 text-xs text-faint">
          Quiet hours: {notifications.quietHours.start} –{" "}
          {notifications.quietHours.end}. Nothing is sent in that window.
        </p>
      </Section>

      <Section title="Appearance" icon={Palette}>
        <AppearanceSettings />
      </Section>

      <Section title="More">
        <div className="space-y-2">
          <Button asChild variant="outline" className="w-full justify-start">
            <Link href="/goals">
              <Target className="h-4 w-4" aria-hidden />
              Goals
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start">
            <Link href="/review">
              <Sparkles className="h-4 w-4" aria-hidden />
              Daily &amp; weekly review
            </Link>
          </Button>

          {demoEnabled ? (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={loadDemo}
              loading={pending === "demo"}
            >
              <Database className="h-4 w-4" aria-hidden />
              Load demo data
            </Button>
          ) : null}

          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start text-danger"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </form>
        </div>

        <p className="mt-3 text-xs text-faint">
          {aiEnabled
            ? "AI planning is on."
            : "No API key configured — DayOS is using its built-in scheduler."}
        </p>
      </Section>
    </>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[0.75rem] font-semibold tracking-wider text-faint uppercase">
        {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
        {title}
      </h2>
      <Card>
        <CardContent className="pt-4">{children}</CardContent>
      </Card>
    </section>
  );
}
