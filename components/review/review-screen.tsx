"use client";

import * as React from "react";
import { CalendarRange, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import {
  generateDailyReview,
  generateWeeklyReview,
  type DailyReviewResult,
  type WeeklyReviewResult,
} from "@/app/actions/reviews";
import { formatDuration, formatRelativeDay } from "@/lib/utils/time";
import type { DailyReview, WeeklyReview } from "@/types/db";
import { cn } from "@/lib/utils/cn";

/**
 * Daily and weekly review.
 *
 * Both are generated on demand rather than on a schedule — a review the user
 * asked for is one they'll read.
 */
export function ReviewScreen({
  todayKey,
  existingDaily,
  existingWeekly,
  liveStats,
}: {
  todayKey: string;
  existingDaily: DailyReview | null;
  existingWeekly: WeeklyReview | null;
  liveStats: {
    completedCount: number;
    postponedCount: number;
    plannedMinutes: number;
    actualMinutes: number;
  };
}) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"day" | "week">("day");
  const [reflection, setReflection] = React.useState(
    existingDaily?.reflection ?? "",
  );
  const [daily, setDaily] = React.useState<DailyReviewResult | null>(
    existingDaily
      ? {
          summary: existingDaily.ai_summary ?? "",
          estimateNote: null,
          completedCount: existingDaily.completed_count,
          postponedCount: existingDaily.postponed_count,
          plannedMinutes: existingDaily.planned_minutes,
          actualMinutes: existingDaily.actual_minutes,
        }
      : null,
  );
  const [weekly, setWeekly] = React.useState<WeeklyReviewResult | null>(
    existingWeekly
      ? {
          summary: existingWeekly.ai_summary ?? "",
          focusNextWeek: null,
          stats: existingWeekly.stats,
        }
      : null,
  );
  const [pending, setPending] = React.useState(false);

  async function runDaily() {
    setPending(true);
    const result = await generateDailyReview({ reflection });
    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setDaily(result.data);
  }

  async function runWeekly() {
    setPending(true);
    const result = await generateWeeklyReview();
    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setWeekly(result.data);
  }

  const stats = daily ?? { ...liveStats, summary: "", estimateNote: null };

  return (
    <>
      <PageHeader title="Review" subtitle="How it actually went." />

      <div
        role="tablist"
        aria-label="Review period"
        className="mb-5 flex rounded-xl border border-border bg-surface p-0.5"
      >
        {(
          [
            ["day", "Today"],
            ["week", "This week"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "flex-1 rounded-[9px] px-3 py-2 text-sm transition-colors",
              tab === value
                ? "bg-accent-soft font-medium text-accent"
                : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "day" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Tasks completed" value={String(stats.completedCount)} />
            <Stat label="Postponed" value={String(stats.postponedCount)} />
            <Stat
              label="Planned time"
              value={formatDuration(stats.plannedMinutes)}
            />
            <Stat
              label="Time worked"
              value={formatDuration(stats.actualMinutes)}
            />
          </div>

          <Card>
            <CardContent className="pt-4">
              <label
                htmlFor="reflection"
                className="text-[15px] font-medium"
              >
                How did today go?
              </label>
              <Textarea
                id="reflection"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="A sentence is plenty."
                className="mt-2"
                maxLength={1000}
              />
              <Button
                className="mt-3 w-full"
                onClick={runDaily}
                loading={pending}
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {daily ? "Update review" : "Write my review"}
              </Button>
            </CardContent>
          </Card>

          {daily?.summary ? (
            <Card className="animate-rise">
              <CardContent className="pt-4">
                <p className="text-[11px] font-semibold tracking-wider text-faint uppercase">
                  {formatRelativeDay(todayKey, todayKey)}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed">
                  {daily.summary}
                </p>
                {daily.estimateNote ? (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
                    <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    {daily.estimateNote}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {weekly ? (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <Stat
                  label="Completion rate"
                  value={`${weekly.stats.completionRate}%`}
                />
                <Stat
                  label="Tasks completed"
                  value={String(weekly.stats.completed)}
                />
                <Stat
                  label="Planned"
                  value={formatDuration(weekly.stats.plannedMinutes)}
                />
                <Stat
                  label="Worked"
                  value={formatDuration(weekly.stats.actualMinutes)}
                />
              </div>

              <Card className="animate-rise">
                <CardContent className="pt-4">
                  <p className="text-[11px] font-semibold tracking-wider text-faint uppercase">
                    AI weekly summary
                  </p>
                  <p className="mt-2 text-[15px] leading-relaxed">
                    {weekly.summary}
                  </p>
                </CardContent>
              </Card>

              {weekly.stats.upcomingDeadlines.length ? (
                <Section title="Upcoming deadlines">
                  <ul className="space-y-1.5">
                    {weekly.stats.upcomingDeadlines.map((d) => (
                      <li
                        key={`${d.title}-${d.deadline}`}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="truncate">{d.title}</span>
                        <span className="shrink-0 text-muted">
                          {formatRelativeDay(d.deadline.slice(0, 10), todayKey)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {weekly.stats.projectProgress.length ? (
                <Section title="Project progress">
                  <ul className="space-y-3">
                    {weekly.stats.projectProgress.map((p) => (
                      <li key={p.title}>
                        <div className="mb-1 flex items-baseline justify-between text-sm">
                          <span className="truncate">{p.title}</span>
                          <span className="tnum shrink-0 text-muted">
                            {p.progress}%
                          </span>
                        </div>
                        <Progress value={p.progress} label={p.title} />
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {weekly.stats.mostPostponed.length ? (
                <Section title="Most postponed">
                  <ul className="space-y-1.5">
                    {weekly.stats.mostPostponed.map((t) => (
                      <li
                        key={t.title}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="truncate">{t.title}</span>
                        <span className="shrink-0 text-muted">
                          {t.count}×
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}
            </>
          ) : (
            <Card>
              <CardContent className="pt-4 text-center">
                <CalendarRange
                  className="mx-auto h-6 w-6 text-faint"
                  aria-hidden
                />
                <p className="mt-3 text-[15px] font-medium">
                  Nothing summarised yet this week.
                </p>
                <p className="mt-1 text-sm text-muted">
                  DayOS will pull together what you finished, what slipped, and
                  what&apos;s coming.
                </p>
              </CardContent>
            </Card>
          )}

          <Button className="w-full" onClick={runWeekly} loading={pending}>
            <Sparkles className="h-4 w-4" aria-hidden />
            {weekly ? "Refresh weekly summary" : "Generate weekly summary"}
          </Button>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
      <p className="text-[11px] tracking-wider text-faint uppercase">{label}</p>
      <p className="tnum mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-faint uppercase">
        {title}
      </h2>
      <Card>
        <CardContent className="pt-4">{children}</CardContent>
      </Card>
    </section>
  );
}
