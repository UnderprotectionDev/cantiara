import type { ProjectProfile } from "@cantiara/api/project-shell";
import { Badge } from "@cantiara/ui/components/badge";
import { Link } from "@tanstack/react-router";

import ProjectShortCodeForm from "../forms/project-short-code-form";

export default function ProjectRow({ project }: { project: ProjectProfile }) {
  return (
    <li className="grid gap-4 px-4 py-4 transition-colors hover:bg-muted/35 sm:px-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-medium">
            <Link
              className="inline-flex min-h-11 max-w-full items-center underline-offset-4 hover:underline"
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
      <div className="border-border/70 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        <ProjectShortCodeForm project={project} />
      </div>
    </li>
  );
}
