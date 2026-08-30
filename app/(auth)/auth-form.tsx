"use client";

import { useActionState } from "react";
import { AlertCircle, Mail } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { signIn, signUp, type AuthState } from "./actions";

const COPY = {
  signin: {
    heading: "Welcome back",
    sub: "Pick up where your day left off.",
    cta: "Sign in",
  },
  signup: {
    heading: "Start your day, planned",
    sub: "DayOS turns everything you have to do into a schedule that actually fits.",
    cta: "Create account",
  },
} as const;

export function AuthForm({
  mode,
  next,
  footer,
  initialNotice,
}: {
  mode: "signin" | "signup";
  next?: string;
  footer: React.ReactNode;
  /** Shown before the user submits anything — e.g. an expired auth link. */
  initialNotice?: string;
}) {
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );
  const copy = COPY[mode];
  const notice = state.notice ?? initialNotice;

  return (
    <div className="animate-rise">
      <Wordmark className="mb-8 justify-center" />

      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {copy.heading}
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-center text-sm text-muted">
        {copy.sub}
      </p>

      <form action={formAction} className="mt-8 space-y-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}

        {mode === "signup" ? (
          <Field label="Your name" htmlFor="fullName">
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              placeholder="Alex"
              required
            />
          </Field>
        ) : null}

        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@school.edu"
            required
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint={mode === "signup" ? "At least 8 characters." : undefined}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={8}
          />
        </Field>

        {state.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {state.error}
          </p>
        ) : null}

        {notice ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-sm"
          >
            <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {notice}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {copy.cta}
        </Button>
      </form>

      <div className="mt-6">{footer}</div>
    </div>
  );
}
