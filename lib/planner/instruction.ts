/**
 * Reads a time budget out of what the user typed when they said they can't do
 * something right now.
 *
 * The model handles the general case, but "I only have 30 minutes" is both the
 * most common thing a student says and perfectly parseable without one — so
 * the built-in scheduler honours it too, rather than silently replanning the
 * day exactly as it was.
 */

const HOUR_WORDS: Record<string, number> = {
  an: 60,
  a: 60,
  one: 60,
  two: 120,
  three: 180,
};

/** Minutes the user says they have, or null if they didn't say. */
export function parseTimeBudget(instruction: string): number | null {
  const text = instruction.toLowerCase();

  // "half an hour", "half hour"
  if (/\bhalf\s+(an\s+)?hour\b/.test(text)) return 30;

  // "an hour and a half", "1.5 hours"
  if (/\b(an?|one)\s+hour\s+and\s+a\s+half\b/.test(text)) return 90;

  // "1.5 hours", "2.5 hrs"
  const fractional = text.match(/\b(\d+)\.(\d+)\s*(?:h|hr|hrs|hours?)\b/);
  if (fractional) {
    const minutes =
      Number(fractional[1]) * 60 +
      Math.round(Number(`0.${fractional[2]}`) * 60);
    return clamp(minutes);
  }

  // "2 hours 30 minutes", "1 hr 15"
  const compound = text.match(
    /\b(\d+)\s*(?:h|hr|hrs|hours?)\s*(?:and\s*)?(\d+)\s*(?:m|min|mins|minutes?)?\b/,
  );
  if (compound) {
    return clamp(Number(compound[1]) * 60 + Number(compound[2]));
  }

  // "2 hours", "an hour", "two hours"
  const hours = text.match(/\b(\d+|an?|one|two|three)\s*(?:h|hr|hrs|hours?)\b/);
  if (hours) {
    const word = hours[1];
    const value = HOUR_WORDS[word] ?? Number(word) * 60;
    if (Number.isFinite(value) && value > 0) return clamp(value);
  }

  // "30 minutes", "45 mins", "20m"
  const minutes = text.match(/\b(\d+)\s*(?:m|min|mins|minutes?)\b/);
  if (minutes) return clamp(Number(minutes[1]));

  return null;
}

function clamp(minutes: number): number {
  return Math.min(600, Math.max(5, Math.round(minutes)));
}
