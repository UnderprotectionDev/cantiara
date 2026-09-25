import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { formatTimeInStatus } from "../../lib/kanban-view";

export function KanbanWorkSummary({
  focusThreshold,
  works,
}: {
  focusThreshold: number | null;
  works: readonly WorkProfile[];
}) {
  const inProgressCount = works.filter(
    (work) => work.status === "In Progress",
  ).length;

  return (
    <div className="space-y-1 text-right text-sm">
      <p className="text-muted-foreground">{works.length} Work</p>
      <p>In Progress count: {inProgressCount}</p>
      {focusThreshold !== null && inProgressCount > focusThreshold ? (
        <p aria-label="Focus threshold exceeded" role="status">
          Focus threshold exceeded: {inProgressCount} / {focusThreshold}
        </p>
      ) : null}
    </div>
  );
}

export function KanbanWorkDetails({ work }: { work: WorkProfile }) {
  const completedChecklistItems = work.checklist.filter(
    (item) => item.completed,
  ).length;
  const hasDetails =
    work.plannedStartDate ||
    work.targetDate ||
    work.reappearDate ||
    work.status !== "Closed" ||
    work.checklist.length > 0;

  if (!hasDetails) {
    return null;
  }

  return (
    <div className="space-y-1 text-muted-foreground text-xs">
      {work.plannedStartDate ? (
        <p>Planned start: {work.plannedStartDate}</p>
      ) : null}
      {work.targetDate ? <p>Target date: {work.targetDate}</p> : null}
      {work.reappearDate ? <p>Reappear date: {work.reappearDate}</p> : null}
      {work.status === "Closed" ? null : (
        <p>Time in status: {formatTimeInStatus(work.statusChangedAt)}</p>
      )}
      {work.checklist.length > 0 ? (
        <p>
          Checklist: {completedChecklistItems} / {work.checklist.length}
        </p>
      ) : null}
    </div>
  );
}
