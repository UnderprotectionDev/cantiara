// biome-ignore-all lint/performance/noJsxPropsBind: Controls close over the current Backlog presentation.
import type { BacklogWork } from "@cantiara/api/backlog";
import { PRIORITY_METRIC_RANKS } from "@cantiara/api/priority-metrics";
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
import { useState } from "react";
import { usePriorityMetricProjectValues } from "@/features/priority-metrics/hooks/use-priority-metrics";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import {
  type BacklogPresentation,
  type BacklogSortField,
  presentBacklog,
} from "../../lib/backlog-presentation";

function BacklogCard({
  canReorder,
  projectId,
  work,
}: {
  canReorder: boolean;
  projectId: string;
  work: BacklogWork;
}) {
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
    </li>
  );
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
  const orderQuery = useQuery(
    orpc.projectBacklogOrder.queryOptions({ input: { projectId } }),
  );
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

  if (query.isPending || orderQuery.isPending) {
    return (
      <p className="mt-5 text-muted-foreground text-sm" role="status">
        Loading Backlog…
      </p>
    );
  }
  if (query.isError || orderQuery.isError) {
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
  const canReorder = presentation === "Manual order" && !updateOrder.isPending;
  const workName = (id: string | number) =>
    works.find((work) => work.id === id)?.title ?? "Work";

  function onDragEnd(event: DragEndEvent) {
    if (!(canReorder && event.over) || event.active.id === event.over.id) {
      return;
    }
    const from = works.findIndex((work) => work.id === event.active.id);
    const to = works.findIndex((work) => work.id === event.over?.id);
    if (from < 0 || to < 0) {
      return;
    }
    updateOrder.mutate(
      arrayMove(
        works.map((work) => work.id),
        from,
        to,
      ),
    );
  }

  return (
    <section className="mt-5 space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <span>Backlog sort</span>
        <select
          aria-label="Backlog sort"
          className="rounded-md border border-input bg-background px-3 py-2"
          onChange={(event) =>
            setPresentation(event.currentTarget.value as BacklogPresentation)
          }
          value={presentation}
        >
          <option>Manual order</option>
          <option>Priority</option>
          <option>Date</option>
          <option>Field</option>
        </select>
      </label>
      {presentation === "Priority" ? (
        <label className="flex items-center gap-2 text-sm">
          <span>Priority criterion</span>
          <select
            aria-label="Priority criterion"
            className="rounded-md border border-input bg-background px-3 py-2"
            onChange={(event) => setPriorityMetricId(event.currentTarget.value)}
            value={priorityMetricId}
          >
            <option value="">Priority criterion</option>
            {enabledMetrics.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {presentation === "Field" ? (
        <label className="flex items-center gap-2 text-sm">
          <span>Field to sort by</span>
          <select
            aria-label="Field to sort by"
            className="rounded-md border border-input bg-background px-3 py-2"
            onChange={(event) =>
              setField(event.currentTarget.value as BacklogSortField)
            }
            value={field}
          >
            <option>Title</option>
            <option>Status</option>
          </select>
        </label>
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
          items={displayedWorks.map((work) => work.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol aria-label="Backlog" className="space-y-2">
            {displayedWorks.map((work) => (
              <BacklogCard
                canReorder={canReorder}
                key={work.id}
                projectId={projectId}
                work={work}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </section>
  );
}
