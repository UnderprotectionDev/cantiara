// biome-ignore-all lint/performance/noJsxPropsBind: Roadmap controls bind to the selected Work and view.
import type {
  RoadmapBlocker,
  RoadmapBlockerSource,
  RoadmapHorizon,
  RoadmapOriginLink,
  RoadmapView,
} from "@cantiara/api/roadmap-horizon";
import {
  WORK_TYPE_OPTIONS,
  type WorkProfile,
} from "@cantiara/api/work-lifecycle";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import WorkReviewLaterControl from "@/features/personal-reminders/ui/components/work-review-later-control";
import { OpenSourceRecordButton } from "@/features/record-discovery/ui/components/context-record-preview";
import WorkNotNowControl from "@/features/roadmap-horizon/ui/components/work-not-now-control";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, projectWorksQueryPrefix } from "@/utils/orpc";
import { projectRoadmapWorks } from "../../lib/roadmap-projection";
import { useRoadmapSession } from "../../store/roadmap-session";
import LiveRoadmapCanvas from "./live-roadmap-canvas";
import ResearchDirection from "./research-direction";
import RoadmapPlacementEditor from "./roadmap-placement";

const HORIZONS = ["Now", "Next", "Later"] as const;
const MARK_COLORS = [
  "bg-chart-1/20",
  "bg-chart-2/20",
  "bg-chart-3/20",
  "bg-chart-4/20",
  "bg-chart-5/20",
] as const;
type RoadmapRole = "Primary" | "Secondary";

function roadmapRole(secondary: boolean): RoadmapRole {
  return secondary ? "Secondary" : "Primary";
}
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

function roadmapBlockerSource(work: WorkProfile): RoadmapBlockerSource {
  return {
    archivedAt: work.archivedAt,
    id: work.id,
    key: work.key,
    projectId: work.projectId,
    status: work.status,
    title: work.title,
    type: work.type,
  };
}

function findResearchTitleForWork(
  workId: string,
  origins: RoadmapOriginLink[],
  works: WorkProfile[],
): string | undefined {
  const origin = origins.find((item) => item.targetFeatureId === workId);
  return works.find((item) => item.id === origin?.sourceResearchId)?.title;
}

function SourceAction({
  className,
  record,
}: {
  className?: string;
  record: RoadmapBlockerSource;
}) {
  return (
    <OpenSourceRecordButton
      className={className}
      target={{
        kind: "work",
        label: `${record.key} · ${record.title}`,
        projectId: record.projectId,
        workId: record.id,
      }}
    />
  );
}

function BlockerBadge({
  blockers,
  work,
}: {
  blockers: RoadmapBlockerSource[];
  work: RoadmapBlockerSource;
}) {
  if (!blockers.length) {
    return null;
  }

  return (
    <details className="mt-3 w-fit">
      <summary
        aria-label={`Blocked by ${blockers.length} active blocker${blockers.length === 1 ? "" : "s"}`}
        className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        <Badge variant="secondary">Blocked</Badge>
        <span className="text-muted-foreground text-xs">{blockers.length}</span>
      </summary>
      <div className="mt-3 grid gap-3 rounded-md border p-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <strong>Blocked Work</strong>
          <span className="text-muted-foreground">
            {work.key} · {work.title}
          </span>
          <SourceAction className="h-8 px-0" record={work} />
        </div>
        <ul className="grid gap-2">
          {blockers.map((blocker) => (
            <li
              className="flex flex-wrap items-center gap-x-2 gap-y-1"
              key={blocker.id}
            >
              <strong>Blocked by</strong>
              <span className="text-muted-foreground">
                {blocker.key} · {blocker.title}
              </span>
              <SourceAction className="h-8 px-0" record={blocker} />
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function RoadmapWorkSummary({
  mark,
  presentationMode,
  record,
  role,
  researchOriginTitle,
  work,
}: {
  mark: string;
  presentationMode: boolean;
  record: RoadmapBlockerSource;
  role: RoadmapRole;
  researchOriginTitle: string | undefined;
  work: WorkProfile;
}) {
  const dateLabel =
    work.plannedStartDate && work.targetDate
      ? `${work.plannedStartDate} – ${work.targetDate}`
      : (work.targetDate ?? work.plannedStartDate ?? "No target date");

  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs">
        {work.key} ·{" "}
        <Badge className={roadmapMarkColor(mark)} variant="secondary">
          {mark}
        </Badge>
        {role === "Secondary" ? " · Feature" : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{record.title}</h3>
        <SourceAction className="h-8 px-0 font-normal" record={record} />
      </div>
      {role === "Secondary" ? (
        <p className="text-muted-foreground text-xs">
          Research · {researchOriginTitle}
        </p>
      ) : null}
      {work.type === "Research" && !presentationMode ? (
        <ResearchDirection key={`${work.id}-${work.revision}`} work={work} />
      ) : null}
      <p className="text-muted-foreground text-xs">
        {work.status} · {dateLabel}
      </p>
    </div>
  );
}

function CandidatePlacement({
  candidate,
  work,
}: {
  candidate: boolean;
  work: WorkProfile;
}) {
  const [editing, setEditing] = useState(false);
  if (!candidate) {
    return null;
  }
  if (editing) {
    return (
      <RoadmapPlacementEditor
        onCancel={() => setEditing(false)}
        onPlaced={() => setEditing(false)}
        work={work}
      />
    );
  }
  return (
    <Button
      className="mt-3"
      onClick={() => setEditing(true)}
      size="sm"
      type="button"
      variant="outline"
    >
      Place on plan
    </Button>
  );
}

function RoadmapWorkItem({
  activeBlockers,
  candidate,
  presentationMode,
  role,
  researchOriginTitle,
  view,
  work,
}: {
  activeBlockers: RoadmapBlockerSource[];
  candidate: boolean;
  presentationMode: boolean;
  role: RoadmapRole;
  researchOriginTitle: string | undefined;
  view: RoadmapView | null;
  work: WorkProfile;
}) {
  const record = roadmapBlockerSource(work);
  const mark = roadmapFieldValue(work, view?.markBy ?? "Type");

  return (
    <article
      className={`rounded-lg border p-4 ${role === "Secondary" ? "ml-4 bg-muted/20" : "bg-card"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <RoadmapWorkSummary
          mark={mark}
          presentationMode={presentationMode}
          record={record}
          researchOriginTitle={researchOriginTitle}
          role={role}
          work={work}
        />
        <div className="flex flex-wrap items-center gap-2">
          {presentationMode ? null : (
            <>
              <WorkNotNowControl compact work={work} />
              <WorkReviewLaterControl compact work={work} />
            </>
          )}
          {presentationMode || candidate ? null : (
            <HorizonControl
              key={`${work.id}-${work.roadmapHorizon ?? ""}`}
              work={work}
            />
          )}
        </div>
      </div>
      <BlockerBadge blockers={activeBlockers} work={record} />
      <CandidatePlacement
        candidate={candidate && !presentationMode}
        work={work}
      />
    </article>
  );
}

export function RoadmapResults({
  projectId,
  blockers,
  origins,
  presentationMode,
  view,
  works,
}: {
  projectId?: string;
  blockers: RoadmapBlocker[];
  origins: RoadmapOriginLink[];
  presentationMode: boolean;
  view: RoadmapView | null;
  works: WorkProfile[];
}) {
  const session = useRoadmapSession();
  useEffect(() => {
    if (
      session &&
      JSON.stringify(session.state.view) !== JSON.stringify(view)
    ) {
      session.setState((state) => ({ ...state, view }));
    }
  }, [session, view]);
  const { candidates, shown } = projectRoadmapWorks(works, origins, view);
  const blockersByWork = new Map<string, RoadmapBlockerSource[]>();
  for (const { blockedWorkId, blocker } of blockers) {
    const current = blockersByWork.get(blockedWorkId) ?? [];
    current.push(blocker);
    blockersByWork.set(blockedWorkId, current);
  }
  const groups = new Map<string, typeof shown>();
  for (const item of shown) {
    const group = roadmapFieldValue(item.work, view?.groupBy ?? "Horizon");
    const current = groups.get(group) ?? [];
    current.push(item);
    groups.set(group, current);
  }

  return (
    <div className="grid gap-6">
      {Boolean(projectId) && (
        <LiveRoadmapCanvas projectId={projectId ?? ""} view={view} />
      )}
      <div className="grid gap-6">
        {shown.length ? (
          Array.from(groups, ([group, items]) => (
            <section className="grid gap-3" key={group}>
              {view ? (
                <h3 className="border-b pb-2 font-medium text-sm">{group}</h3>
              ) : null}
              {items.map(({ work, secondary }) => (
                <RoadmapWorkItem
                  activeBlockers={blockersByWork.get(work.id) ?? []}
                  candidate={false}
                  key={work.id}
                  presentationMode={presentationMode}
                  researchOriginTitle={findResearchTitleForWork(
                    work.id,
                    origins,
                    works,
                  )}
                  role={roadmapRole(secondary)}
                  view={view}
                  work={work}
                />
              ))}
            </section>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">
            No planned Work matches this view.
          </p>
        )}
      </div>
      <details className="border-t pt-4">
        <summary className="w-fit cursor-pointer font-medium text-sm">
          Unplanned candidates{" "}
          <span className="text-muted-foreground">({candidates.length})</span>
        </summary>
        <div className="mt-4 grid gap-3">
          {candidates.length ? (
            candidates.map(({ work, secondary }) => (
              <RoadmapWorkItem
                activeBlockers={blockersByWork.get(work.id) ?? []}
                candidate
                key={work.id}
                presentationMode={presentationMode}
                researchOriginTitle={findResearchTitleForWork(
                  work.id,
                  origins,
                  works,
                )}
                role={roadmapRole(secondary)}
                view={view}
                work={work}
              />
            ))
          ) : (
            <p className="text-muted-foreground text-sm">
              No unplanned Work matches this view.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
