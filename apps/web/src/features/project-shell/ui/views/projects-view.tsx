import { buttonVariants } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { projectsQueryOptions } from "@/utils/orpc";

import ProjectRow from "../components/project-row";
import {
  ProjectsEmptyState,
  ProjectsSkeleton,
} from "../components/projects-list-states";

export default function ProjectsView() {
  const projects = useQuery(projectsQueryOptions());

  return (
    <main className="surface-frame max-w-6xl">
      <header className="surface-header flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="mt-2 text-balance font-semibold text-3xl tracking-tight">
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

      <section aria-labelledby="projects-list-heading" className="pt-9">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2
            className="font-semibold text-lg tracking-tight"
            id="projects-list-heading"
          >
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
          <ul className="divide-y rounded-lg border border-border/70 bg-card/50">
            {projects.data.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
