import type { RelationView } from "@cantiara/api/relations";
import type { WorkContextPriorityValues } from "@cantiara/api/work-context";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { describe, expect, test, vi } from "vitest";

import {
  createWorkContextAccess,
  type WorkContextProjectionOptions,
} from "./work-context";

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  description: null,
  effort: "3 days",
  featureHealthHistory: [],
  id: "work-1",
  key: "PAY-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  recreatedFrom: null,
  revision: 1,
  status: "In Progress",
  targetDate: "2026-10-01",
  title: "Checkout work",
  type: "Task",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const projectedRelations: RelationView[] = [
  {
    blockingHistory: [],
    blockingStatus: null,
    blockingResolvedAt: null,
    blockingResolutionNote: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    direction: "incoming",
    id: "feedback-1",
    inverseLabel: "Provides evidence",
    kind: "Evidence",
    label: "Provides evidence",
    revision: 1,
    source: {
      broken: null,
      key: "FB-1",
      label: "FB-1",
      originPosition: null,
      projectId: "project-1",
      recordId: "feedback-1",
      recordType: "Feedback",
      status: null,
      title: "Make checkout clearer",
      workType: null,
    },
    target: {
      broken: null,
      key: work.key,
      label: work.key,
      originPosition: null,
      projectId: work.projectId,
      recordId: work.id,
      recordType: "Work",
      status: work.status,
      title: work.title,
      workType: work.type,
    },
  },
];

describe("Work Context server projection", () => {
  test("loads the authorized Work projection and direct relation set", async () => {
    const find = vi.fn(async () => work);
    const list = vi.fn(async () => projectedRelations);
    const access = createWorkContextAccess({ find }, { list });

    await expect(access.find("account-1", work.id)).resolves.toEqual({
      priorityValues: {
        effort: work.effort,
        targetDate: work.targetDate,
      },
      relations: projectedRelations,
    });
    expect(find).toHaveBeenCalledWith("account-1", work.id);
    expect(list).toHaveBeenCalledWith("account-1", {
      recordId: work.id,
      recordType: "Work",
    });
  });

  test("uses owning adapters for nested authorized sources and criteria", async () => {
    const find = vi.fn(async () => work);
    const list = vi.fn(async () => []);
    const priorityValues: WorkContextPriorityValues = {
      effort: work.effort,
      priorityMetrics: [
        {
          id: "evidence-strength",
          name: "Evidence strength",
          projectId: work.projectId,
          value: "High",
        },
      ],
      targetDate: work.targetDate,
    };
    const options: WorkContextProjectionOptions = {
      priorityValues: vi.fn(async () => priorityValues),
      relations: vi.fn(async () => projectedRelations),
    };
    const access = createWorkContextAccess({ find }, { list }, options);

    await expect(access.find("account-1", work.id)).resolves.toEqual({
      priorityValues,
      relations: projectedRelations,
    });
    expect(options.priorityValues).toHaveBeenCalledWith("account-1", work);
    expect(options.relations).toHaveBeenCalledWith("account-1", work.id);
    expect(list).not.toHaveBeenCalled();
  });

  test("does not project data for an inaccessible Work", async () => {
    const find = vi.fn(async () => null);
    const list = vi.fn(async () => projectedRelations);
    const priorityValues = vi.fn(async () => ({}));
    const access = createWorkContextAccess(
      { find },
      { list },
      { priorityValues, relations: vi.fn(async () => projectedRelations) },
    );

    await expect(access.find("account-1", "missing-work")).resolves.toBeNull();
    expect(list).not.toHaveBeenCalled();
    expect(priorityValues).not.toHaveBeenCalled();
  });
});
