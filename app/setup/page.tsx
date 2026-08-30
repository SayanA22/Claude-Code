import type { Metadata } from "next";
import { Database, KeyRound, Terminal } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Setup" };

const STEPS = [
  {
    icon: Database,
    title: "Create a Supabase project",
    body: "Then run supabase/migrations/0001_init.sql in the SQL editor. It creates every table plus the Row Level Security policies.",
  },
  {
    icon: KeyRound,
    title: "Add your keys",
    body: "Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Add ANTHROPIC_API_KEY for AI planning — without it DayOS falls back to its built-in scheduler.",
  },
  {
    icon: Terminal,
    title: "Restart the dev server",
    body: "npm run dev picks the new environment up on boot.",
  },
];

export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-5 py-12">
      <Wordmark className="mb-8" />
      <h1 className="text-2xl font-semibold tracking-tight">
        Three steps to go
      </h1>
      <p className="mt-2 text-sm text-muted">
        DayOS needs a Supabase project before it can store anything.
      </p>

      <ol className="mt-6 space-y-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title}>
            <Card>
              <CardContent className="flex gap-3.5 pt-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-[15px] font-medium">
                    {i + 1}. {title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {body}
                  </p>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </main>
  );
}
