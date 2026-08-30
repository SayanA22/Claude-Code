/**
 * Per-device appearance settings: theme, accent scheme and text size.
 *
 * These live in `localStorage` rather than the database — they belong to the
 * device you're reading on, not the account. A phone in bright sun and a
 * laptop at night want different answers.
 *
 * The values are applied to <html> before first paint by the inline script in
 * `app/layout.tsx`; the CSS for each lives in `app/globals.css`.
 */

export const THEME_KEY = "dayos-theme";
export const ACCENT_KEY = "dayos-accent";
export const TEXT_KEY = "dayos-text";
export const APPEARANCE_EVENT = "dayos-appearance-change";

export type Theme = "light" | "dark" | "system";
export type Accent =
  | "indigo"
  | "violet"
  | "blue"
  | "teal"
  | "green"
  | "bronze"
  | "rose";
export type TextSize = "default" | "large" | "xlarge";

export const DEFAULT_ACCENT: Accent = "indigo";
export const DEFAULT_TEXT: TextSize = "default";

export const ACCENTS: { value: Accent; label: string }[] = [
  { value: "indigo", label: "Indigo" },
  { value: "violet", label: "Violet" },
  { value: "blue", label: "Blue" },
  { value: "teal", label: "Teal" },
  { value: "green", label: "Green" },
  { value: "bronze", label: "Bronze" },
  { value: "rose", label: "Rose" },
];

export const TEXT_SIZES: { value: TextSize; label: string; sample: string }[] = [
  { value: "default", label: "Default", sample: "Aa" },
  { value: "large", label: "Large", sample: "Aa" },
  { value: "xlarge", label: "Larger", sample: "Aa" },
];

/**
 * The swatch colour shown in Settings.
 *
 * Deliberately the light-mode accent for every scheme, so the swatches read as
 * one row of colours rather than shifting with the current theme.
 */
export const ACCENT_SWATCH: Record<Accent, string> = {
  indigo: "oklch(0.52 0.17 268)",
  violet: "oklch(0.53 0.19 305)",
  blue: "oklch(0.52 0.15 248)",
  teal: "oklch(0.51 0.1 200)",
  green: "oklch(0.51 0.12 155)",
  bronze: "oklch(0.545 0.13 70)",
  rose: "oklch(0.54 0.18 15)",
};

export function isAccent(value: unknown): value is Accent {
  return ACCENTS.some((a) => a.value === value);
}

export function isTextSize(value: unknown): value is TextSize {
  return TEXT_SIZES.some((t) => t.value === value);
}

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/** Reads a stored setting, falling back when storage is unavailable. */
export function readStored<T>(
  key: string,
  guard: (value: unknown) => value is T,
  fallback: T,
): T {
  try {
    const stored = localStorage.getItem(key);
    return guard(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

/** Writes a setting and applies it to the document immediately. */
export function applyAppearance(
  patch: Partial<{ theme: Theme; accent: Accent; text: TextSize }>,
) {
  const root = document.documentElement;

  try {
    if (patch.theme !== undefined) {
      if (patch.theme === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, patch.theme);
    }
    if (patch.accent !== undefined) localStorage.setItem(ACCENT_KEY, patch.accent);
    if (patch.text !== undefined) {
      if (patch.text === "default") localStorage.removeItem(TEXT_KEY);
      else localStorage.setItem(TEXT_KEY, patch.text);
    }
  } catch {
    // Storage can be blocked; the change still applies for this session.
  }

  if (patch.theme !== undefined) {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    root.classList.toggle(
      "dark",
      patch.theme === "dark" || (patch.theme === "system" && prefersDark),
    );
  }
  if (patch.accent !== undefined) root.dataset.accent = patch.accent;
  if (patch.text !== undefined) {
    if (patch.text === "default") delete root.dataset.text;
    else root.dataset.text = patch.text;
  }

  window.dispatchEvent(new Event(APPEARANCE_EVENT));
}
