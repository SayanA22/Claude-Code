/**
 * Server actions return this instead of throwing, so the client always has
 * something safe to render. Real errors are logged server-side; the user sees
 * a plain sentence.
 */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T) {
  return { ok: true as const, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false as const, error };
}

/**
 * Logs the underlying error with context and returns a message safe to show.
 * Stack traces and database details never reach the browser.
 */
export function handleActionError(
  scope: string,
  error: unknown,
  userMessage: string,
): ActionResult<never> {
  console.error(`[dayos:${scope}]`, error);
  return fail(userMessage);
}
