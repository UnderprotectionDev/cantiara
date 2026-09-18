import type {
  MutationApply,
  MutationCommand,
  MutationContract,
  MutationPayload,
  MutationReceipt,
} from "@cantiara/api/mutation-and-undo";
import {
  type CreateWorkMutationInput,
  WORK_TYPE_OPTIONS,
  type WorkLifecycleMutationContracts,
  type WorkLifecycleMutationValue,
  type WorkProfile,
} from "@cantiara/api/work-lifecycle";
import { describe, expect, test } from "vitest";

import {
  createWorkLifecycle,
  WorkCreationConflictError,
  type WorkCreationReservation,
  type WorkLifecycleStore,
  WorkTypeImpactPreviewRequiredError,
} from "./work-lifecycle";

const PROJECT_ID = "project-1";

function createMemoryWorkLifecycle(
  options: {
    commitThenFailWithTitle?: string;
    failNextCommit?: boolean;
    initialWorks?: WorkProfile[];
  } = {},
) {
  const works = new Map(
    options.initialWorks?.map((work) => [work.id, work] as const),
  );
  const reservations = new Map<string, WorkCreationReservation>();
  const {
    commitThenFailWithTitle: configuredCommitThenFailWithTitle,
    failNextCommit: configuredFailNextCommit,
  } = options;
  let nextNumber = 1;
  let commitThenFailWithTitle = configuredCommitThenFailWithTitle;
  let failNextCommit = configuredFailNextCommit ?? false;

  const store: WorkLifecycleStore = {
    find: async (_accountId, workId) => works.get(workId) ?? null,
    findByClientIdempotencyKey: (_accountId, projectId, key) => {
      const reservation = reservations.get(`${projectId}:${key}`);
      return Promise.resolve(
        reservation ? (works.get(reservation.workId) ?? null) : null,
      );
    },
    list: async (_accountId, projectId, listOptions) =>
      [...works.values()]
        .filter(
          (work) =>
            work.projectId === projectId &&
            (work.archivedAt !== null) === (listOptions?.archived ?? false),
        )
        .sort((left, right) => left.number - right.number),
    reserveCreate: (_accountId, projectId, key, payloadFingerprint) => {
      const reservationKey = `${projectId}:${key}`;
      const existing = reservations.get(reservationKey);
      if (existing) {
        if (existing.payloadFingerprint !== payloadFingerprint) {
          return Promise.reject(new WorkCreationConflictError());
        }
        return Promise.resolve(existing);
      }

      const number = nextNumber;
      nextNumber += 1;
      const reservation: WorkCreationReservation = {
        id: `work-${number}`,
        key: `CANT-${number}`,
        number,
        payloadFingerprint,
        projectId,
        shortCode: "CANT",
        workId: `work-${number}`,
      };
      reservations.set(reservationKey, reservation);
      return Promise.resolve(reservation);
    },
  };

  const mutationContracts: WorkLifecycleMutationContracts = {
    create: () =>
      ({
        mutate: async <TPayload extends MutationPayload>(
          command: MutationCommand<TPayload>,
          apply: MutationApply<WorkLifecycleMutationValue, TPayload>,
        ) => {
          if (command.kind !== "human") {
            throw new Error("Expected a human Work command.");
          }
          if (failNextCommit) {
            failNextCommit = false;
            throw new Error("simulated commit failure");
          }
          const nextValue = await apply({
            currentRevision: 0,
            currentValue: { work: null },
            payload: command.payload,
          });
          if (!nextValue.work) {
            throw new Error("A Work create must return a Work.");
          }
          works.set(nextValue.work.id, nextValue.work);
          if (commitThenFailWithTitle) {
            works.set(nextValue.work.id, {
              ...nextValue.work,
              title: commitThenFailWithTitle,
            });
            commitThenFailWithTitle = undefined;
            throw new Error("simulated commit failure after durable write");
          }
          return {
            actor: command.actor,
            committedAt: nextValue.work.createdAt,
            id: `receipt-${nextValue.work.id}`,
            nextValue,
            origin: {
              clientIdempotencyKey: command.clientIdempotencyKey,
              kind: "human" as const,
            },
            payloadFingerprint: "0".repeat(64),
            previousValue: { work: null },
            revision: 1,
            targetId: command.targetId,
          } satisfies MutationReceipt<WorkLifecycleMutationValue>;
        },
      }) as MutationContract<WorkLifecycleMutationValue>,
    update: () =>
      ({
        mutate: async <TPayload extends MutationPayload>(
          command: MutationCommand<TPayload>,
          apply: MutationApply<WorkLifecycleMutationValue, TPayload>,
        ) => {
          if (command.kind !== "human") {
            throw new Error("Expected a human Work command.");
          }
          const currentWork = works.get(command.targetId) ?? null;
          const previousValue = { work: currentWork };
          const nextValue = await apply({
            currentRevision: currentWork?.revision ?? 0,
            currentValue: previousValue,
            payload: command.payload,
          });
          if (!nextValue.work) {
            throw new Error("A Work update must return a Work.");
          }
          works.set(nextValue.work.id, nextValue.work);
          return {
            actor: command.actor,
            committedAt: nextValue.work.updatedAt,
            id: `receipt-${nextValue.work.id}-${nextValue.work.revision}`,
            nextValue,
            origin: {
              clientIdempotencyKey: command.clientIdempotencyKey,
              kind: "human" as const,
            },
            payloadFingerprint: "0".repeat(64),
            previousValue,
            revision: nextValue.work.revision,
            targetId: command.targetId,
          } satisfies MutationReceipt<WorkLifecycleMutationValue>;
        },
      }) as MutationContract<WorkLifecycleMutationValue>,
  };

  return createWorkLifecycle({
    mutationContracts,
    store,
  });
}

function createInput(
  clientIdempotencyKey: string,
  values: Partial<CreateWorkMutationInput> = {},
): CreateWorkMutationInput {
  return {
    baseRevision: 0,
    clientIdempotencyKey,
    projectId: PROJECT_ID,
    title: "Ship the first Work",
    ...values,
  };
}

describe("Work Lifecycle seam", () => {
  test("creates a title-only Work with a stable key and protected defaults", async () => {
    const workLifecycle = createMemoryWorkLifecycle();

    await expect(
      workLifecycle.create("account-1", createInput("create-1")),
    ).resolves.toMatchObject({
      archivedAt: null,
      closureResult: null,
      key: "CANT-1",
      number: 1,
      projectId: PROJECT_ID,
      status: "Not Started",
      title: "Ship the first Work",
      type: "Task",
    });
  });

  test("archives and unarchives Work without changing identity or closure", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const created = await workLifecycle.create(
      "account-1",
      createInput("archive-create"),
    );

    const archived = await workLifecycle.archive("account-1", {
      baseRevision: created.revision,
      clientIdempotencyKey: "archive-work",
      workId: created.id,
    });

    expect(archived).toMatchObject({
      closureResult: null,
      id: created.id,
      key: created.key,
      status: "Not Started",
    });
    expect(archived.archivedAt).not.toBeNull();
    await expect(workLifecycle.list("account-1", PROJECT_ID)).resolves.toEqual(
      [],
    );
    await expect(
      workLifecycle.list("account-1", PROJECT_ID, { archived: true }),
    ).resolves.toEqual([archived]);

    const unarchived = await workLifecycle.unarchive("account-1", {
      baseRevision: archived.revision,
      clientIdempotencyKey: "unarchive-work",
      workId: created.id,
    });

    expect(unarchived).toMatchObject({
      archivedAt: null,
      closureResult: null,
      id: created.id,
      key: created.key,
      status: "Not Started",
    });
    await expect(workLifecycle.list("account-1", PROJECT_ID)).resolves.toEqual([
      unarchived,
    ]);
  });

  test("keeps closed Work in the default list until it is explicitly archived", async () => {
    const closedWork: WorkProfile = {
      archivedAt: null,
      captureProvenance: null,
      closureResult: "Completed",
      createdAt: "2026-09-18T09:00:00.000Z",
      id: "closed-work",
      key: "CANT-7",
      number: 7,
      projectId: PROJECT_ID,
      revision: 3,
      status: "Closed",
      title: "Already completed Work",
      type: "Task",
      updatedAt: "2026-09-18T10:00:00.000Z",
    };
    const workLifecycle = createMemoryWorkLifecycle({
      initialWorks: [closedWork],
    });

    await expect(workLifecycle.list("account-1", PROJECT_ID)).resolves.toEqual([
      closedWork,
    ]);
    await expect(
      workLifecycle.list("account-1", PROJECT_ID, { archived: true }),
    ).resolves.toEqual([]);

    const archived = await workLifecycle.archive("account-1", {
      baseRevision: closedWork.revision,
      clientIdempotencyKey: "archive-closed-work",
      workId: closedWork.id,
    });
    expect(archived).toMatchObject({
      closureResult: "Completed",
      id: closedWork.id,
      key: closedWork.key,
      status: "Closed",
    });

    await expect(
      workLifecycle.unarchive("account-1", {
        baseRevision: archived.revision,
        clientIdempotencyKey: "unarchive-closed-work",
        workId: closedWork.id,
      }),
    ).resolves.toMatchObject({
      archivedAt: null,
      closureResult: "Completed",
      id: closedWork.id,
      key: closedWork.key,
      status: "Closed",
    });
  });

  test("persists Capture provenance on the Work created by conversion", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const captureProvenance = {
      attachment: { id: "staging-1", name: "screenshot.png" },
      captureId: "capture-1",
      capturedAt: "2026-09-16T09:00:00.000Z",
      content: "The preview is blank",
      fields: { "Observed Behavior": "Blank" },
      link: "https://example.com/issue",
      origin: { kind: "Web Capture", url: "https://example.com/issue" },
      template: "Bug Capture" as const,
    };

    await expect(
      workLifecycle.create(
        "account-1",
        createInput("create-from-capture", { captureProvenance }),
      ),
    ).resolves.toMatchObject({ captureProvenance });
  });

  test("accepts ordinary spaces in the title and stores the normalized value", async () => {
    const workLifecycle = createMemoryWorkLifecycle();

    await expect(
      workLifecycle.create(
        "account-1",
        createInput("create-spaces", { title: "  Work with spaces  " }),
      ),
    ).resolves.toMatchObject({ title: "Work with spaces" });
  });

  test.each(WORK_TYPE_OPTIONS)("accepts the %s Work type", async (type) => {
    const workLifecycle = createMemoryWorkLifecycle();

    await expect(
      workLifecycle.create(
        "account-1",
        createInput(`create-${type}`, { type }),
      ),
    ).resolves.toMatchObject({ type });
  });

  test("does not reuse an allocated number after a failed create", async () => {
    const workLifecycle = createMemoryWorkLifecycle({ failNextCommit: true });

    await expect(
      workLifecycle.create("account-1", createInput("failed-create")),
    ).rejects.toThrow("simulated commit failure");

    await expect(
      workLifecycle.create("account-1", createInput("successful-create")),
    ).resolves.toMatchObject({ key: "CANT-2", number: 2 });
  });

  test("rejects a different payload when retrying a failed allocation", async () => {
    const workLifecycle = createMemoryWorkLifecycle({ failNextCommit: true });
    const failedInput = createInput("failed-retry");

    await expect(
      workLifecycle.create("account-1", failedInput),
    ).rejects.toThrow("simulated commit failure");
    await expect(
      workLifecycle.create("account-1", {
        ...failedInput,
        title: "A different retry payload",
      }),
    ).rejects.toBeInstanceOf(WorkCreationConflictError);
  });

  test("replays the same Work for the same client idempotency key", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const input = createInput("replay-create");

    const first = await workLifecycle.create("account-1", input);
    const replay = await workLifecycle.create("account-1", input);

    expect(replay).toEqual(first);
  });

  test("rejects a different payload for an existing client idempotency key", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const input = createInput("conflicting-create");

    await workLifecycle.create("account-1", input);

    await expect(
      workLifecycle.create("account-1", {
        ...input,
        title: "A different Work title",
      }),
    ).rejects.toBeInstanceOf(WorkCreationConflictError);
  });

  test("rejects a different payload found after a failed mutation", async () => {
    const workLifecycle = createMemoryWorkLifecycle({
      commitThenFailWithTitle: "The committed title",
    });

    await expect(
      workLifecycle.create(
        "account-1",
        createInput("failed-replay", { title: "The requested title" }),
      ),
    ).rejects.toBeInstanceOf(WorkCreationConflictError);
  });

  test("updates non-Feature types freely and previews Feature boundaries", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("type-change-create"),
    );

    await expect(
      workLifecycle.previewTypeChange("account-1", {
        type: "Bug",
        workId: work.id,
      }),
    ).resolves.toMatchObject({
      currentType: "Task",
      nextType: "Bug",
      requiresImpactPreview: false,
    });
    await expect(
      workLifecycle.updateType("account-1", {
        baseRevision: work.revision,
        clientIdempotencyKey: "type-change-bug",
        type: "Bug",
        workId: work.id,
      }),
    ).resolves.toMatchObject({ type: "Bug" });

    const featurePreview = await workLifecycle.previewTypeChange("account-1", {
      type: "Feature",
      workId: work.id,
    });
    expect(featurePreview).toMatchObject({
      currentType: "Bug",
      nextType: "Feature",
      requiresImpactPreview: true,
    });
    if (!featurePreview) {
      throw new Error("Expected a Feature type-change preview.");
    }

    await expect(
      workLifecycle.updateType("account-1", {
        baseRevision: 2,
        clientIdempotencyKey: "type-change-feature-without-preview",
        type: "Feature",
        workId: work.id,
      }),
    ).rejects.toBeInstanceOf(WorkTypeImpactPreviewRequiredError);

    const feature = await workLifecycle.updateType("account-1", {
      baseRevision: 2,
      clientIdempotencyKey: "type-change-feature",
      impactPreviewId: featurePreview.previewId,
      type: "Feature",
      workId: work.id,
    });
    expect(feature).toMatchObject({ revision: 3, type: "Feature" });

    /* The Feature boundary also protects the exit path. */
    await expect(
      workLifecycle.previewTypeChange("account-1", {
        type: "Task",
        workId: work.id,
      }),
    ).resolves.toMatchObject({
      currentType: "Feature",
      nextType: "Task",
      requiresImpactPreview: true,
    });

    expect(feature.type).toBe("Feature");
  });
});
