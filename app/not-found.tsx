import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <Wordmark className="mb-6" />
      <h1 className="text-lg font-semibold tracking-tight">
        That page doesn&apos;t exist.
      </h1>
      <p className="mt-1.5 max-w-xs text-sm text-muted">
        It may have been deleted, or the link is wrong.
      </p>
      <Button asChild className="mt-5">
        <Link href="/today">Go to Today</Link>
      </Button>
    </main>
  );
}
