// biome-ignore-all lint/performance/noJsxPropsBind: The row owns form and input handlers that close over its current Project state.
import type { ProjectProfile } from "@cantiara/api/project-shell";
import { Badge } from "@cantiara/ui/components/badge";
import { Button, buttonVariants } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, FolderOpen, LockKeyhole, Plus, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/views/client-shell";
import {
  client,
  projectsQueryOptions,
  projectsQueryPrefix,
} from "@/utils/orpc";

function projectErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "data" in error) {
    const { data } = error;
    if (typeof data === "object" && data !== null && "label" in data) {
      const { label } = data;
      if (typeof label === "string") {
        return label;
      }
    }
  }
  return "Short code could not be saved. Try again.";
}

export default function ProjectsView() {
  const projects = useQuery(projectsQueryOptions());

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-6 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-balance font-semibold text-3xl tracking-tight">
            Projects
          </h1>
          <p className="mt-3 text-pretty text-muted-foreground text-sm/6">
            Give each line of work a durable home. Start with the essentials;
            add context when the Project needs it.
          </p>
        </div>
        <Link className={buttonVariants({ size: "sm" })} to="/projects/new">
          <Plus aria-hidden="true" />
          Create Project
        </Link>
      </header>

      <section aria-labelledby="projects-list-heading" className="pt-8">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-medium text-sm" id="projects-list-heading">
            Your Projects
          </h2>
          {projects.data ? (
            <span className="text-muted-foreground text-xs">
              {projects.data.length}{" "}
              {projects.data.length === 1 ? "Project" : "Projects"}
            </span>
          ) : null}
        </div>

        {projects.isPending ? <ProjectsSkeleton /> : null}
        {projects.isError ? (
          <div className="border-y py-8 text-sm" role="alert">
            <p className="font-medium">Project is unavailable.</p>
            <p className="mt-1 text-muted-foreground">
              Try loading this page again.
            </p>
          </div>
        ) : null}
        {projects.data?.length === 0 ? <ProjectsEmptyState /> : null}
        {projects.data && projects.data.length > 0 ? (
          <ul className="divide-y border-y">
            {projects.data.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}

function ProjectRow({ project }: { project: ProjectProfile }) {
  const queryClient = useQueryClient();
  const [shortCode, setShortCode] = useState(project.shortCode);
  const [error, setError] = useState<string | null>(null);
  const pendingShortCode = useRef<{
    baseRevision: number;
    clientIdempotencyKey: string;
    shortCode: string;
  } | null>(null);
  const updateShortCode = useMutation({
    mutationFn: (input: {
      baseRevision: number;
      clientIdempotencyKey: string;
      shortCode: string;
    }) =>
      runOnlineOnlyWrite(() =>
        client.updateProjectShortCode({
          projectId: project.id,
          ...input,
        }),
      ),
    onError: (mutationError) => setError(projectErrorMessage(mutationError)),
    onSuccess: async () => {
      pendingShortCode.current = null;
      setError(null);
      await queryClient.invalidateQueries({ queryKey: projectsQueryPrefix });
      toast.success("Short code saved.");
    },
  });

  useEffect(() => {
    setShortCode(project.shortCode);
  }, [project.shortCode]);

  async function saveShortCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextShortCode = shortCode.trim();
    if (!nextShortCode || nextShortCode === project.shortCode) {
      return;
    }
    const pending = pendingShortCode.current;
    const clientIdempotencyKey =
      pending?.baseRevision === project.revision &&
      pending.shortCode === nextShortCode
        ? pending.clientIdempotencyKey
        : crypto.randomUUID();
    pendingShortCode.current = {
      baseRevision: project.revision,
      clientIdempotencyKey,
      shortCode: nextShortCode,
    };
    try {
      await updateShortCode.mutateAsync({
        baseRevision: project.revision,
        clientIdempotencyKey,
        shortCode: nextShortCode,
      });
    } catch {
      // onError owns the inline error state; the form event must settle.
    }
  }

  return (
    <li className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-medium">
            <Link
              className="underline-offset-4 hover:underline"
              params={{ projectId: project.id }}
              to="/projects/$projectId"
            >
              {project.name}
            </Link>
          </h3>
          <Badge variant="secondary">{project.status}</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-xs">
          {project.starterConfiguration}
          {project.targetDate ? ` · Target ${project.targetDate}` : ""}
        </p>
        {project.purpose ? (
          <p className="mt-3 max-w-2xl text-muted-foreground text-sm/relaxed">
            {project.purpose}
          </p>
        ) : null}
      </div>
      <div className="border-l pl-5 lg:border-l lg:pl-5">
        <form className="space-y-2" onSubmit={saveShortCode}>
          <label
            className="font-medium text-xs"
            htmlFor={`short-code-${project.id}`}
          >
            Short code
          </label>
          <div className="flex gap-2">
            <Input
              aria-describedby={
                project.shortCodeLocked
                  ? `short-code-help-${project.id}`
                  : undefined
              }
              aria-label="Short code"
              disabled={project.shortCodeLocked || updateShortCode.isPending}
              id={`short-code-${project.id}`}
              onChange={(event) => setShortCode(event.target.value)}
              value={shortCode}
            />
            {project.shortCodeLocked ? (
              <LockKeyhole
                aria-hidden="true"
                className="mt-2 size-4 shrink-0 text-muted-foreground"
              />
            ) : (
              <Button
                aria-label="Save Short code"
                disabled={
                  updateShortCode.isPending ||
                  !shortCode.trim() ||
                  shortCode.trim() === project.shortCode
                }
                size="icon"
                type="submit"
                variant="outline"
              >
                {updateShortCode.isPending ? (
                  <Save aria-hidden="true" />
                ) : (
                  <Check aria-hidden="true" />
                )}
              </Button>
            )}
          </div>
          <p
            className="text-muted-foreground text-xs"
            id={`short-code-help-${project.id}`}
          >
            {project.shortCodeLocked
              ? "Short code is locked after the first Work."
              : "Editable until the first Work."}
          </p>
          {error ? (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </li>
  );
}

function ProjectsEmptyState() {
  return (
    <div className="border-y bg-muted/20 px-5 py-10 sm:px-6">
      <div className="flex max-w-2xl items-start gap-4">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center border bg-background">
          <FolderOpen aria-hidden="true" className="size-4" />
        </div>
        <div>
          <p className="font-medium">No Projects yet.</p>
          <p className="mt-1 max-w-xl text-muted-foreground text-sm/relaxed">
            Start with a name and one Starter Configuration. Add the rest when
            the Project needs more shape.
          </p>
          <Link
            className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-5`}
            to="/projects/new"
          >
            <Plus aria-hidden="true" />
            Create your first Project
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div aria-label="Loading…" className="divide-y border-y" role="status">
      {[0, 1].map((item) => (
        <div
          className="grid gap-4 py-6 lg:grid-cols-[minmax(0,1fr)_18rem]"
          key={item}
        >
          <div className="space-y-2">
            <div className="h-4 w-48 animate-pulse bg-muted" />
            <div className="h-3 w-32 animate-pulse bg-muted" />
          </div>
          <div className="h-8 animate-pulse bg-muted" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
