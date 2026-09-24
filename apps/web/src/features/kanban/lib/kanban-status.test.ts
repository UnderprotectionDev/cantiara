import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { describe, expect, test, vi } from "vitest";
import { requestKanbanStatusMove } from "./kanban-status";

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-25T09:00:00.000Z",
  description: null,
  effort: null,
  featureHealthHistory: [],
  id: "work-1",
  key: "CAN-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  recreatedFrom: null,
  revision: 5,
  status: "Not Started",
  targetDate: null,
  title: "Keep the board on the source Work",
  type: "Task",
  updatedAt: "2026-09-25T09:00:00.000Z",
};
const closedWork: WorkProfile = {
  ...work,
  closureResult: "Completed",
  status: "Closed",
};

describe("Kanban status moves", () => {
  test("writes an open target status to the same Work record", () => {
    const onDirectMove = vi.fn();
    const onExplicitActionRequired = vi.fn();

    requestKanbanStatusMove(work, "Blocked", {
      onDirectMove,
      onExplicitActionRequired,
    });

    expect(onDirectMove).toHaveBeenCalledWith({
      baseRevision: 5,
      status: "Blocked",
      workId: "work-1",
    });
    expect(onExplicitActionRequired).not.toHaveBeenCalled();
  });

  test("routes a move into Closed through the explicit closure action", () => {
    const onDirectMove = vi.fn();
    const onExplicitActionRequired = vi.fn();

    requestKanbanStatusMove(work, "Closed", {
      onDirectMove,
      onExplicitActionRequired,
    });

    expect(onDirectMove).not.toHaveBeenCalled();
    expect(onExplicitActionRequired).toHaveBeenCalledWith({
      status: "Closed",
      workId: "work-1",
    });
  });

  test("routes a move out of Closed through the explicit reopen action", () => {
    const onDirectMove = vi.fn();
    const onExplicitActionRequired = vi.fn();

    requestKanbanStatusMove(closedWork, "Blocked", {
      onDirectMove,
      onExplicitActionRequired,
    });

    expect(onDirectMove).not.toHaveBeenCalled();
    expect(onExplicitActionRequired).toHaveBeenCalledWith({
      status: "Blocked",
      workId: "work-1",
    });
  });

  test("does not write when a card stays in its current status", () => {
    const onDirectMove = vi.fn();
    const onExplicitActionRequired = vi.fn();

    requestKanbanStatusMove(work, "Not Started", {
      onDirectMove,
      onExplicitActionRequired,
    });

    expect(onDirectMove).not.toHaveBeenCalled();
    expect(onExplicitActionRequired).not.toHaveBeenCalled();
  });
});
