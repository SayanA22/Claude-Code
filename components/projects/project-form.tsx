"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  createProject,
  deleteProject,
  updateProject,
} from "@/app/actions/projects";
import { CATEGORIES, type Project } from "@/types/db";

export function ProjectForm({
  project,
  onDone,
}: {
  project?: Project;
  onDone: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = React.useState(project?.title ?? "");
  const [description, setDescription] = React.useState(
    project?.description ?? "",
  );
  const [category, setCategory] = React.useState(project?.category ?? "Projects");
  const [deadline, setDeadline] = React.useState(project?.deadline ?? "");
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setPending(true);

    const payload = { title, description, category, deadline };
    const result = project
      ? await updateProject({ id: project.id, ...payload })
      : await createProject(payload);

    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(project ? "Project updated" : "Project created", "success");
    onDone();
    router.refresh();
  }

  async function remove() {
    if (!project) return;
    setPending(true);
    const result = await deleteProject(project.id);
    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Project deleted. Its tasks were kept.");
    onDone();
    router.push("/projects");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Project" htmlFor="project-title">
        <Input
          id="project-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Science research project"
          required
          autoFocus={!project}
          maxLength={200}
        />
      </Field>

      <Field
        label="What is it?"
        htmlFor="project-description"
        hint="A sentence is enough. DayOS uses it when breaking the project down."
      >
        <Textarea
          id="project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" htmlFor="project-category">
          <Select
            id="project-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Deadline" htmlFor="project-deadline">
          <Input
            id="project-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" className="flex-1" loading={pending}>
          {project ? "Save changes" : "Create project"}
        </Button>
        {project ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={remove}
            aria-label="Delete project"
            disabled={pending}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </form>
  );
}
