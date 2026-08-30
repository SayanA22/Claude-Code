"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { planDay } from "@/app/actions/plan";
import type { PlanOutcome } from "@/lib/planner/plan-day";

/**
 * The one button the whole product is built around.
 *
 * It always resolves to something: if the model is unavailable the server
 * falls back to the built-in scheduler, and if that fails too the user gets a
 * plain message and their tasks are untouched.
 */
export function PlanDayButton({
  label = "Plan My Day",
  onPlanned,
  ...props
}: {
  label?: string;
  onPlanned?: (outcome: PlanOutcome) => void;
} & Omit<ButtonProps, "onClick" | "children">) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);

  async function run() {
    setPending(true);
    const result = await planDay({});
    setPending(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    onPlanned?.(result.data);
    router.refresh();
  }

  return (
    <Button onClick={run} loading={pending} {...props}>
      {pending ? "Planning…" : (
        <>
          <Zap className="h-4 w-4" aria-hidden />
          {label}
        </>
      )}
    </Button>
  );
}
