import type { WorkAutomationEvent } from "@cantiara/api/work-automation";
import { workAutomationEventSchema } from "@cantiara/api/work-automation";
import type {
  WorkLifecycleAccess,
  WorkProfile,
} from "@cantiara/api/work-lifecycle";
import { describe, expect, test } from "vitest";

import { withWorkAutomationEvents } from "../work-automation-events";

const PROJECT_ID = "project-1";
const NOW = new Date("2026-10-22T09:00:00.000Z");

function profile(
  id: string,
  overrides: Partial<WorkProfile> = {},
): WorkProfile {
  return {
    archivedAt: null,
    captureProvenance: null,
    checklist: [],
    closureReason: null,
    closureResult: null,
    createdAt: NOW.toISOString(),
    description: null,
    effort: null,
    expectedOutcome: null,
    featureHealthHistory: [],
    id,
    key: `WA-${id}`,
    nextConcreteStep: null,
    nextConcreteStepUpdatedAt: null,
    number: 1,
    primaryFeatureId: null,
    primarySpecId: null,
    problemOpportunity: null,
    projectId: PROJECT_ID,
    plannedStartDate: null,
    recreatedFrom: null,
    reappearDate: null,
    revision: 1,
    roadmapHorizon: null,
    status: "Not Started",
    statusChangedAt: NOW.toISOString(),
    targetDate: null,
    title: "Ship it",
    type: "Task",
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

interface Fixture {
  decorated: WorkLifecycleAccess;
  emitted: WorkAutomationEvent[];
}

function fixture(output: Record<string, unknown>): Fixture {
  const emitted: WorkAutomationEvent[] = [];
  const automation = {
    // biome-ignore lint/suspicious/useAwait: the engine double records synchronously.
    handleEvent: async (raw: unknown) => {
      emitted.push(workAutomationEventSchema.parse(raw));
      return { reason: "unsupported-event", status: "ignored" } as const;
    },
  };
  const decorated = withWorkAutomationEvents(
    output as unknown as WorkLifecycleAccess,
    automation,
    () => NOW,
  );
  return { decorated, emitted };
}

describe("Work Automation event decoration", () => {
  test("a fields-editor status move is an original status change", async () => {
    const before = profile("work-1");
    const updated = profile("work-1", { revision: 2, status: "In Progress" });
    const { decorated, emitted } = fixture({
      find: () => Promise.resolve(before),
      updateFields: () => Promise.resolve(updated),
    });

    await decorated.updateFields("account-1", {
      baseRevision: 1,
      clientIdempotencyKey: "fields-key-1",
      fields: { status: "In Progress" },
      workId: "work-1",
    });

    expect(
      emitted.map((event) => ({
        id: event.id,
        kind: event.kind,
        to: event.kind === "work-status-changed" ? event.to : null,
        workId: "workId" in event ? event.workId : null,
      })),
    ).toEqual([
      {
        id: "status-fields:fields-key-1",
        kind: "work-status-changed",
        to: "In Progress",
        workId: "work-1",
      },
    ]);
    expect(emitted[0]?.origin).toBe("user");
  });

  test("a fields edit without a status move emits nothing", async () => {
    const before = profile("work-1");
    const { decorated, emitted } = fixture({
      find: () => Promise.resolve(before),
      updateFields: () =>
        Promise.resolve(profile("work-1", { title: "Renamed" })),
    });

    await decorated.updateFields("account-1", {
      baseRevision: 1,
      clientIdempotencyKey: "fields-key-2",
      fields: { title: "Renamed" },
      workId: "work-1",
    });

    expect(emitted).toEqual([]);
  });

  test("create, recreate and checklist conversion emit work-created", async () => {
    const created = profile("work-2");
    const recreated = profile("work-3");
    const converted = profile("work-4");
    const { decorated, emitted } = fixture({
      convertChecklistItem: () =>
        Promise.resolve({ sourceWork: profile("work-1"), work: converted }),
      create: () => Promise.resolve(created),
      recreate: () => Promise.resolve(recreated),
    });

    await decorated.create("account-1", {} as never);
    await decorated.recreate("account-1", {} as never);
    await decorated.convertChecklistItem("account-1", {} as never);

    expect(
      emitted.map((event) => ("workId" in event ? event.workId : null)),
    ).toEqual(["work-2", "work-3", "work-4"]);
    for (const event of emitted) {
      expect(event.kind).toBe("work-created");
      expect(event.origin).toBe("user");
    }
  });

  test("document work batch emits one work-created event per Work", async () => {
    const first = profile("work-5");
    const second = profile("work-6");
    const { decorated, emitted } = fixture({
      createDocumentWorkBatch: () => Promise.resolve([first, second]),
    });

    await decorated.createDocumentWorkBatch?.("account-1", {} as never);

    expect(
      emitted.map((event) => ("workId" in event ? event.workId : null)),
    ).toEqual(["work-5", "work-6"]);
    for (const event of emitted) {
      expect(event.kind).toBe("work-created");
    }
  });
});
