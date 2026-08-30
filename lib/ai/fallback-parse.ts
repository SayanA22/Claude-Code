import type { ParsedTask } from "@/lib/validation/task";

/**
 * Rule-based task parsing, used when no model is configured.
 *
 * It handles the phrasings a student actually types — "finish my APHUG notes
 * tomorrow for 45 minutes", "piano practice, workout, math worksheet" — so
 * development without an API key exercises the same flow as production. It is
 * a fallback, not a rival: the model handles everything this misses.
 */

const SPLIT_PATTERN =
  /\s*(?:,\s*(?:and\s+)?|\s+and\s+|\s*;\s*|\s*\n+\s*|\s*•\s*)/i;

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const CATEGORY_HINTS: [RegExp, string][] = [
  [/\b(piano|guitar|violin|band|choir|music|practice\s+scales)\b/i, "Music"],
  [/\b(basketball|soccer|football|track|tennis|baseball|volleyball|swim|practice|game|scrimmage)\b/i, "Sports"],
  [/\b(workout|gym|lift|run|running|cardio|exercise|stretch)\b/i, "Fitness"],
  [/\b(code|coding|app|program|programming|leetcode|bug|refactor|deploy|api)\b/i, "Coding"],
  [/\b(hw|homework|essay|study|studying|exam|test|quiz|worksheet|notes|chapter|lab|reading|assignment|class|math|history|biology|chemistry|physics|english|aphug|ap\s+\w+)\b/i, "School"],
  [/\b(project|build|design|prototype|research\s+project)\b/i, "Projects"],
];

const PRIORITY_HINTS: [RegExp, ParsedTask["priority"]][] = [
  [/\b(urgent|asap|critical|must|emergency)\b/i, "critical"],
  [/\b(important|high\s+priority|priority)\b/i, "high"],
  [/\b(whenever|sometime|eventually|low\s+priority|if\s+i\s+have\s+time)\b/i, "low"],
];

export function fallbackParseTasks(
  input: string,
  now: Date,
  weekdayToday: number,
): ParsedTask[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  return trimmed
    .split(SPLIT_PATTERN)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .slice(0, 12)
    .map((segment) => parseSegment(segment, now, weekdayToday));
}

function parseSegment(
  raw: string,
  now: Date,
  weekdayToday: number,
): ParsedTask {
  let text = raw;

  const duration = extractDuration(text);
  if (duration.matched) text = text.replace(duration.matched, " ");

  const time = extractTime(text);
  if (time.matched) text = text.replace(time.matched, " ");

  const day = extractDay(text, weekdayToday);
  if (day.matched) text = text.replace(day.matched, " ");

  const priority = detectPriority(raw);
  const category = detectCategory(raw);

  return {
    title: cleanTitle(text),
    category,
    priority,
    estimated_duration: duration.minutes ?? defaultDuration(category, raw),
    deadline_days_from_today: day.days,
    deadline_time: time.value,
    notes: null,
  };
}

function extractDuration(text: string): {
  minutes: number | null;
  matched: string | null;
} {
  const hourMin = text.match(/\b(\d+)\s*(?:h|hr|hrs|hours?)\s*(\d+)?\s*(?:m|min|mins|minutes?)?\b/i);
  if (hourMin) {
    const minutes = Number(hourMin[1]) * 60 + Number(hourMin[2] ?? 0);
    return { minutes: clampMinutes(minutes), matched: hourMin[0] };
  }
  const mins = text.match(/\b(\d+)\s*(?:m|min|mins|minutes?)\b/i);
  if (mins) return { minutes: clampMinutes(Number(mins[1])), matched: mins[0] };

  const half = text.match(/\b(?:half\s+an?\s+hour)\b/i);
  if (half) return { minutes: 30, matched: half[0] };

  return { minutes: null, matched: null };
}

function extractTime(text: string): { value: string | null; matched: string | null } {
  const m = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return { value: null, matched: null };

  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  const meridiem = m[3]?.toLowerCase();

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  // "at 6" with no meridiem, from a student, means the evening.
  if (!meridiem && hour <= 9) hour += 12;

  if (hour > 23 || minute > 59) return { value: null, matched: null };
  return {
    value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    matched: m[0],
  };
}

function extractDay(
  text: string,
  weekdayToday: number,
): { days: number | null; matched: string | null } {
  const tomorrow = text.match(/\btomorrow\b/i);
  if (tomorrow) return { days: 1, matched: tomorrow[0] };

  const today = text.match(/\b(today|tonight)\b/i);
  if (today) return { days: 0, matched: today[0] };

  const inDays = text.match(/\bin\s+(\d+)\s+days?\b/i);
  if (inDays) return { days: Number(inDays[1]), matched: inDays[0] };

  const nextWeek = text.match(/\bnext\s+week\b/i);
  if (nextWeek) return { days: 7, matched: nextWeek[0] };

  const weekday = text.match(
    /\b(?:on\s+|by\s+|due\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (weekday) {
    const target = WEEKDAYS.indexOf(weekday[1].toLowerCase());
    // Always the *next* occurrence — "Friday" said on Friday means next Friday.
    const delta = ((target - weekdayToday + 7) % 7) || 7;
    return { days: delta, matched: weekday[0] };
  }

  return { days: null, matched: null };
}

function detectCategory(text: string): string {
  for (const [pattern, category] of CATEGORY_HINTS) {
    if (pattern.test(text)) return category;
  }
  return "Personal";
}

function detectPriority(text: string): ParsedTask["priority"] {
  for (const [pattern, priority] of PRIORITY_HINTS) {
    if (pattern.test(text)) return priority;
  }
  return "medium";
}

function defaultDuration(category: string, text: string): number {
  if (/\b(test|exam|midterm|final)\b/i.test(text)) return 60;
  switch (category) {
    case "School":
      return 45;
    case "Fitness":
    case "Sports":
      return 45;
    case "Music":
      return 30;
    case "Coding":
    case "Projects":
      return 60;
    default:
      return 30;
  }
}

function cleanTitle(text: string): string {
  const cleaned = text
    .replace(/\b(?:i\s+)?(?:need\s+to|have\s+to|want\s+to|should|gotta|must)\b/gi, " ")
    .replace(/\b(?:for|by|due|on|at|spend|take|takes)\b\s*$/gi, " ")
    .replace(/\bmy\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.\-–—]+|[\s,.\-–—]+$/g, "")
    .trim();

  const title = cleaned || text.trim();
  return (title.charAt(0).toUpperCase() + title.slice(1)).slice(0, 300);
}

function clampMinutes(m: number): number {
  return Math.min(600, Math.max(5, Math.round(m)));
}
