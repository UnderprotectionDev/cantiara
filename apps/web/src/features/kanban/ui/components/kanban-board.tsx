import {
  PROTECTED_WORK_STATUS_OPTIONS,
  type WorkStatusLabel,
} from "@cantiara/api/project-shell";
import { workContextSourceText } from "@cantiara/api/work-context";
import type { WorkProfile, WorkStatus } from "@cantiara/api/work-lifecycle";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { GripVertical } from "lucide-react";
import {
  type ChangeEvent,
  type ComponentProps,
  useCallback,
  useMemo,
  useState,
} from "react";
import { workRecordHref } from "@/features/project-shell/lib/project-shell-navigation";
import { getWorkStatusLabel } from "@/features/work-lifecycle/ui/forms/work-status-form";
import { orpc } from "@/utils/orpc";
import { buildKanbanCardSummary } from "../../lib/kanban-card-summary";
import { KanbanWorkDetails, KanbanWorkSummary } from "./kanban-work-summary";

const WORK_DRAG_TYPE = "kanban-work";
const statusByDropId = new Map<string, WorkStatus>(
  PROTECTED_WORK_STATUS_OPTIONS.map((status) => [statusDropId(status), status]),
);

type DragEndEvent = Parameters<
  NonNullable<ComponentProps<typeof DragDropProvider>["onDragEnd"]>
>[0];

export default function KanbanBoard({
  disabled,
  error,
  focusThreshold,
  onStatusAction,
  projectId,
  softWipLimits,
  workStatusLabels,
  works,
}: {
  disabled: boolean;
  error: string | null;
  focusThreshold: number | null;
  onStatusAction: (work: WorkProfile, targetStatus: WorkStatus) => void;
  projectId: string;
  softWipLimits: Record<WorkStatus, number | null>;
  workStatusLabels: readonly WorkStatusLabel[];
  works: readonly WorkProfile[];
}) {
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<WorkStatus>>(
    () => new Set(),
  );
  const toggleCollapsedStatus = useCallback((status: WorkStatus) => {
    setCollapsedStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);
  const worksByStatus = useMemo(() => {
    const grouped = new Map<WorkStatus, WorkProfile[]>(
      PROTECTED_WORK_STATUS_OPTIONS.map((status) => [status, []]),
    );
    for (const work of works) {
      grouped.get(work.status)?.push(work);
    }
    return grouped;
  }, [works]);
  const workByDragId = useMemo(
    () => new Map(works.map((work) => [workDragId(work.id), work])),
    [works],
  );
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.canceled) {
        return;
      }
      const work = workByDragId.get(String(event.operation.source?.id ?? ""));
      const targetStatus = statusByDropId.get(
        String(event.operation.target?.id ?? ""),
      );
      if (work && targetStatus) {
        onStatusAction(work, targetStatus);
      }
    },
    [onStatusAction, workByDragId],
  );

  return (
    <section aria-labelledby="kanban-board-heading" className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3
            className="font-semibold text-xl tracking-tight"
            id="kanban-board-heading"
          >
            Board
          </h3>
          <p className="mt-1 text-muted-foreground text-sm">Kanban</p>
        </div>
        <KanbanWorkSummary focusThreshold={focusThreshold} works={works} />
      </header>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <DragDropProvider onDragEnd={handleDragEnd}>
        <div className="flex flex-wrap items-start gap-4">
          {PROTECTED_WORK_STATUS_OPTIONS.map((status) => {
            const label = getWorkStatusLabel(status, workStatusLabels);
            const statusWorks = worksByStatus.get(status) ?? [];

            return (
              <KanbanColumn
                collapsed={collapsedStatuses.has(status)}
                disabled={disabled}
                key={status}
                label={label}
                limit={softWipLimits[status]}
                onStatusAction={onStatusAction}
                onToggleCollapsed={toggleCollapsedStatus}
                projectId={projectId}
                status={status}
                statusWorks={statusWorks}
                workStatusLabels={workStatusLabels}
              />
            );
          })}
        </div>
      </DragDropProvider>
    </section>
  );
}

function KanbanColumn({
  collapsed,
  disabled,
  label,
  limit,
  onStatusAction,
  onToggleCollapsed,
  projectId,
  status,
  statusWorks,
  workStatusLabels,
}: {
  collapsed: boolean;
  disabled: boolean;
  label: string;
  limit: number | null;
  onStatusAction: (work: WorkProfile, targetStatus: WorkStatus) => void;
  onToggleCollapsed: (status: WorkStatus) => void;
  projectId: string;
  status: (typeof PROTECTED_WORK_STATUS_OPTIONS)[number];
  statusWorks: readonly WorkProfile[];
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const contextQueries = useQueries({
    queries: statusWorks.map((work) =>
      orpc.workContext.queryOptions({ input: { workId: work.id } }),
    ),
  });
  const hasOpenBlocker = contextQueries.some((query) =>
    query.data?.relations.some(
      (relation) =>
        relation.kind === "Blocks" &&
        relation.direction === "incoming" &&
        relation.blockingStatus === "Active",
    ),
  );
  const droppable = useDroppable({
    accept: WORK_DRAG_TYPE,
    disabled,
    id: statusDropId(status),
  });
  const handleToggleCollapsed = useCallback(
    () => onToggleCollapsed(status),
    [onToggleCollapsed, status],
  );

  return (
    <section
      aria-labelledby={`kanban-column-heading-${statusSlug(status)}`}
      className={`min-h-44 space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3 transition-colors motion-reduce:transition-none ${collapsed ? "w-40 min-w-0 flex-none" : "min-w-48 flex-1"} ${droppable.isDropTarget ? "border-primary/70 bg-primary/5 ring-2 ring-primary/30" : ""}`}
      data-kanban-column={status}
      ref={droppable.ref}
    >
      <header
        className={
          collapsed ? "space-y-2" : "flex items-center justify-between gap-2"
        }
      >
        <h4
          className="font-semibold text-sm"
          id={`kanban-column-heading-${statusSlug(status)}`}
        >
          {label}
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-background px-2 py-0.5 text-muted-foreground text-xs tabular-nums">
            {statusWorks.length}
            {limit === null ? "" : ` / ${limit}`}
          </span>
          {limit !== null && statusWorks.length > limit ? (
            <span aria-label={`Over limit ${label}`} role="status">
              Over limit
            </span>
          ) : null}
          <Button
            aria-controls={`kanban-column-list-${statusSlug(status)}`}
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
            onClick={handleToggleCollapsed}
            size="xs"
            type="button"
            variant="ghost"
          >
            {collapsed ? "Expand" : "Collapse"}
          </Button>
        </div>
      </header>
      {hasOpenBlocker ? (
        <p className="text-muted-foreground text-xs">Open blocker</p>
      ) : null}
      <ul
        aria-label={`${label} Work`}
        className="space-y-2"
        hidden={collapsed}
        id={`kanban-column-list-${statusSlug(status)}`}
      >
        {statusWorks.map((work) => (
          <li key={work.id}>
            <KanbanCard
              disabled={disabled}
              onStatusAction={onStatusAction}
              projectId={projectId}
              work={work}
              workStatusLabels={workStatusLabels}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function KanbanCard({
  disabled,
  onStatusAction,
  projectId,
  work,
  workStatusLabels,
}: {
  disabled: boolean;
  onStatusAction: (work: WorkProfile, targetStatus: WorkStatus) => void;
  projectId: string;
  work: WorkProfile;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const draggable = useDraggable({
    data: { workId: work.id },
    disabled,
    id: workDragId(work.id),
    type: WORK_DRAG_TYPE,
  });
  const statusControlId = `kanban-status-${encodeURIComponent(work.id)}`;
  const handleStatusChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const targetStatus = PROTECTED_WORK_STATUS_OPTIONS.find(
        (status) => status === event.target.value,
      );
      if (targetStatus) {
        onStatusAction(work, targetStatus);
      }
    },
    [onStatusAction, work],
  );

  return (
    <article
      className={`space-y-3 rounded-md border border-border/70 bg-card p-3 shadow-sm transition-opacity motion-reduce:transition-none ${draggable.isDragging ? "opacity-60" : ""}`}
      ref={draggable.ref}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="break-words font-medium text-sm">
            <span className="text-muted-foreground">{work.key}</span>{" "}
            {work.title}
          </p>
          <p className="text-muted-foreground text-xs">{work.type}</p>
        </div>
        <Button
          aria-label={`Move ${work.key}`}
          className="min-h-11 shrink-0 cursor-grab touch-none active:cursor-grabbing"
          disabled={disabled}
          ref={draggable.handleRef}
          size="sm"
          type="button"
          variant="ghost"
        >
          <GripVertical aria-hidden="true" />
          Move
        </Button>
      </div>
      <div className="space-y-2">
        <label
          className="text-muted-foreground text-xs"
          htmlFor={statusControlId}
        >
          Status
        </label>
        <NativeSelect
          aria-label={`Status for ${work.key}`}
          className="min-h-11"
          disabled={disabled}
          id={statusControlId}
          onChange={handleStatusChange}
          value={work.status}
        >
          {PROTECTED_WORK_STATUS_OPTIONS.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {getWorkStatusLabel(status, workStatusLabels)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {work.closureResult ? (
        <Badge variant="secondary">{work.closureResult}</Badge>
      ) : null}
      <KanbanCardSummary work={work} />
      <KanbanWorkDetails work={work} />
      <a
        className="inline-block min-h-11 py-3 text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        href={workRecordHref(projectId, work.id)}
      >
        Open source record
      </a>
    </article>
  );
}

export function KanbanCardSummary({ work }: { work: WorkProfile }) {
  const query = useQuery(
    orpc.workContext.queryOptions({ input: { workId: work.id } }),
  );
  if (!(query.data || query.isError)) {
    return null;
  }

  const summary = query.data ? buildKanbanCardSummary(work, query.data) : null;

  return (
    <>
      {query.isError ? (
        <p className="text-destructive text-xs" role="alert">
          Priority and related record details could not be loaded.
        </p>
      ) : null}
      {summary &&
      (summary.priorities.length > 0 || summary.signals.length > 0) ? (
        <ul
          aria-label={`${work.key} priority, blocker, and risk summary`}
          className="space-y-1 text-muted-foreground text-xs"
        >
          {summary.priorities.map((priority) => (
            <li key={priority.id}>
              <span className="text-muted-foreground">Priority:</span>{" "}
              {priority.label}: {priority.value}
            </li>
          ))}
          {summary.signals.map((signal) => (
            <li key={signal.id}>
              {signal.label}: {workContextSourceText(signal)}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function workDragId(workId: string) {
  return `kanban-work-${workId}`;
}

function statusDropId(status: WorkStatus) {
  return `kanban-status-${status}`;
}

function statusSlug(status: WorkStatus) {
  return status.toLowerCase().replaceAll(" ", "-");
}
