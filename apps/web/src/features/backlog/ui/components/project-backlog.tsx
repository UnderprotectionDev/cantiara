// biome-ignore-all lint/performance/noJsxPropsBind: Controls close over the current Backlog presentation.

import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type {
  BacklogSavedPresentation,
  BacklogWork,
} from "@cantiara/api/backlog";
import { partitionDeferredBacklog } from "@cantiara/api/backlog";
import { PRIORITY_METRIC_RANKS } from "@cantiara/api/priority-metrics";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Calendar } from "@cantiara/ui/components/calendar";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cantiara/ui/components/popover";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { ExportListAction } from "@/components/export-list-action";
import { formatAccountDate } from "@/features/account-preferences/lib/account-preferences-format";
import {
  groupRecordIdsByType,
  scopeForProjects,
  WORK_LIST_EXPORT_FIELDS,
} from "@/features/data-export/lib/export-handoff";
import WorkReviewLaterControl from "@/features/personal-reminders/ui/components/work-review-later-control";
import { usePriorityMetricProjectValues } from "@/features/priority-metrics/hooks/use-priority-metrics";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import WorkNotNowControl from "@/features/roadmap-horizon/ui/components/work-not-now-control";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";
import {
  type BacklogPresentation,
  type BacklogSortField,
  presentBacklog,
} from "../../lib/backlog-presentation";

function BacklogCard({
  canReorder,
  formattingPreferences,
  projectId,
  profile,
  work,
}: {
  canReorder: boolean;
  formattingPreferences: AccountPreferences;
  projectId: string;
  profile: WorkProfile | undefined;
  work: BacklogWork;
}) {
  const queryClient = useQueryClient();
  const [reappearDate, setReappearDate] = useState(work.reappearDate ?? "");
  const [dateOpen, setDateOpen] = useState(false);
  useEffect(
    () => setReappearDate(work.reappearDate ?? ""),
    [work.reappearDate],
  );
  const saveReappearDate = useMutation({
    mutationFn: (value: string | null) =>
      runOnlineOnlyWrite(() =>
        client.updateWorkReappearDate({
          baseRevision: work.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          reappearDate: value,
          workId: work.id,
        }),
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.projectBacklog.queryOptions({ input: { projectId } })
            .queryKey,
        }),
        queryClient.invalidateQueries({ queryKey: projectWorksQueryPrefix }),
      ]);
    },
    onError: () => setReappearDate(work.reappearDate ?? ""),
  });
  const selectedDate = reappearDate ? parseISO(reappearDate) : undefined;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: work.id, disabled: !canReorder });
  return (
    <li
      className="flex items-center rounded-lg border border-border/70 bg-card/35 transition-colors hover:bg-card/70 motion-reduce:transition-none"
      ref={setNodeRef}
      style={{
        opacity: isDragging ? 0.6 : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {canReorder ? (
        <button
          aria-label={`Drag ${work.title}`}
          className="ml-2 cursor-grab rounded px-2 py-3 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
          type="button"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      ) : null}
      <Link
        className="flex min-h-12 min-w-0 flex-1 items-center gap-4 rounded-lg px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        hash={workRecordHash(work.id)}
        params={{ projectId }}
        to="/projects/$projectId"
      >
        <span className="shrink-0 font-mono text-muted-foreground text-xs">
          {work.key}
        </span>
        <span className="min-w-0 truncate font-medium text-sm">
          {work.title}
        </span>
      </Link>
      {profile ? (
        <div className="flex items-center gap-1">
          <WorkReviewLaterControl compact work={profile} />
          <WorkNotNowControl compact work={profile} />
        </div>
      ) : null}
      <div className="mr-3 flex items-center gap-2 text-xs">
        <Popover onOpenChange={setDateOpen} open={dateOpen}>
          <PopoverTrigger
            disabled={saveReappearDate.isPending}
            render={
              <Button
                aria-label={`Reappear date for ${work.title}`}
                disabled={saveReappearDate.isPending}
                size="sm"
                type="button"
                variant="outline"
              />
            }
          >
            Reappear date
            {reappearDate
              ? `: ${formatAccountDate(reappearDate, formattingPreferences)}`
              : ""}
            <CalendarDays aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto min-w-72">
            <Calendar
              defaultMonth={selectedDate}
              mode="single"
              onSelect={(date) => {
                if (!date) {
                  return;
                }
                const value = format(date, "yyyy-MM-dd");
                setReappearDate(value);
                setDateOpen(false);
                saveReappearDate.mutate(value);
              }}
              selected={selectedDate}
            />
          </PopoverContent>
        </Popover>
        {reappearDate ? (
          <Button
            aria-label={`Clear Reappear date for ${work.title}`}
            disabled={saveReappearDate.isPending}
            onClick={() => {
              setReappearDate("");
              saveReappearDate.mutate(null);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Clear
          </Button>
        ) : null}
      </div>
      {saveReappearDate.isError ? (
        <p className="text-destructive text-xs" role="alert">
          Reappear date could not be saved. Try again.
        </p>
      ) : null}
    </li>
  );
}

function toSavedPresentation(
  presentation: BacklogPresentation,
  priorityMetricId: string,
  field: BacklogSortField,
): BacklogSavedPresentation | null {
  switch (presentation) {
    case "Priority":
      return priorityMetricId
        ? { sort: "Priority", metricId: priorityMetricId }
        : null;
    case "Date":
      return { sort: "Date" };
    case "Field":
      return { sort: "Field", field };
    default:
      return null;
  }
}

function savedPresentationDetail(
  saved: BacklogSavedPresentation | null,
  metrics: { id: string; name: string }[],
): string | null {
  if (saved?.sort === "Field") {
    return saved.field;
  }
  if (saved?.sort === "Priority") {
    return (
      metrics.find((metric) => metric.id === saved.metricId)?.name ??
      "Priority criterion"
    );
  }
  return null;
}

export default function ProjectBacklog({ projectId }: { projectId: string }) {
  const [presentation, setPresentation] =
    useState<BacklogPresentation>("Manual order");
  const [priorityMetricId, setPriorityMetricId] = useState("");
  const [field, setField] = useState<BacklogSortField>("Title");
  const queryClient = useQueryClient();
  const query = useQuery(
    orpc.projectBacklog.queryOptions({ input: { projectId } }),
  );
  const workProfilesQuery = useQuery(
    orpc.projectWorks.queryOptions({ input: { archived: false, projectId } }),
  );
  const orderQuery = useQuery(
    orpc.projectBacklogOrder.queryOptions({ input: { projectId } }),
  );
  const presentationQuery = useQuery(
    orpc.projectBacklogPresentation.queryOptions({ input: { projectId } }),
  );
  const preferencesQuery = useQuery(orpc.accountPreferences.queryOptions());
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const priorityQuery = usePriorityMetricProjectValues(projectId).query;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const updateOrder = useMutation({
    mutationFn: (workIds: string[]) => {
      if (!orderQuery.data) {
        throw new Error("Backlog order is unavailable.");
      }
      return runOnlineOnlyWrite(() =>
        client.updateBacklogOrder({
          baseRevision: orderQuery.data.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          projectId,
          workIds,
        }),
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.projectBacklog.queryOptions({ input: { projectId } })
            .queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.projectBacklogOrder.queryOptions({
            input: { projectId },
          }).queryKey,
        }),
      ]);
    },
  });
  const savePresentation = useMutation({
    mutationFn: (presentationToSave: BacklogSavedPresentation) => {
      if (!presentationQuery.data) {
        throw new Error("Backlog presentation is unavailable.");
      }
      return runOnlineOnlyWrite(() =>
        client.saveBacklogPresentation({
          baseRevision: presentationQuery.data.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          projectId,
          saved: presentationToSave,
        }),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpc.projectBacklogPresentation.queryOptions({
          input: { projectId },
        }).queryKey,
      });
    },
  });

  if (
    query.isPending ||
    [workProfilesQuery, orderQuery, preferencesQuery].some(
      (item) => item.isPending,
    ) ||
    presentationQuery.isPending
  ) {
    return (
      <p className="mt-5 text-muted-foreground text-sm" role="status">
        Loading Backlog…
      </p>
    );
  }
  if (
    query.isError ||
    [workProfilesQuery, orderQuery, preferencesQuery].some(
      (item) => item.isError,
    ) ||
    presentationQuery.isError
  ) {
    return (
      <p className="mt-5 text-destructive text-sm" role="alert">
        Backlog is unavailable. Try loading this page again.
      </p>
    );
  }
  if (query.data.length === 0) {
    return (
      <p className="mt-5 border-border/70 border-y py-5 text-muted-foreground text-sm">
        No active Work to consider.
      </p>
    );
  }

  const works = query.data;
  const profilesById = new Map(
    (workProfilesQuery.data ?? []).map((profile) => [profile.id, profile]),
  );
  const formattingPreferences = {
    ...DEFAULT_ACCOUNT_PREFERENCES,
    ...preferencesQuery.data,
  };
  const enabledMetrics = (priorityQuery.data?.definitions ?? []).filter(
    (definition) => definition.enabled && !definition.trashedAt,
  );
  const priorityByWorkId = new Map(
    (priorityQuery.data?.values ?? [])
      .filter((value) => value.metricId === priorityMetricId)
      .map((value) => [
        value.workId,
        PRIORITY_METRIC_RANKS.indexOf(value.rank),
      ]),
  );
  const displayedWorks = presentBacklog(
    works,
    presentation,
    priorityByWorkId,
    field,
  );
  const { current, deferred } = backlogGroupsForPresentation(
    displayedWorks,
    presentation,
    formattingPreferences.timeZone,
    now,
  );
  const currentSaved = toSavedPresentation(
    presentation,
    priorityMetricId,
    field,
  );
  const { saved } = presentationQuery.data;
  const savedDetail = savedPresentationDetail(saved, enabledMetrics);
  const canReorder = presentation === "Manual order" && !updateOrder.isPending;
  const workName = (id: string | number) =>
    works.find((work) => work.id === id)?.title ?? "Work";

  function onDragEnd(event: DragEndEvent) {
    if (!(canReorder && event.over) || event.active.id === event.over.id) {
      return;
    }
    const from = current.findIndex((work) => work.id === event.active.id);
    const to = current.findIndex((work) => work.id === event.over?.id);
    if (from < 0 || to < 0) {
      return;
    }
    const moved = arrayMove(
      current.map((work) => work.id),
      from,
      to,
    );
    const currentIds = new Set(moved);
    let position = 0;
    updateOrder.mutate(
      works.map((work) => {
        if (!currentIds.has(work.id)) {
          return work.id;
        }
        const id = moved[position] ?? work.id;
        position += 1;
        return id;
      }),
    );
  }

  function selectSavedPresentation() {
    if (!saved) {
      return;
    }
    setPresentation(saved.sort);
    if (saved.sort === "Priority") {
      setPriorityMetricId(saved.metricId);
    }
    if (saved.sort === "Field") {
      setField(saved.field);
    }
  }

  return (
    <section className="mt-5 space-y-3">
      <ExportListAction
        describe={() => {
          // The on-screen order: current Work first, then the deferred group.
          const onScreen = [...current, ...deferred].flatMap((work) => {
            const type = profilesById.get(work.id)?.type;
            return type ? [{ id: work.id, type }] : [];
          });
          return {
            filters: {},
            listedIds: onScreen.map((work) => work.id),
            recordIdsByType: groupRecordIdsByType(onScreen),
            scope: scopeForProjects([projectId]),
            view: {
              kind: "Work list",
              name: "Backlog",
              // Manual, Priority and Date orders are not a record column, so
              // the file keeps the order shown instead of the key order.
              ...(presentation === "Field"
                ? {
                    sort: {
                      direction: "asc" as const,
                      field: field === "Status" ? "status" : "title",
                    },
                  }
                : { order: "listed" as const }),
            },
            visibleFields: WORK_LIST_EXPORT_FIELDS,
          };
        }}
        label="Backlog"
      />
      <BacklogSortControls
        enabledMetrics={enabledMetrics}
        field={field}
        presentation={presentation}
        priorityMetricId={priorityMetricId}
        setField={setField}
        setPresentation={setPresentation}
        setPriorityMetricId={setPriorityMetricId}
      />{" "}
      <BacklogSavedPresentationControls
        currentSaved={currentSaved}
        saved={saved}
        savedDetail={savedDetail}
        savePresentation={savePresentation}
        selectSavedPresentation={selectSavedPresentation}
      />
      {savePresentation.isError ? (
        <p className="text-destructive text-sm" role="alert">
          Backlog presentation could not be saved. Try again.
        </p>
      ) : null}
      {updateOrder.isError ? (
        <p className="text-destructive text-sm" role="alert">
          Backlog order could not be saved. Try again.
        </p>
      ) : null}
      <DndContext
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up ${workName(active.id)}.`,
            onDragOver: ({ active, over }) =>
              over
                ? `${workName(active.id)} is over ${workName(over.id)}.`
                : `${workName(active.id)} is outside the Backlog.`,
            onDragEnd: ({ active, over }) =>
              over
                ? `${workName(active.id)} was dropped over ${workName(over.id)}.`
                : `${workName(active.id)} was not moved.`,
            onDragCancel: ({ active }) =>
              `Moving ${workName(active.id)} was cancelled.`,
          },
        }}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        sensors={sensors}
      >
        <SortableContext
          items={current.map((work) => work.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol aria-label="Backlog" className="space-y-2">
            {current.map((work) => (
              <BacklogCard
                canReorder={canReorder}
                formattingPreferences={formattingPreferences}
                key={work.id}
                profile={profilesById.get(work.id)}
                projectId={projectId}
                work={work}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <DeferredBacklog
        deferred={deferred}
        formattingPreferences={formattingPreferences}
        profilesById={profilesById}
        projectId={projectId}
      />
    </section>
  );
}

function BacklogSavedPresentationControls({
  currentSaved,
  savePresentation,
  saved,
  savedDetail,
  selectSavedPresentation,
}: {
  currentSaved:
    | { sort: "Priority"; metricId: string }
    | { sort: "Date" }
    | { sort: "Field"; field: "Title" | "Status" }
    | null;
  savePresentation: import("@tanstack/react-query").UseMutationResult<
    {
      projectId: string;
      revision: number;
      saved:
        | { sort: "Priority"; metricId: string }
        | { sort: "Date" }
        | { sort: "Field"; field: "Title" | "Status" }
        | null;
    },
    Error,
    | { sort: "Priority"; metricId: string }
    | { sort: "Date" }
    | { sort: "Field"; field: "Title" | "Status" },
    unknown
  >;
  saved:
    | { sort: "Priority"; metricId: string }
    | { sort: "Date" }
    | { sort: "Field"; field: "Title" | "Status" }
    | null;
  savedDetail: string | null;
  selectSavedPresentation: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {currentSaved ? (
        <Button
          disabled={savePresentation.isPending}
          onClick={() => savePresentation.mutate(currentSaved)}
          size="sm"
          type="button"
          variant="outline"
        >
          Save presentation
        </Button>
      ) : null}
      {saved ? (
        <>
          <span className="text-muted-foreground">
            Saved presentation: {saved.sort}
            {savedDetail ? ` · ${savedDetail}` : ""}
          </span>
          <Button
            disabled={savePresentation.isPending}
            onClick={selectSavedPresentation}
            size="sm"
            type="button"
            variant="outline"
          >
            Use saved presentation
          </Button>
        </>
      ) : null}
    </div>
  );
}

function BacklogSortControls({
  setPresentation,
  presentation,
  setPriorityMetricId,
  priorityMetricId,
  enabledMetrics,
  setField,
  field,
}: {
  setPresentation: import("react").Dispatch<
    import("react").SetStateAction<BacklogPresentation>
  >;
  presentation: BacklogPresentation;
  setPriorityMetricId: import("react").Dispatch<
    import("react").SetStateAction<string>
  >;
  priorityMetricId: string;
  enabledMetrics: {
    createdAt: string;
    enabled: boolean;
    id: string;
    name: string;
    projectId: string;
    rankDescriptions: {
      High: string;
      Low: string;
      Medium: string;
      "Very high": string;
      "Very low": string;
    };
    revision: number;
    shortDescription: string;
    trashedAt: string | null;
    updatedAt: string;
  }[];
  setField: import("react").Dispatch<
    import("react").SetStateAction<BacklogSortField>
  >;
  field: BacklogSortField;
}) {
  return (
    <>
      {" "}
      <label className="flex items-center gap-2 text-sm" htmlFor="backlog-sort">
        <span>Backlog sort</span>
        <NativeSelect
          aria-label="Backlog sort"
          id="backlog-sort"
          onChange={(event) =>
            setPresentation(event.currentTarget.value as BacklogPresentation)
          }
          value={presentation}
        >
          <NativeSelectOption>Manual order</NativeSelectOption>
          <NativeSelectOption>Priority</NativeSelectOption>
          <NativeSelectOption>Date</NativeSelectOption>
          <NativeSelectOption>Field</NativeSelectOption>
        </NativeSelect>
      </label>
      {presentation === "Priority" ? (
        <label
          className="flex items-center gap-2 text-sm"
          htmlFor="backlog-priority-criterion"
        >
          <span>Priority criterion</span>
          <NativeSelect
            aria-label="Priority criterion"
            id="backlog-priority-criterion"
            onChange={(event) => setPriorityMetricId(event.currentTarget.value)}
            value={priorityMetricId}
          >
            <NativeSelectOption value="">Priority criterion</NativeSelectOption>
            {enabledMetrics.map((metric) => (
              <NativeSelectOption key={metric.id} value={metric.id}>
                {metric.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      ) : null}
      {presentation === "Field" ? (
        <label
          className="flex items-center gap-2 text-sm"
          htmlFor="backlog-sort-field"
        >
          <span>Field to sort by</span>
          <NativeSelect
            aria-label="Field to sort by"
            id="backlog-sort-field"
            onChange={(event) =>
              setField(event.currentTarget.value as BacklogSortField)
            }
            value={field}
          >
            <NativeSelectOption>Title</NativeSelectOption>
            <NativeSelectOption>Status</NativeSelectOption>
          </NativeSelect>
        </label>
      ) : null}
    </>
  );
}

function DeferredBacklog({
  deferred,
  formattingPreferences,
  profilesById,
  projectId,
}: {
  deferred: BacklogWork[];
  formattingPreferences: AccountPreferences;
  profilesById: Map<string, WorkProfile>;
  projectId: string;
}) {
  return deferred.length > 0 ? (
    <section aria-label="Deferred" className="space-y-2">
      <h3 className="font-semibold text-sm">Deferred</h3>
      <ol aria-label="Deferred" className="space-y-2">
        {deferred.map((work) => (
          <BacklogCard
            canReorder={false}
            formattingPreferences={formattingPreferences}
            key={work.id}
            profile={profilesById.get(work.id)}
            projectId={projectId}
            work={work}
          />
        ))}
      </ol>
    </section>
  ) : null;
}

function backlogGroupsForPresentation(
  works: BacklogWork[],
  presentation: BacklogPresentation,
  timeZone: string,
  now: Date,
) {
  return presentation === "Manual order"
    ? partitionDeferredBacklog(works, timeZone, now)
    : { current: works, deferred: [] };
}
