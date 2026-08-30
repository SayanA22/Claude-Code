import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <AuthForm
      mode="signin"
      next={next}
      initialNotice={
        error === "link"
          ? "That link has expired or was already used. Sign in below, or sign up again to get a new one."
          : undefined
      }
      footer={
        <p className="text-center text-sm text-muted">
          New here?{" "}
          <Link href="/signup" className="font-medium text-accent underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      }
    />
  );
}
