"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  readAssignmentImage,
  type AssignmentDraft,
} from "@/app/actions/assignment";
import { createTask } from "@/app/actions/tasks";
import { deadlineToIso } from "@/components/tasks/task-form";
import { addDaysToKey } from "@/lib/utils/time";

/**
 * Add an assignment — typed in, or read from a photo of the sheet.
 *
 * Anything the model reads out of an image lands in an editable form marked
 * with its confidence, and is only saved once the user confirms it.
 */
export function AssignmentCapture({
  timeZone,
  todayKey,
  aiEnabled,
  onDone,
}: {
  timeZone: string;
  todayKey: string;
  aiEnabled: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInput = React.useRef<HTMLInputElement>(null);

  const [title, setTitle] = React.useState("");
  const [className, setClassName] = React.useState("");
  const [dueDate, setDueDate] = React.useState(addDaysToKey(todayKey, 1));
  const [minutes, setMinutes] = React.useState(45);
  const [reading, setReading] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [lowConfidence, setLowConfidence] = React.useState(false);

  function applyDraft(draft: AssignmentDraft) {
    setTitle(draft.title);
    setClassName(draft.className ?? "");
    setMinutes(draft.estimatedDuration);
    setLowConfidence(draft.confidence === "low");
    if (draft.deadline) {
      setDueDate(
        new Intl.DateTimeFormat("en-CA", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(draft.deadline)),
      );
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setReading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await readAssignmentImage({ imageDataUrl: dataUrl });
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      applyDraft(result.data);
      toast("Check what I read before saving.");
    } catch {
      toast("Couldn't read that file.", "error");
    } finally {
      setReading(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    setPending(true);
    const result = await createTask({
      title: title.trim(),
      category: "School",
      priority: "high",
      description: className.trim() || null,
      deadline: deadlineToIso(dueDate, "", timeZone),
      estimated_duration: minutes,
    });
    setPending(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Assignment added", "success");
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {aiEnabled ? (
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            capture="environment"
            onChange={onFile}
            className="sr-only"
            aria-label="Photo of the assignment"
          />
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            loading={reading}
            onClick={() => fileInput.current?.click()}
          >
            {reading ? (
              "Reading the photo…"
            ) : (
              <>
                <Camera className="h-4 w-4" aria-hidden />
                Snap the assignment sheet
              </>
            )}
          </Button>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-faint">
            <ImageUp className="h-3 w-3" aria-hidden />
            DayOS fills the form in — you check it before it saves.
          </p>
        </div>
      ) : null}

      {lowConfidence ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          The photo was hard to read. Double-check the name and due date.
        </p>
      ) : null}

      <Field label="Assignment" htmlFor="assignment-title">
        <Input
          id="assignment-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Chapter 3 Review"
          required
          maxLength={300}
        />
      </Field>

      <Field label="Class" htmlFor="assignment-class">
        <Input
          id="assignment-class"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          placeholder="AP Human Geography"
          maxLength={120}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Due" htmlFor="assignment-due">
          <Input
            id="assignment-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <Field label="Minutes needed" htmlFor="assignment-minutes">
          <Input
            id="assignment-minutes"
            type="number"
            min={5}
            max={600}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </Field>
      </div>

      <Button type="submit" className="w-full" loading={pending}>
        Add assignment
      </Button>
    </form>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
