import type {
  RelationEndpointView,
  RelationView,
} from "@cantiara/api/relations";
import type { WorkContextProjection } from "@cantiara/api/work-context";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { describe, expect, test } from "vitest";
import { buildKanbanCardSummary } from "./kanban-card-summary";

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
  revision: 1,
  status: "In Progress",
  targetDate: null,
  title: "Prepare checkout",
  type: "Task",
  updatedAt: "2026-09-25T09:00:00.000Z",
};

function endpoint(
  overrides: Partial<RelationEndpointView> = {},
): RelationEndpointView {
  return {
    broken: null,
    key: null,
    label: null,
    originPosition: null,
    projectId: null,
    recordId: "record-1",
    recordType: "Work",
    status: null,
    title: null,
    workType: null,
    ...overrides,
  };
}

function relation(overrides: Partial<RelationView>): RelationView {
  return {
    blockingHistory: [],
    blockingResolutionNote: null,
    blockingResolvedAt: null,
    blockingStatus: null,
    createdAt: "2026-09-25T09:00:00.000Z",
    direction: "outgoing",
    id: "relation-1",
    inverseLabel: "Related",
    kind: "Related",
    label: "Related",
    revision: 1,
    source: endpoint({ recordId: work.id }),
    target: endpoint(),
    ...overrides,
  };
}

describe("Kanban card summary", () => {
  test("shows set priority metrics, active blockers, and related risks", () => {
    const context: WorkContextProjection = {
      priorityValues: {
        priorityMetrics: [
          {
            id: "metric-1",
            name: "Customer impact",
            projectId: work.projectId,
            value: "High",
          },
        ],
      },
      relations: [
        relation({
          blockingStatus: "Active",
          direction: "incoming",
          id: "blocker-1",
          inverseLabel: "Blocked by",
          kind: "Blocks",
          label: "Blocks",
          source: endpoint({
            key: "CAN-2",
            projectId: work.projectId,
            recordId: "work-2",
            recordType: "Work",
            status: "Blocked",
            title: "Resolve payment provider access",
            workType: "Task",
          }),
          target: endpoint({ recordId: work.id }),
        }),
        relation({
          blockingStatus: "Resolved",
          direction: "incoming",
          id: "resolved-blocker-1",
          kind: "Blocks",
          source: endpoint({
            key: "CAN-3",
            projectId: work.projectId,
            recordId: "work-3",
            recordType: "Work",
            status: "Closed",
            title: "Old blocker",
            workType: "Task",
          }),
          target: endpoint({ recordId: work.id }),
        }),
        relation({
          id: "risk-1",
          inverseLabel: "Evidence for",
          kind: "Evidence",
          label: "Evidence",
          source: endpoint({ recordId: work.id }),
          target: endpoint({
            projectId: work.projectId,
            recordId: "risk-1",
            recordType: "Risk",
            title: "Checkout failure remains possible",
          }),
        }),
      ],
    };

    const summary = buildKanbanCardSummary(work, context);

    expect(summary.priorities).toEqual([
      expect.objectContaining({ label: "Customer impact", value: "High" }),
    ]);
    expect(summary.signals).toEqual([
      expect.objectContaining({
        id: "relation:blocker-1",
        label: "Blocked by",
      }),
      expect.objectContaining({ id: "relation:risk-1", label: "Risk" }),
    ]);
  });

  test("omits unvalued priority criteria and closed blockers", () => {
    const context: WorkContextProjection = {
      priorityValues: {
        priorityMetrics: [
          {
            id: "metric-1",
            name: "Customer impact",
            projectId: work.projectId,
            value: null,
          },
        ],
      },
      relations: [
        relation({
          blockingStatus: "Resolved",
          direction: "incoming",
          id: "resolved-blocker-1",
          kind: "Blocks",
          source: endpoint({ recordType: "Work", title: "Closed blocker" }),
          target: endpoint({ recordId: work.id }),
        }),
      ],
    };

    const summary = buildKanbanCardSummary(work, context);

    expect(summary.priorities).toHaveLength(0);
    expect(summary.signals).toHaveLength(0);
  });
});
