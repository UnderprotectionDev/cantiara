// biome-ignore-all lint/performance/noJsxPropsBind: Roadmap controls bind to the selected Work and view.
import {
  presentRoadmap,
  type RoadmapHorizon,
  type RoadmapOriginLink,
  type RoadmapView,
} from "@cantiara/api/roadmap-horizon";
import {
  WORK_TYPE_OPTIONS,
  type WorkProfile,
} from "@cantiara/api/work-lifecycle";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";
import ProjectMilestones from "./project-milestones";
import ResearchDirection from "./research-direction";
import RoadmapViewEditor from "./roadmap-view-editor";

const HORIZONS = ["Now", "Next", "Later"] as const;
const MARK_COLORS = [
  "bg-chart-1/20",
  "bg-chart-2/20",
  "bg-chart-3/20",
  "bg-chart-4/20",
  "bg-chart-5/20",
] as const;
type ViewSelection = "direction" | "all" | string;

function roadmapFieldValue(
  work: WorkProfile,
  field: RoadmapView["groupBy"],
): string {
  if (field === "Type") {
    return work.type;
  }
  if (field === "Status") {
    return work.status;
  }
  return work.roadmapHorizon ?? "No horizon";
}

function roadmapMarkColor(value: string): string {
  const values = [
    ...HORIZONS,
    ...WORK_TYPE_OPTIONS,
    "Not Started",
    "In Progress",
    "Blocked",
    "Closed",
    "No horizon",
  ];
  return (
    MARK_COLORS[Math.max(0, values.indexOf(value)) % MARK_COLORS.length] ??
    "bg-chart-1/20"
  );
}

function RoadmapResults({
  works,
  origins,
  view,
  projectId,
}: {
  works: WorkProfile[];
  origins: RoadmapOriginLink[];
  view: RoadmapView | null;
  projectId: string;
}) {
  const shown = presentRoadmap(
    works.map((work) => ({
      ...work,
      horizon: work.roadmapHorizon ?? null,
      originResearchIds: origins
        .filter((origin) => origin.targetFeatureId === work.id)
        .map((origin) => origin.sourceResearchId),
    })),
    view,
  );
  const groups = new Map<string, typeof shown>();
  for (const item of shown) {
    const group = roadmapFieldValue(item.work, view?.groupBy ?? "Horizon");
    const current = groups.get(group) ?? [];
    current.push(item);
    groups.set(group, current);
  }
  if (!shown.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No Work matches this view.
      </p>
    );
  }
  return (
    <div className="grid gap-6">
      {Array.from(groups, ([group, items]) => (
        <section className="grid gap-3" key={group}>
          {view ? (
            <h3 className="border-b pb-2 font-medium text-sm">{group}</h3>
          ) : null}
          {items.map(({ work, secondary }) => (
            <article
              className={`rounded-lg border bg-card p-4 ${secondary ? "ml-4 border-l-4" : ""}`}
              key={work.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">
                    {work.key} ·{" "}
                    <Badge
                      className={roadmapMarkColor(
                        roadmapFieldValue(work, view?.markBy ?? "Type"),
                      )}
                      variant="secondary"
                    >
                      {roadmapFieldValue(work, view?.markBy ?? "Type")}
                    </Badge>
                    {secondary ? " · Feature" : ""}
                  </p>
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    hash={workRecordHash(work.id)}
                    params={{ projectId }}
                    to="/projects/$projectId"
                  >
                    {work.title}
                  </Link>
                  {secondary ? (
                    <p className="text-muted-foreground text-xs">
                      Research ·{" "}
                      {
                        works.find((item) =>
                          work.originResearchIds.includes(item.id),
                        )?.title
                      }
                    </p>
                  ) : null}
                  {work.type === "Research" ? (
                    <ResearchDirection
                      key={`${work.id}-${work.revision}`}
                      work={work}
                    />
                  ) : null}
                  <p className="text-muted-foreground text-xs">
                    {work.status} ·{" "}
                    {work.plannedStartDate && work.targetDate
                      ? `${work.plannedStartDate} – ${work.targetDate}`
                      : (work.targetDate ?? "No target date")}
                  </p>
                </div>
                <HorizonControl
                  key={`${work.id}-${work.roadmapHorizon}`}
                  work={work}
                />
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function HorizonControl({ work }: { work: WorkProfile }) {
  const queryClient = useQueryClient();
  const [horizon, setHorizon] = useState<RoadmapHorizon | "">(
    work.roadmapHorizon ?? "",
  );
  const mutation = useMutation({
    mutationFn: () =>
      runOnlineOnlyWrite(() =>
        client.updateWorkHorizon({
          baseRevision: work.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          horizon: horizon || null,
          workId: work.id,
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectWorksQueryPrefix }),
  });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs" htmlFor={`horizon-${work.id}`}>
        Horizon
        <select
          className="min-h-10 rounded-md border bg-background px-2 text-sm"
          id={`horizon-${work.id}`}
          onChange={(event) =>
            setHorizon(event.target.value as RoadmapHorizon | "")
          }
          value={horizon}
        >
          <option value="">No horizon</option>
          {HORIZONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <Button
        disabled={mutation.isPending || (work.roadmapHorizon ?? "") === horizon}
        onClick={() => mutation.mutate()}
        size="sm"
        type="button"
        variant="outline"
      >
        Place on horizon
      </Button>
      {mutation.isError ? (
        <p className="text-destructive text-xs" role="alert">
          Horizon could not be saved. Reload and try again.
        </p>
      ) : null}
    </div>
  );
}

export default function ProjectRoadmap({ projectId }: { projectId: string }) {
  const [selection, setSelection] = useState<ViewSelection>("direction");
  const worksQuery = useQuery(
    orpc.projectWorks.queryOptions({ input: { archived: false, projectId } }),
  );
  const viewsQuery = useQuery(
    orpc.projectRoadmapViews.queryOptions({ input: { projectId } }),
  );
  const originsQuery = useQuery(
    orpc.projectRoadmapOrigins.queryOptions({ input: { projectId } }),
  );
  const views = viewsQuery.data ?? [];
  const selectedView = views.find((view) => view.id === selection) ?? null;

  if (worksQuery.isPending || viewsQuery.isPending || originsQuery.isPending) {
    return <p role="status">Loading…</p>;
  }
  if (worksQuery.isError || viewsQuery.isError || originsQuery.isError) {
    return <p role="alert">Roadmap is unavailable. Reload and try again.</p>;
  }

  const works = (worksQuery.data ?? []).filter(
    (work) => work.archivedAt === null,
  );

  return (
    <section aria-label="Roadmap" className="space-y-6" id="roadmap">
      <header className="space-y-2">
        <h2 className="font-semibold text-2xl">Roadmap</h2>
        <p className="text-muted-foreground text-sm">
          Horizons describe direction. They do not start Work, set dates, or
          promise a release.
        </p>
      </header>
      <label className="grid max-w-sm gap-1 text-sm" htmlFor="roadmap-view">
        Named view
        <select
          className="min-h-11 rounded-md border bg-background px-3"
          id="roadmap-view"
          onChange={(event) => setSelection(event.target.value)}
          value={selection}
        >
          <option value="direction">Product direction</option>
          <option value="all">All Work types</option>
          {views.map((saved) => (
            <option key={saved.id} value={saved.id}>
              {saved.name}
            </option>
          ))}
        </select>
      </label>
      {selection === "direction" ? (
        <RoadmapResults
          origins={originsQuery.data ?? []}
          projectId={projectId}
          view={null}
          works={works}
        />
      ) : (
        <RoadmapViewEditor
          key={selection}
          onSaved={setSelection}
          projectId={projectId}
          renderResults={(view) => (
            <RoadmapResults
              origins={originsQuery.data ?? []}
              projectId={projectId}
              view={view}
              works={works}
            />
          )}
          saved={selectedView}
        />
      )}
      <ProjectMilestones projectId={projectId} works={works} />
    </section>
  );
}
