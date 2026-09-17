import {
  PROJECT_AREA_OPTIONS,
  type ProjectArea,
} from "@cantiara/api/project-shell";
import { Badge } from "@cantiara/ui/components/badge";
import { Button, buttonVariants } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, CircleHelp } from "lucide-react";
import { useState } from "react";

import { orpc } from "@/utils/orpc";

const ALWAYS_REACHABLE_SURFACES = [
  "Overview",
  "Work",
  "Documents",
  "All Tools",
] as const;

const ALL_PROJECT_AREAS = PROJECT_AREA_OPTIONS;

export default function ProjectShellView({ projectId }: { projectId: string }) {
  const projectQuery = useQuery({
    ...orpc.project.queryOptions({ input: { projectId } }),
  });
  const [showExplanation, setShowExplanation] = useState(true);

  if (projectQuery.isPending) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div aria-label="Loading…" role="status">
          Loading…
        </div>
      </main>
    );
  }

  if (projectQuery.isError) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="border-y py-8 text-sm" role="alert">
          <p className="font-medium">Project is unavailable.</p>
          <p className="mt-1 text-muted-foreground">
            Try loading this page again.
          </p>
        </div>
      </main>
    );
  }

  const { configuration, name, shortCode, starterConfiguration, status } =
    projectQuery.data;

  function dismissExplanation() {
    setShowExplanation(false);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="border-b pb-6">
        <Link
          className={`${buttonVariants({ variant: "ghost", size: "sm" })} mb-5 -ml-3`}
          to="/projects"
        >
          <ArrowLeft aria-hidden="true" />
          Projects
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-balance font-semibold text-3xl tracking-tight">
            {name}
          </h1>
          <Badge variant="secondary">{status}</Badge>
        </div>
        <p className="mt-2 text-muted-foreground text-sm">{shortCode}</p>
        <p className="mt-2 font-medium text-sm">{starterConfiguration}</p>
      </header>

      {showExplanation ? (
        <aside
          aria-label="Starter Configuration explanation"
          className="mt-6 flex items-start gap-3 border bg-muted/20 p-4"
        >
          <CircleHelp
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">Starter Configuration applied once</p>
            <p className="mt-1 text-muted-foreground">
              These defaults give this Project a starting shape. You can adjust
              its structure later; no sample content was created.
            </p>
          </div>
          <Button onClick={dismissExplanation} size="xs" variant="ghost">
            Dismiss
          </Button>
        </aside>
      ) : null}

      <ProjectNavigation extraPinnedAreas={configuration.extraPinnedAreas} />

      <section className="mt-8 space-y-8" id="overview">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
            Project Shell
          </p>
          <h2 className="mt-2 font-semibold text-2xl">Overview</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm/relaxed">
            This Project is ready for your work. Starter defaults are structure
            only and do not add records, history, or workflow gates.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ConfigurationList
            emptyMessage="No stages prepared."
            items={configuration.preparedStages}
            label="Stages"
          />
          <ConfigurationList
            items={configuration.workStatuses}
            label="Work statuses"
          />
          <ConfigurationList
            items={configuration.preparedWorkViews}
            label="Saved views"
          />
          <EnabledAreasList areas={configuration.enabledAreas} />
        </div>

        <section className="border bg-muted/10 p-5" id="work">
          <h2 className="font-medium text-lg">Work</h2>
          <p className="mt-2 text-muted-foreground text-sm/relaxed">
            No sample content was created.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {configuration.preparedWorkViews.map((view) => (
              <span className="border bg-background px-3 py-1.5" key={view}>
                {view}
              </span>
            ))}
          </div>
        </section>

        <section className="border bg-muted/10 p-5" id="documents">
          <h2 className="font-medium text-lg">Documents</h2>
          <p className="mt-2 text-muted-foreground text-sm/relaxed">
            No sample content was created.
          </p>
        </section>

        <AllToolsSection enabledAreas={configuration.enabledAreas} />
      </section>
    </main>
  );
}

function ProjectNavigation({
  extraPinnedAreas,
}: {
  extraPinnedAreas: readonly ProjectArea[];
}) {
  return (
    <nav
      aria-label="Project navigation"
      className="mt-6 flex flex-wrap items-center gap-2 border-y py-3"
    >
      {ALWAYS_REACHABLE_SURFACES.map((surface) => (
        <a
          className="border px-3 py-1.5 font-medium text-sm hover:bg-muted"
          href={
            surface === "All Tools" ? "#all-tools" : `#${surface.toLowerCase()}`
          }
          key={surface}
        >
          {surface}
        </a>
      ))}
      {extraPinnedAreas.map((area) => (
        <a
          className="border border-dashed px-3 py-1.5 text-sm hover:bg-muted"
          href={projectAreaAnchor(area)}
          key={area}
        >
          {area}
        </a>
      ))}
    </nav>
  );
}

function projectAreaAnchor(area: ProjectArea) {
  return `#project-area-${area.toLowerCase().replaceAll(" ", "-")}`;
}

function ConfigurationList({
  emptyMessage,
  items,
  label,
}: {
  emptyMessage?: string;
  items: readonly string[];
  label: string;
}) {
  return (
    <section
      aria-labelledby={`${label.toLowerCase().replaceAll(" ", "-")}-heading`}
      className="border p-5"
    >
      <h2
        className="font-medium text-lg"
        id={`${label.toLowerCase().replaceAll(" ", "-")}-heading`}
      >
        {label}
      </h2>
      <ul aria-label={label} className="mt-4 divide-y border-y">
        {items.map((item) => (
          <li className="px-3 py-2 text-sm" key={item}>
            {item}
          </li>
        ))}
      </ul>
      {items.length === 0 ? (
        <p className="mt-4 text-muted-foreground text-sm">{emptyMessage}</p>
      ) : null}
    </section>
  );
}

function EnabledAreasList({ areas }: { areas: readonly ProjectArea[] }) {
  return (
    <section
      aria-labelledby="enabled-project-areas-heading"
      className="border p-5"
    >
      <h2 className="font-medium text-lg" id="enabled-project-areas-heading">
        Project areas
      </h2>
      <ul aria-label="Enabled Project areas" className="mt-4 divide-y border-y">
        {areas.map((area) => (
          <li className="px-3 py-2 text-sm" key={area}>
            {area}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AllToolsSection({
  enabledAreas,
}: {
  enabledAreas: readonly ProjectArea[];
}) {
  return (
    <section className="border p-5" id="all-tools">
      <h2 className="font-medium text-lg">All Tools</h2>
      <p className="mt-2 text-muted-foreground text-sm/relaxed">
        Every ready Project area stays discoverable here. Enabling an area does
        not create records or change another Project.
      </p>
      <ul aria-label="All Project areas" className="mt-4 divide-y border-y">
        {ALL_PROJECT_AREAS.map((area) => {
          const enabled = enabledAreas.includes(area);
          return (
            <li
              aria-label={`${area} ${enabled ? "Enabled" : "Available"}`}
              className="flex items-center justify-between px-3 py-2 text-sm"
              id={projectAreaAnchor(area).slice(1)}
              key={area}
            >
              {area}
              {enabled ? <Check aria-hidden="true" className="size-3" /> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
