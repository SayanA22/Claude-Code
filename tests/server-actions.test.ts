import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural guards on the server-action layer.
 *
 * These can't exercise Row Level Security without a live database, so they
 * check the properties that make RLS sufficient: identity always comes from
 * the verified session, never from the client, and every mutation is scoped to
 * the signed-in user.
 */

const ACTIONS_DIR = join(process.cwd(), "app", "actions");
const actionFiles = readdirSync(ACTIONS_DIR).filter(
  (f) => f.endsWith(".ts") && f !== "result.ts",
);
const read = (file: string) => readFileSync(join(ACTIONS_DIR, file), "utf8");

describe("server actions", () => {
  it("has action modules to check", () => {
    expect(actionFiles.length).toBeGreaterThan(5);
  });

  it.each(actionFiles)("%s is marked as a server module", (file) => {
    expect(read(file).startsWith('"use server"')).toBe(true);
  });

  it.each(actionFiles)("%s never accepts a user id from the client", (file) => {
    const source = read(file);
    // A schema field named user_id / userId would let a caller name whose data
    // to touch. Identity must come from the session instead.
    expect(source).not.toMatch(/^\s*(user_id|userId):\s*(z\.|uuidSchema)/m);
  });

  it.each(actionFiles)("%s derives identity from the session", (file) => {
    const source = read(file);
    const mutates = /\.(insert|update|upsert|delete)\(/.test(source);
    if (!mutates) return;
    expect(source).toMatch(/requireUser\(\)|getUserContext\(\)/);
  });

  it.each(actionFiles)("%s scopes every direct mutation to the user", (file) => {
    const source = read(file);
    // Every `.update(`/`.delete(` on a table must be followed by a user_id or
    // primary-key filter before the statement ends.
    const statements = source.split(/\n\s*\n/);
    for (const statement of statements) {
      if (!/\.(update|delete)\(/.test(statement)) continue;
      if (!/\.from\(/.test(statement)) continue;
      expect(
        /eq\("user_id"/.test(statement) || /eq\("id", user\.id\)/.test(statement),
      ).toBe(true);
    }
  });

  it("never reaches for a client that would bypass Row Level Security", () => {
    // DayOS ships no service-role client: every write runs as the signed-in
    // user, so RLS is always in the enforcement path.
    const offenders = actionFiles.filter((file) => {
      const source = read(file);
      return (
        source.includes("createAdminClient") ||
        source.includes("SERVICE_ROLE")
      );
    });
    expect(offenders).toEqual([]);
  });

  it.each(actionFiles)("%s validates its input with Zod", (file) => {
    const source = read(file);
    // Every exported action either parses input or takes none at all.
    const exportsAction = /export async function/.test(source);
    if (!exportsAction) return;
    expect(source).toMatch(/safeParse|\.parse\(/);
  });
});

describe("client bundle safety", () => {
  const clientDirs = ["components", "lib/hooks"];

  function walk(dir: string): string[] {
    const full = join(process.cwd(), dir);
    const out: string[] = [];
    for (const entry of readdirSync(full, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(path));
      else if (/\.tsx?$/.test(entry.name)) out.push(path);
    }
    return out;
  }

  const clientFiles = clientDirs.flatMap(walk);

  it("finds client files to check", () => {
    expect(clientFiles.length).toBeGreaterThan(10);
  });

  it("never imports the AI client or the admin client into a component", () => {
    const offenders = clientFiles.filter((path) => {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      return (
        source.includes("@/lib/ai/client") || source.includes("@anthropic-ai/sdk")
      );
    });
    expect(offenders).toEqual([]);
  });

  it("never references a server-only secret in client code", () => {
    const offenders = clientFiles.filter((path) => {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      return (
        source.includes("SUPABASE_SERVICE_ROLE_KEY") ||
        source.includes("process.env.ANTHROPIC_API_KEY")
      );
    });
    expect(offenders).toEqual([]);
  });
});

describe("prompts", () => {
  const prompts = readFileSync(
    join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  it("tells every model not to invent user information", () => {
    expect(prompts).toMatch(/Never invent information about the user/i);
    expect(prompts).toMatch(/Never invent or guess a deadline/i);
  });

  it("tells the planner not to double-book or overrun free time", () => {
    expect(prompts).toMatch(/No two blocks may overlap/i);
    expect(prompts).toMatch(/must sit entirely inside one of the given free windows/i);
  });

  it("forbids claiming an action was performed", () => {
    expect(prompts).toMatch(/Never claim an action was performed/i);
  });

  it("keeps learning to productivity, not the person", () => {
    expect(prompts).toMatch(/Do not comment on the user's health, mood, or\s*\n?\s*character/i);
  });
});
