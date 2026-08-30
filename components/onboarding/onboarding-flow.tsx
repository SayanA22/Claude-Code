"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus, X } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { completeOnboarding, type OnboardingInput } from "@/app/actions/onboarding";
import { cn } from "@/lib/utils/cn";
import { Chip, DayPicker } from "./chip";

const AREAS = [
  "School",
  "Sports",
  "Fitness",
  "Music",
  "Coding",
  "Projects",
  "Personal",
  "Other",
];

const GOAL_SUGGESTIONS = [
  "Improve my grades",
  "Train for a sport",
  "Practice piano consistently",
  "Build a project",
  "Learn to code",
  "Stay organised",
];

const STEPS = ["You", "Areas", "Goals", "Rhythm"] as const;

/**
 * Four short steps. Everything here changes how the planner behaves, so
 * nothing is asked for its own sake — and every field has a working default,
 * so a student can tap through in under a minute and refine later.
 */
export function OnboardingFlow({
  defaultName,
  defaultTimeZone,
}: {
  defaultName: string;
  defaultTimeZone: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = React.useState(0);
  const [pending, setPending] = React.useState(false);

  const [form, setForm] = React.useState<OnboardingInput>(() => ({
    fullName: defaultName,
    // The browser knows the user's zone; the stored default is only a fallback.
    timezone: detectTimeZone(defaultTimeZone),
    wakeTime: "07:00",
    bedTime: "22:30",
    areas: ["School"],
    schoolLabel: "School",
    schedule: { days: [1, 2, 3, 4, 5], start: "08:00", end: "15:30" },
    goals: [],
    focusMinutes: 45,
    breakMinutes: 10,
    energyPeak: "evening",
    freeWindows: [{ days: [1, 2, 3, 4, 5], start: "16:00", end: "21:00" }],
  }));

  const [goalDraft, setGoalDraft] = React.useState("");

  const set = <K extends keyof OnboardingInput>(
    key: K,
    value: OnboardingInput[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  function addGoal(title: string) {
    const trimmed = title.trim();
    if (!trimmed || form.goals.length >= 8) return;
    if (form.goals.some((g) => g.toLowerCase() === trimmed.toLowerCase())) return;
    set("goals", [...form.goals, trimmed]);
    setGoalDraft("");
  }

  async function submit() {
    setPending(true);
    const result = await completeOnboarding(form);
    setPending(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    router.push("/today");
    router.refresh();
  }

  const canAdvance = step === 0 ? form.fullName.trim().length > 0 : true;

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8">
      <Wordmark className="mb-6" />

      <ol className="mb-8 flex gap-1.5" aria-label="Setup progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <span className="sr-only">
              {label}
              {i === step ? " (current step)" : ""}
            </span>
            <span
              aria-hidden
              className={cn(
                "block h-1 rounded-full transition-colors",
                i <= step ? "bg-accent" : "bg-surface-2",
              )}
            />
          </li>
        ))}
      </ol>

      <div className="animate-rise flex-1" key={step}>
        {step === 0 ? (
          <section aria-labelledby="step-you">
            <h1 id="step-you" className="text-2xl font-semibold tracking-tight">
              First, the basics
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              DayOS plans around your actual day, so it needs to know its shape.
            </p>

            <div className="mt-6 space-y-4">
              <Field label="What should we call you?" htmlFor="fullName">
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  autoComplete="given-name"
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Usually up at" htmlFor="wakeTime">
                  <Input
                    id="wakeTime"
                    type="time"
                    value={form.wakeTime}
                    onChange={(e) => set("wakeTime", e.target.value)}
                  />
                </Field>
                <Field label="In bed by" htmlFor="bedTime">
                  <Input
                    id="bedTime"
                    type="time"
                    value={form.bedTime}
                    onChange={(e) => set("bedTime", e.target.value)}
                  />
                </Field>
              </div>

              <Field
                label="School or work"
                htmlFor="schoolLabel"
                hint="DayOS will never schedule work during these hours."
              >
                <Input
                  id="schoolLabel"
                  value={form.schoolLabel ?? ""}
                  onChange={(e) => set("schoolLabel", e.target.value)}
                  placeholder="Lincoln High"
                />
              </Field>

              <div>
                <p className="mb-2 text-sm font-medium text-muted">
                  Which days, and when?
                </p>
                <DayPicker
                  label="Days you're in school or work"
                  value={form.schedule?.days ?? []}
                  onChange={(days) =>
                    set("schedule", {
                      days,
                      start: form.schedule?.start ?? "08:00",
                      end: form.schedule?.end ?? "15:30",
                    })
                  }
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="From" htmlFor="scheduleStart">
                    <Input
                      id="scheduleStart"
                      type="time"
                      value={form.schedule?.start ?? "08:00"}
                      onChange={(e) =>
                        set("schedule", {
                          days: form.schedule?.days ?? [],
                          start: e.target.value,
                          end: form.schedule?.end ?? "15:30",
                        })
                      }
                    />
                  </Field>
                  <Field label="Until" htmlFor="scheduleEnd">
                    <Input
                      id="scheduleEnd"
                      type="time"
                      value={form.schedule?.end ?? "15:30"}
                      onChange={(e) =>
                        set("schedule", {
                          days: form.schedule?.days ?? [],
                          start: form.schedule?.start ?? "08:00",
                          end: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section aria-labelledby="step-areas">
            <h1 id="step-areas" className="text-2xl font-semibold tracking-tight">
              What fills your week?
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              Pick everything that applies. This shapes how DayOS groups your
              day.
            </p>

            <div
              role="group"
              aria-label="Areas of life"
              className="mt-6 flex flex-wrap gap-2"
            >
              {AREAS.map((area) => (
                <Chip
                  key={area}
                  label={area}
                  selected={form.areas.includes(area)}
                  onToggle={() =>
                    set(
                      "areas",
                      form.areas.includes(area)
                        ? form.areas.filter((a) => a !== area)
                        : [...form.areas, area],
                    )
                  }
                />
              ))}
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section aria-labelledby="step-goals">
            <h1 id="step-goals" className="text-2xl font-semibold tracking-tight">
              What are you trying to accomplish?
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              DayOS can turn a goal into real tasks later. Add as many as you
              like — or skip this.
            </p>

            <div className="mt-6 flex gap-2">
              <Input
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addGoal(goalDraft);
                  }
                }}
                placeholder="Finish my science project"
                aria-label="Add a goal"
                maxLength={160}
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => addGoal(goalDraft)}
                aria-label="Add goal"
                disabled={!goalDraft.trim()}
              >
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            {form.goals.length ? (
              <ul className="mt-4 space-y-2">
                {form.goals.map((goal) => (
                  <li
                    key={goal}
                    className="flex items-center gap-2 rounded-xl border border-border px-3.5 py-2.5"
                  >
                    <span className="flex-1 text-[0.9375rem]">{goal}</span>
                    <button
                      type="button"
                      onClick={() =>
                        set("goals", form.goals.filter((g) => g !== goal))
                      }
                      aria-label={`Remove ${goal}`}
                      className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-fg"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium tracking-wider text-faint uppercase">
                  Common ones
                </p>
                <div className="flex flex-wrap gap-2">
                  {GOAL_SUGGESTIONS.map((g) => (
                    <Chip
                      key={g}
                      label={g}
                      selected={false}
                      onToggle={() => addGoal(g)}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : null}

        {step === 3 ? (
          <section aria-labelledby="step-rhythm">
            <h1 id="step-rhythm" className="text-2xl font-semibold tracking-tight">
              How do you work best?
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              This decides how long DayOS makes each session and where it puts
              them.
            </p>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Focus session" htmlFor="focusMinutes">
                  <Select
                    id="focusMinutes"
                    value={String(form.focusMinutes)}
                    onChange={(e) => set("focusMinutes", Number(e.target.value))}
                  >
                    {[20, 25, 30, 45, 60, 90].map((m) => (
                      <option key={m} value={m}>
                        {m} minutes
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Break" htmlFor="breakMinutes">
                  <Select
                    id="breakMinutes"
                    value={String(form.breakMinutes)}
                    onChange={(e) => set("breakMinutes", Number(e.target.value))}
                  >
                    {[0, 5, 10, 15, 20].map((m) => (
                      <option key={m} value={m}>
                        {m === 0 ? "No break" : `${m} minutes`}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="You do your best work in the" htmlFor="energyPeak">
                <Select
                  id="energyPeak"
                  value={form.energyPeak}
                  onChange={(e) =>
                    set(
                      "energyPeak",
                      e.target.value as OnboardingInput["energyPeak"],
                    )
                  }
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                </Select>
              </Field>

              <div>
                <p className="mb-2 text-sm font-medium text-muted">
                  When are you usually free?
                </p>
                <DayPicker
                  label="Days you're usually free"
                  value={form.freeWindows[0]?.days ?? []}
                  onChange={(days) =>
                    set("freeWindows", [
                      {
                        days,
                        start: form.freeWindows[0]?.start ?? "16:00",
                        end: form.freeWindows[0]?.end ?? "21:00",
                      },
                    ])
                  }
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="From" htmlFor="freeStart">
                    <Input
                      id="freeStart"
                      type="time"
                      value={form.freeWindows[0]?.start ?? "16:00"}
                      onChange={(e) =>
                        set("freeWindows", [
                          {
                            days: form.freeWindows[0]?.days ?? [],
                            start: e.target.value,
                            end: form.freeWindows[0]?.end ?? "21:00",
                          },
                        ])
                      }
                    />
                  </Field>
                  <Field label="Until" htmlFor="freeEnd">
                    <Input
                      id="freeEnd"
                      type="time"
                      value={form.freeWindows[0]?.end ?? "21:00"}
                      onChange={(e) =>
                        set("freeWindows", [
                          {
                            days: form.freeWindows[0]?.days ?? [],
                            start: form.freeWindows[0]?.start ?? "16:00",
                            end: e.target.value,
                          },
                        ])
                      }
                    />
                  </Field>
                </div>
                <p className="mt-2 text-xs text-faint">
                  On days outside this, DayOS uses your whole waking day.
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <div className="mt-8 flex items-center gap-2 pb-safe">
        {step > 0 ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setStep((s) => s - 1)}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}

        {step < STEPS.length - 1 ? (
          <Button
            size="lg"
            className="flex-1"
            disabled={!canAdvance}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button size="lg" className="flex-1" onClick={submit} loading={pending}>
            Start using DayOS
          </Button>
        )}
      </div>
    </div>
  );
}

function detectTimeZone(fallback: string): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}
