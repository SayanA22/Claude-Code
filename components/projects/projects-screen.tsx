"use client";

import * as React from "react";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PageHeader } from "@/components/page-header";
import { CategoryDot } from "@/components/tasks/task-meta";
import { formatRelativeDay } from "@/lib/utils/time";
import type { ProjectWithProgress } from "@/lib/data/projects";
import { ProjectForm } from "./project-form";

export function ProjectsScreen({
  projects,
  todayKey,
}: {
  projects: ProjectWithProgress[];
  todayKey: string;
}) {
  const [creating, setCreating] = React.useState(false);

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={
          projects.length
            ? `${projects.length} active`
            : "Bigger things, broken down."
        }
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New
          </Button>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Big goal?"
          description="Create a project and DayOS will help break it down into tasks you can actually start."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New project
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {projects.map((project) => (
            <li key={project.id}>
              <Card className="transition-colors hover:border-border-strong">
                <Link
                  href={`/projects/${project.id}`}
                  className="block rounded-2xl"
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[16px] font-semibold tracking-tight">
                          {project.title}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <CategoryDot category={project.category} />
                            {project.category}
                          </span>
                          <span>
                            {project.completedCount}/{project.taskCount} tasks
                          </span>
                          {project.deadline ? (
                            <span>
                              Due {formatRelativeDay(project.deadline, todayKey)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <span className="tnum shrink-0 text-sm font-medium text-muted">
                        {project.progress}%
                      </span>
                    </div>
                    <Progress
                      value={project.progress}
                      className="mt-3"
                      label={`${project.title} progress`}
                    />
                  </CardContent>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent
          title="New project"
          description="DayOS can break it into tasks once it exists."
        >
          <ProjectForm onDone={() => setCreating(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
