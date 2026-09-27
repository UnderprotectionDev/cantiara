// biome-ignore-all lint/performance/noJsxPropsBind: Roadmap controls bind to the selected Work and view.
import {
  presentRoadmap,
  type RoadmapHorizon,
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

const HORIZONS = ["Now", "Next", "Later"] as const;
const VIEW_FIELDS = ["Horizon", "Type", "Status"] as const;
const MARK_COLORS = [
  "bg-chart-1/20",
  "bg-chart-2/20",
  "bg-chart-3/20",
  "bg-chart-4/20",
  "bg-chart-5/20",
] as const;
type ViewSelection = "direction" | "all" | string;

function roadmapGroup(
  work: WorkProfile,
  groupBy: RoadmapView["groupBy"],
): string {
  if (groupBy === "Type") {
    return work.type;
  }
  if (groupBy === "Status") {
    return work.status;
  }
  return work.roadmapHorizon ?? "No horizon";
}

function roadmapMark(work: WorkProfile, markBy: RoadmapView["markBy"]): string {
  if (markBy === "Status") {
    return work.status;
  }
  if (markBy === "Horizon") {
    return work.roadmapHorizon ?? "No horizon";
  }
  return work.type;
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
  view,
  projectId,
}: {
  works: WorkProfile[];
  view: RoadmapView | null;
  projectId: string;
}) {
  const shown = presentRoadmap(
    works.map((work) => ({
      ...work,
      horizon: work.roadmapHorizon ?? null,
      originOwnerRecordId: work.originOwnerRecordId ?? null,
    })),
    view,
  );
  const groups = new Map<string, typeof shown>();
  for (const item of shown) {
    const group = roadmapGroup(item.work, view?.groupBy ?? "Horizon");
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
                        roadmapMark(work, view?.markBy ?? "Type"),
                      )}
                      variant="secondary"
                    >
                      {roadmapMark(work, view?.markBy ?? "Type")}
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
                        works.find(
                          (item) => item.id === work.originOwnerRecordId,
                        )?.title
                      }
                    </p>
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
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<ViewSelection>("direction");
  const [draftViewId, setDraftViewId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [horizon, setHorizon] = useState("");
  const [groupBy, setGroupBy] = useState<RoadmapView["groupBy"]>("Horizon");
  const [markBy, setMarkBy] = useState<RoadmapView["markBy"]>("Type");
  const worksQuery = useQuery(
    orpc.projectWorks.queryOptions({ input: { archived: false, projectId } }),
  );
  const viewsQuery = useQuery(
    orpc.projectRoadmapViews.queryOptions({ input: { projectId } }),
  );
  const views = viewsQuery.data ?? [];
  const selectedView = views.find((view) => view.id === selection) ?? null;
  const saveView = useMutation({
    mutationFn: () =>
      runOnlineOnlyWrite(() =>
        client.saveRoadmapView({
          groupBy,
          horizons: horizon ? [horizon as RoadmapHorizon] : [],
          id: selectedView === null ? draftViewId : selectedView.id,
          markBy,
          name,
          projectId,
          types: type ? [type as (typeof WORK_TYPE_OPTIONS)[number]] : [],
        }),
      ),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({
        queryKey: orpc.projectRoadmapViews.queryOptions({
          input: { projectId },
        }).queryKey,
      });
      setSelection(saved.id);
      setDraftViewId(crypto.randomUUID());
    },
  });

  function chooseView(id: string) {
    setSelection(id);
    const selected = views.find((view) => view.id === id);
    setName(selected?.name ?? "");
    setType(selected?.types[0] ?? "");
    setHorizon(selected?.horizons[0] ?? "");
    setGroupBy(selected?.groupBy ?? "Horizon");
    setMarkBy(selected?.markBy ?? "Type");
  }

  function chooseGroupBy(value: RoadmapView["groupBy"]) {
    setGroupBy(value);
    if (markBy === value) {
      setMarkBy(VIEW_FIELDS.find((field) => field !== value) ?? "Type");
    }
  }

  if (worksQuery.isPending || viewsQuery.isPending) {
    return <p role="status">Loading Roadmap…</p>;
  }
  if (worksQuery.isError || viewsQuery.isError) {
    return <p role="alert">Roadmap is unavailable. Reload and try again.</p>;
  }

  const works = (worksQuery.data ?? []).filter(
    (work) => work.archivedAt === null,
  );
  const activeView =
    selection === "direction"
      ? null
      : {
          groupBy,
          horizons: horizon ? [horizon as RoadmapHorizon] : [],
          id: selectedView?.id ?? "all",
          markBy,
          name: name || "All Work types",
          projectId,
          types: type ? [type as (typeof WORK_TYPE_OPTIONS)[number]] : [],
        };

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
          onChange={(event) => chooseView(event.target.value)}
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
      {selection === "direction" ? null : (
        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm">
            Type
            <select
              className="min-h-10 rounded-md border bg-background px-2"
              onChange={(event) => setType(event.target.value)}
              value={type}
            >
              <option value="">All Work types</option>
              {WORK_TYPE_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Horizon
            <select
              className="min-h-10 rounded-md border bg-background px-2"
              onChange={(event) => setHorizon(event.target.value)}
              value={horizon}
            >
              <option value="">No filter</option>
              {HORIZONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Group by
            <select
              className="min-h-10 rounded-md border bg-background px-2"
              onChange={(event) =>
                chooseGroupBy(event.target.value as RoadmapView["groupBy"])
              }
              value={groupBy}
            >
              {VIEW_FIELDS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Mark by
            <select
              className="min-h-10 rounded-md border bg-background px-2"
              onChange={(event) =>
                setMarkBy(event.target.value as RoadmapView["markBy"])
              }
              value={markBy}
            >
              {VIEW_FIELDS.filter((option) => option !== groupBy).map(
                (option) => (
                  <option key={option}>{option}</option>
                ),
              )}
            </select>
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Named view
            <input
              className="min-h-10 rounded-md border bg-background px-2"
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <div className="flex items-end">
            <Button
              disabled={!name.trim() || saveView.isPending}
              onClick={() => saveView.mutate()}
              type="button"
            >
              Save named view
            </Button>
          </div>
          {saveView.isError ? (
            <p className="text-destructive text-sm" role="alert">
              Named view could not be saved.
            </p>
          ) : null}
        </div>
      )}
      <RoadmapResults projectId={projectId} view={activeView} works={works} />
    </section>
  );
}
