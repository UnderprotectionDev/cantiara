import type {
  WorkOpenStatus,
  WorkProfile,
  WorkStatus,
} from "@cantiara/api/work-lifecycle";

export interface KanbanStatusMoveHandlers {
  onDirectMove: (input: {
    baseRevision: number;
    status: WorkOpenStatus;
    workId: string;
  }) => void;
  onExplicitActionRequired: (input: {
    status: WorkStatus;
    workId: string;
  }) => void;
}

export function requestKanbanStatusMove(
  work: Pick<WorkProfile, "id" | "revision" | "status">,
  targetStatus: WorkStatus,
  handlers: KanbanStatusMoveHandlers,
) {
  if (targetStatus === work.status) {
    return;
  }

  if (work.status === "Closed" || targetStatus === "Closed") {
    handlers.onExplicitActionRequired({
      status: targetStatus,
      workId: work.id,
    });
    return;
  }

  handlers.onDirectMove({
    baseRevision: work.revision,
    status: targetStatus,
    workId: work.id,
  });
}
