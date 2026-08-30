# DayOS

A personal operating system for a student's day. DayOS takes everything you
have to do — assignments, practice, projects, the things you keep forgetting —
and turns it into a schedule that fits the time you actually have.

It is built around one question:

> **What should I be doing right now?**

Every screen is judged by how fast it answers that.

```
Capture  →  Understand  →  Plan  →  Execute  →  Learn
```

---

## What it does

**Capture.** A floating `+` on every screen. Dump a messy thought — *"finish my
math worksheet, practice piano, workout, and work on my app tomorrow"* — and it
becomes four tasks with categories, durations and the deadline you actually
stated. Photograph an assignment sheet and the details are read off it. Nothing
is saved until you've seen it and can correct it.

**Plan.** `⚡ Plan My Day` builds today's schedule from your open tasks, your
deadlines, your fixed commitments and the time that's genuinely left. It splits
long work into focus sessions, puts breaks between them, keeps subjects
together, and leaves the day some slack. If everything can't fit, it says so and
names what has to move.

**Execute.** The Today screen shows one thing: what's next, when, and a Start
button. Focus Mode is a countdown and four controls. Can't do it right now?
Reschedule, skip, mark it done, or tell DayOS what changed — *"I only have 30
minutes"* — and it rebuilds the rest of the day around that.

**Learn.** The daily review counts what actually happened and adjusts how long
DayOS thinks your work takes. Consistently need 60 minutes for something you
called 30? Future estimates widen. That's the only thing it learns.

---

## How the planning works

The model is never trusted with correctness. It proposes; the application
enforces.

1. **Availability** is computed from your waking hours, your declared free
   windows, your fixed commitments (classes, practice, shifts) and what you've
   already done today. The result is a list of concrete free windows.
2. **Priority** is scored per task — deadline proximity, your own label,
   estimated effort against time remaining, how many times you've pushed it,
   and whether anything is waiting on it. A "low" task due in two hours
   outranks a "high" one due next month.
3. **A schedule is proposed**, by the model when an API key is configured and
   by the built-in scheduler otherwise.
4. **The proposal is repaired.** Blocks that overlap, sit outside your free
   time, land on a commitment, start in the past, or name a task that doesn't
   exist are dropped and reported. A model can't rename your tasks either — the
   stored title always wins.
5. **If nothing survives**, the built-in scheduler runs instead. You always end
   up with a plan.

Steps 1, 2, 4 and 5 are pure functions with direct test coverage. Step 3 is the
only part a model touches.

**Without an `ANTHROPIC_API_KEY`, DayOS works end to end.** Planning,
rescheduling, task parsing, project breakdown, reviews and the "what should I do
right now?" question all have real fallbacks — not stubs. They're less clever,
and they say so.

---

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run dev
```

Visiting the app before it's configured lands you on `/setup`, which walks
through the same three steps:

1. **Create a Supabase project**, then run `supabase/migrations/0001_init.sql`
   in its SQL editor. That creates every table and the Row Level Security
   policies.
2. **Fill in `.env.local`** — `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required; `ANTHROPIC_API_KEY` unlocks the
   AI paths.
3. **Restart the dev server.**

Set `NEXT_PUBLIC_ENABLE_DEMO_MODE=true` and Profile gains a **Load demo data**
button: a believable week of a student's school, sports, music and coding work,
so you can see what the product is for in one click.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run icons` | Regenerate the PWA icon set |

---

## Security

- **Row Level Security on every table.** Policies compare `user_id` against
  `auth.uid()`, which Postgres derives from the verified JWT.
- **The client never names a user.** Every server action resolves identity from
  the session with `requireUser()`. A structural test enforces this: no action
  schema may accept a `user_id`, and every direct mutation must be scoped.
- **No service-role key at all.** Every write — demo seeding included — goes
  through the signed-in user's own session, so RLS is always in the enforcement
  path and there is no key that could bypass it.
- **Secrets stay server-side.** Every model call happens in a server action. A
  test asserts no client component imports the AI client or a server-only
  secret.
- **Every input is validated with Zod** — from the browser and from the model
  alike. Model output is schema-constrained *and* re-validated at the boundary
  where it becomes application data.
- **Errors don't leak.** Server actions return a plain sentence; the detail goes
  to the server log.

---

## Architecture

```
app/
  (auth)/          sign in, sign up, auth actions
  (app)/           the signed-in shell: today, tasks, plan, projects, goals,
                   profile, review
  focus/[blockId]/ full-screen focus mode
  onboarding/      first-run setup
  actions/         server actions — the only write path
components/        ui primitives, then one folder per surface
lib/
  ai/              the single boundary to the model: client, prompts, schemas,
                   and one module per capability
  planner/         availability, priority, scheduling, repair, estimates, "now"
  supabase/        browser / server / admin clients
  data/            server-side queries
  notifications/   what a day earns, independent of how it's delivered
  utils/           time, dates, formatting
  validation/      shared Zod schemas
supabase/migrations/  the schema and its RLS policies
tests/             the logic that has to be right
types/
```

Two boundaries are worth knowing about:

**`lib/ai/` is the only place that talks to a model.** Nothing else imports the
SDK. Prompts live in `lib/ai/prompts.ts` — one body of text to read and diff,
never scattered through UI code. Every response is a Zod-validated structured
output; no response is parsed out of prose.

**`lib/planner/` is pure.** No database, no network, no clock beyond what it's
handed. That's what makes the scheduling rules testable, and it's why the
guarantees above are guarantees rather than intentions.

The backend is Supabase and the API surface is server actions, so a native iOS
client could be built against the same database and the same rules.

---

## Testing

```bash
npm run test
```

236 tests over the parts that have to be correct: timezone and DST handling,
interval maths and overlap detection, the priority model, availability, the
scheduler, the repair pass, estimate calibration, natural-language task parsing,
"now" logic, notification scheduling, and the validation schemas.

`tests/plan-pipeline.test.ts` runs the whole planning flow against a fake
Supabase client — including the scenario the product is judged on: five tasks,
one evening, planned and then replanned after something slips.

`tests/server-actions.test.ts` holds the security properties above as structural
assertions, so they can't quietly regress.

---

## Mobile

Mobile is the primary experience. Bottom navigation in the thumb zone, safe-area
padding throughout, tap targets sized for a phone, sheets that come up from the
bottom, and no interaction that needs a mouse. The desktop layout is the same
app with the navigation moved to a sidebar.

DayOS installs as a PWA. The service worker is deliberately minimal — it caches
icons and serves an offline page, and does *not* cache your schedule. A stale
schedule is worse than an honest "you're offline".
