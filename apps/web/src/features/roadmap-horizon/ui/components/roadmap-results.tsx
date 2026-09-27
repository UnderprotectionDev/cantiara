// biome-ignore-all lint/performance/noJsxPropsBind: Roadmap controls bind to the selected Work and view.
import {
  listUnplannedRoadmapCandidates,
  presentRoadmap,
  type RoadmapBlocker,
  type RoadmapBlockerSource,
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
type RoadmapDetailSource = RoadmapBlockerSource &
  Partial<
    Pick<
      WorkProfile,
      "description" | "plannedStartDate" | "roadmapHorizon" | "targetDate"
    >
  >;
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

function roadmapBlockerSource(work: WorkProfile): RoadmapDetailSource {
  return {
    archivedAt: work.archivedAt,
    description: work.description,
    id: work.id,
    key: work.key,
    plannedStartDate: work.plannedStartDate ?? null,
    projectId: work.projectId,
    roadmapHorizon: work.roadmapHorizon ?? null,
    status: work.status,
    targetDate: work.targetDate,
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
  onOpen,
  presentationMode,
  record,
  workTitle = false,
}: {
  onOpen: (record: RoadmapBlockerSource) => void;
  presentationMode: boolean;
  record: RoadmapBlockerSource;
  workTitle?: boolean;
}) {
  if (presentationMode) {
    return (
      <Button
        aria-label={`Open source record: ${record.key} ${record.title}`}
        className={
          workTitle ? "h-auto px-0 py-0 font-medium text-foreground" : "px-0"
        }
        onClick={() => onOpen(record)}
        size="sm"
        type="button"
        variant="link"
      >
        {workTitle ? record.title : "Open source record"}
      </Button>
    );
  }
  return (
    <Link
      className="underline-offset-4 hover:underline"
      hash={workRecordHash(record.id)}
      params={{ projectId: record.projectId }}
      to="/projects/$projectId"
    >
      {workTitle ? record.title : "Open source record"}
    </Link>
  );
}

function RoadmapWorkDetails({
  onClose,
  work,
}: {
  onClose: () => void;
  work: RoadmapDetailSource;
}) {
  const detailsQuery = useQuery({
    ...orpc.work.queryOptions({ input: { workId: work.id } }),
    enabled: work.description === undefined,
  });
  const details = detailsQuery.data ?? work;

  return (
    <section
      aria-label={`Work details: ${details.key}`}
      className="mt-4 space-y-3 rounded-md border bg-muted/20 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs">
            {details.key} · {details.type} · {details.status}
            {details.archivedAt ? " · Archived" : ""}
          </p>
          <h4 className="font-medium text-base">{details.title}</h4>
        </div>
        <Button onClick={onClose} size="sm" type="button" variant="outline">
          Close details
        </Button>
      </div>
      {work.description === undefined && detailsQuery.isPending ? (
        <p className="text-muted-foreground text-sm" role="status">
          Loading Work details…
        </p>
      ) : null}
      {work.description === undefined && detailsQuery.isError ? (
        <p className="text-destructive text-sm" role="alert">
          Work details could not be loaded.
        </p>
      ) : null}
      <RoadmapWorkDescription description={details.description} />
      {details.roadmapHorizon !== undefined ||
      details.plannedStartDate !== undefined ||
      details.targetDate !== undefined ? (
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {details.roadmapHorizon === undefined ? null : (
            <div>
              <dt className="text-muted-foreground">Horizon</dt>
              <dd>{details.roadmapHorizon ?? "No horizon"}</dd>
            </div>
          )}
          {details.plannedStartDate === undefined ? null : (
            <div>
              <dt className="text-muted-foreground">Planned start date</dt>
              <dd>{details.plannedStartDate ?? "No date"}</dd>
            </div>
          )}
          {details.targetDate === undefined ? null : (
            <div>
              <dt className="text-muted-foreground">Target date</dt>
              <dd>{details.targetDate ?? "No date"}</dd>
            </div>
          )}
        </dl>
      ) : null}
    </section>
  );
}

function RoadmapWorkDescription({
  description,
}: {
  description: string | null | undefined;
}) {
  if (description === undefined) {
    return null;
  }
  if (!description) {
    return (
      <p className="text-muted-foreground text-sm">No description recorded.</p>
    );
  }
  return (
    <p className="max-w-3xl whitespace-pre-wrap text-sm/relaxed">
      {description}
    </p>
  );
}

function BlockerBadge({
  blockers,
  onOpen,
  presentationMode,
  work,
}: {
  blockers: RoadmapBlockerSource[];
  onOpen: (record: RoadmapBlockerSource) => void;
  presentationMode: boolean;
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
          <SourceAction
            onOpen={onOpen}
            presentationMode={presentationMode}
            record={work}
          />
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
              <SourceAction
                onOpen={onOpen}
                presentationMode={presentationMode}
                record={blocker}
              />
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function RoadmapWorkSummary({
  mark,
  onOpen,
  presentationMode,
  record,
  role,
  researchOriginTitle,
  work,
}: {
  mark: string;
  onOpen: (record: RoadmapBlockerSource) => void;
  presentationMode: boolean;
  record: RoadmapDetailSource;
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
      <h3 className="font-medium">
        <SourceAction
          onOpen={onOpen}
          presentationMode={presentationMode}
          record={record}
          workTitle
        />
      </h3>
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
  const [openedRecord, setOpenedRecord] = useState<RoadmapDetailSource | null>(
    null,
  );
  const record = roadmapBlockerSource(work);
  const mark = roadmapFieldValue(work, view?.markBy ?? "Type");
  const onOpen = (source: RoadmapBlockerSource) => setOpenedRecord(source);

  return (
    <article
      className={`rounded-lg border p-4 ${role === "Secondary" ? "ml-4 bg-muted/20" : "bg-card"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <RoadmapWorkSummary
          mark={mark}
          onOpen={onOpen}
          presentationMode={presentationMode}
          record={record}
          researchOriginTitle={researchOriginTitle}
          role={role}
          work={work}
        />
        {presentationMode || candidate ? null : <HorizonControl work={work} />}
      </div>
      <BlockerBadge
        blockers={activeBlockers}
        onOpen={onOpen}
        presentationMode={presentationMode}
        work={record}
      />
      {openedRecord ? (
        <RoadmapWorkDetails
          onClose={() => setOpenedRecord(null)}
          work={openedRecord}
        />
      ) : null}
      <CandidatePlacement
        candidate={candidate && !presentationMode}
        work={work}
      />
    </article>
  );
}

export function RoadmapResults({
  blockers,
  origins,
  presentationMode,
  view,
  works,
}: {
  blockers: RoadmapBlocker[];
  origins: RoadmapOriginLink[];
  presentationMode: boolean;
  view: RoadmapView | null;
  works: WorkProfile[];
}) {
  const roadmapWorks = works.map((work) => ({
    ...work,
    horizon: work.roadmapHorizon ?? null,
    originResearchIds: origins
      .filter((origin) => origin.targetFeatureId === work.id)
      .map((origin) => origin.sourceResearchId),
    plannedStartDate: work.plannedStartDate ?? null,
    targetDate: work.targetDate,
  }));
  const candidates = listUnplannedRoadmapCandidates(roadmapWorks, view);
  const candidateIds = new Set(candidates.map(({ work }) => work.id));
  const shown = presentRoadmap(roadmapWorks, view).filter(
    ({ work }) => !candidateIds.has(work.id),
  );
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
