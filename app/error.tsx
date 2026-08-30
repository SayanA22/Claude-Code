"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary. Users see a plain sentence and a way forward;
 * the detail goes to the server log, never the screen.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[dayos:render]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center px-6 text-center">
      <AlertTriangle className="h-6 w-6 text-warning" aria-hidden />
      <h1 className="mt-4 text-lg font-semibold tracking-tight">
        Something went wrong loading this.
      </h1>
      <p className="mt-1.5 max-w-xs text-sm text-muted">
        Your tasks are safe. Try again — if it keeps happening, reload the page.
      </p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
