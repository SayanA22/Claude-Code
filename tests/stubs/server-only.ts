/**
 * Stand-in for the `server-only` package under test.
 *
 * In a build, importing `server-only` from client code is a hard error. Under
 * Vitest everything runs in Node, so the guard has nothing to do.
 */
export {};
