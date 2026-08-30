/**
 * Category accents.
 *
 * Colour is a secondary signal here — every surface that uses these also shows
 * the category name, so nothing depends on hue alone.
 */
const ACCENTS: Record<string, string> = {
  School: "oklch(0.55 0.16 258)",
  Sports: "oklch(0.60 0.15 145)",
  Fitness: "oklch(0.62 0.16 35)",
  Music: "oklch(0.58 0.16 320)",
  Coding: "oklch(0.56 0.13 205)",
  Projects: "oklch(0.60 0.14 85)",
  Personal: "oklch(0.58 0.05 265)",
  Other: "oklch(0.60 0.02 265)",
};

export function categoryColor(category: string): string {
  return ACCENTS[category] ?? ACCENTS.Other;
}
