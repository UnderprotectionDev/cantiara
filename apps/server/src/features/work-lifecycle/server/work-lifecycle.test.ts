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
  WorkClosureCheckRequiredError,
  type WorkClosureContext,
  WorkClosureResultRequiredError,
  WorkCreationConflictError,
  type WorkCreationReservation,
  type WorkLifecycleStore,
  WorkTypeImpactPreviewRequiredError,
  WorkVisibleUserInitiatorRequiredError,
} from "./work-lifecycle";

const PROJECT_ID = "project-1";
const VISIBLE_USER = { kind: "Visible user" } as const;

function createMemoryWorkLifecycle(
  options: {
    closureContext?: WorkClosureContext;
    commitThenFailWithTitle?: string;
    failNextCommit?: boolean;
  } = {},
) {
  const works = new Map<string, WorkProfile>();
  const reservations = new Map<string, WorkCreationReservation>();
  const {
    commitThenFailWithTitle: configuredCommitThenFailWithTitle,
    failNextCommit: configuredFailNextCommit,
  } = options;
  let nextNumber = 1;
  let commitThenFailWithTitle = configuredCommitThenFailWithTitle;
  let failNextCommit = configuredFailNextCommit ?? false;
  const updateReceipts = new Map<
    string,
    MutationReceipt<WorkLifecycleMutationValue>
  >();

  const store: WorkLifecycleStore = {
    find: async (_accountId, workId) => works.get(workId) ?? null,
    findByClientIdempotencyKey: (_accountId, projectId, key) => {
      const reservation = reservations.get(`${projectId}:${key}`);
      return Promise.resolve(
        reservation ? (works.get(reservation.workId) ?? null) : null,
      );
    },
    list: async (_accountId, projectId) =>
      [...works.values()]
        .filter((work) => work.projectId === projectId)
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
        replay: async () => null,
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
        replay: <TPayload extends MutationPayload>(
          command: MutationCommand<TPayload>,
        ) => {
          if (command.kind !== "human") {
            throw new Error("Expected a human Work command.");
          }
          return (
            updateReceipts.get(
              `${command.actor.actorId}:${command.targetId}:${command.clientIdempotencyKey}`,
            ) ?? null
          );
        },
        mutate: async <TPayload extends MutationPayload>(
          command: MutationCommand<TPayload>,
          apply: MutationApply<WorkLifecycleMutationValue, TPayload>,
        ) => {
          if (command.kind !== "human") {
            throw new Error("Expected a human Work command.");
          }
          const replay = updateReceipts.get(
            `${command.actor.actorId}:${command.targetId}:${command.clientIdempotencyKey}`,
          );
          if (replay) {
            return replay;
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
          const receipt = {
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
          updateReceipts.set(
            `${command.actor.actorId}:${command.targetId}:${command.clientIdempotencyKey}`,
            receipt,
          );
          return receipt;
        },
      }) as MutationContract<WorkLifecycleMutationValue>,
  };

  return createWorkLifecycle({
    closureContext: options.closureContext
      ? { get: async () => options.closureContext as WorkClosureContext }
      : undefined,
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
      closureResult: null,
      key: "CANT-1",
      number: 1,
      projectId: PROJECT_ID,
      status: "Not Started",
      title: "Ship the first Work",
      type: "Task",
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

  test.each([
    ["Not Started", "In Progress"],
    ["Not Started", "Blocked"],
    ["In Progress", "Not Started"],
    ["In Progress", "Blocked"],
    ["Blocked", "Not Started"],
    ["Blocked", "In Progress"],
  ] as const)(
    "moves freely from %s to %s without a closure result",
    async (_currentStatus, nextStatus) => {
      const workLifecycle = createMemoryWorkLifecycle();
      let work = await workLifecycle.create(
        "account-1",
        createInput(`status-${nextStatus}-create`),
      );

      if (_currentStatus !== "Not Started") {
        work = await workLifecycle.updateStatus(
          "account-1",
          {
            baseRevision: work.revision,
            clientIdempotencyKey: `status-${_currentStatus}`,
            status: _currentStatus,
            workId: work.id,
          },
          VISIBLE_USER,
        );
      }

      await expect(
        workLifecycle.updateStatus(
          "account-1",
          {
            baseRevision: work.revision,
            clientIdempotencyKey: `status-${nextStatus}`,
            status: nextStatus,
            workId: work.id,
          },
          VISIBLE_USER,
        ),
      ).resolves.toMatchObject({
        closureReason: null,
        closureResult: null,
        status: nextStatus,
      });
    },
  );

  test("rejects Closed when a planning-style status write skips the close step", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("planning-close-create"),
    );

    await expect(
      workLifecycle.updateStatus(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: "planning-close",
          status: "Closed",
          workId: work.id,
        },
        VISIBLE_USER,
      ),
    ).rejects.toBeInstanceOf(WorkClosureResultRequiredError);
    await expect(
      workLifecycle.find("account-1", work.id),
    ).resolves.toMatchObject({
      closureResult: null,
      status: "Not Started",
    });
  });

  test("does not let planning membership write a non-terminal status", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("planning-membership-create"),
    );

    await expect(
      workLifecycle.updateStatus(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: "planning-membership-status",
          status: "In Progress",
          workId: work.id,
        },
        { kind: "Planning membership" } as never,
      ),
    ).rejects.toBeInstanceOf(WorkVisibleUserInitiatorRequiredError);
    await expect(
      workLifecycle.find("account-1", work.id),
    ).resolves.toMatchObject({ status: "Not Started" });
  });

  test.each(["GitHub", "System automation"])(
    "does not let %s silently write a closure result",
    async (kind) => {
      const workLifecycle = createMemoryWorkLifecycle();
      const work = await workLifecycle.create(
        "account-1",
        createInput(`silent-close-${kind}`),
      );

      await expect(
        workLifecycle.close(
          "account-1",
          {
            baseRevision: work.revision,
            clientIdempotencyKey: `silent-close-${kind}`,
            closureResult: "Completed",
            workId: work.id,
          },
          { kind } as never,
        ),
      ).rejects.toBeInstanceOf(WorkVisibleUserInitiatorRequiredError);
      await expect(
        workLifecycle.find("account-1", work.id),
      ).resolves.toMatchObject({
        closureResult: null,
        status: "Not Started",
      });
    },
  );

  test.each(["Completed", "Abandoned"] as const)(
    "closes Work explicitly with the %s result and an optional reason",
    async (closureResult) => {
      const workLifecycle = createMemoryWorkLifecycle();
      const work = await workLifecycle.create(
        "account-1",
        createInput(`close-${closureResult}-create`),
      );

      await expect(
        workLifecycle.close(
          "account-1",
          {
            baseRevision: work.revision,
            clientIdempotencyKey: `close-${closureResult}`,
            closureResult,
            reason: "The founder made an explicit closure decision.",
            workId: work.id,
          },
          VISIBLE_USER,
        ),
      ).resolves.toMatchObject({
        closureReason: "The founder made an explicit closure decision.",
        closureResult,
        status: "Closed",
      });
    },
  );

  test("replays a close for the same client idempotency key", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("close-replay-create"),
    );
    const input = {
      baseRevision: work.revision,
      clientIdempotencyKey: "close-replay",
      closureResult: "Completed" as const,
      workId: work.id,
    };

    const first = await workLifecycle.close("account-1", input, VISIBLE_USER);

    await expect(
      workLifecycle.close("account-1", input, VISIBLE_USER),
    ).resolves.toEqual(first);
  });

  test("requires a closure result for every explicit close", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("close-without-result-create"),
    );

    await expect(
      workLifecycle.close(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: "close-without-result",
          workId: work.id,
        } as never,
        VISIBLE_USER,
      ),
    ).rejects.toThrow();
  });

  test("previews close without changing status and reopen requires a non-terminal target", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("close-cancel-create"),
    );

    await expect(
      workLifecycle.previewClose("account-1", { workId: work.id }),
    ).resolves.toMatchObject({ workId: work.id });
    await expect(
      workLifecycle.find("account-1", work.id),
    ).resolves.toMatchObject({ status: "Not Started" });

    const closed = await workLifecycle.close(
      "account-1",
      {
        baseRevision: work.revision,
        clientIdempotencyKey: "close-before-reopen",
        closureResult: "Completed",
        reason: "Released",
        workId: work.id,
      },
      VISIBLE_USER,
    );
    await expect(
      workLifecycle.reopen(
        "account-1",
        {
          baseRevision: closed.revision,
          clientIdempotencyKey: "reopen-to-blocked",
          confirmed: true,
          status: "Blocked",
          workId: work.id,
        },
        VISIBLE_USER,
      ),
    ).resolves.toMatchObject({
      closureReason: null,
      closureResult: null,
      status: "Blocked",
    });
  });

  test.each(["Not Started", "In Progress", "Blocked"] as const)(
    "reopens Closed Work explicitly as %s",
    async (status) => {
      const workLifecycle = createMemoryWorkLifecycle();
      const work = await workLifecycle.create(
        "account-1",
        createInput(`reopen-${status}-create`),
      );
      const closed = await workLifecycle.close(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: `reopen-${status}-close`,
          closureResult: "Completed",
          workId: work.id,
        },
        VISIBLE_USER,
      );

      await expect(
        workLifecycle.reopen(
          "account-1",
          {
            baseRevision: closed.revision,
            clientIdempotencyKey: `reopen-${status}`,
            confirmed: true,
            status,
            workId: work.id,
          },
          VISIBLE_USER,
        ),
      ).resolves.toMatchObject({
        closureReason: null,
        closureResult: null,
        status,
      });
    },
  );

  test("replays a reopen for the same client idempotency key", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("reopen-replay-create"),
    );
    const closed = await workLifecycle.close(
      "account-1",
      {
        baseRevision: work.revision,
        clientIdempotencyKey: "reopen-replay-close",
        closureResult: "Completed",
        workId: work.id,
      },
      VISIBLE_USER,
    );
    const input = {
      baseRevision: closed.revision,
      clientIdempotencyKey: "reopen-replay",
      confirmed: true as const,
      status: "In Progress" as const,
      workId: work.id,
    };

    const first = await workLifecycle.reopen("account-1", input, VISIBLE_USER);

    await expect(
      workLifecycle.reopen("account-1", input, VISIBLE_USER),
    ).resolves.toEqual(first);
  });

  test("shows a non-blocking Closure check and closes through Close anyway", async () => {
    const workLifecycle = createMemoryWorkLifecycle({
      closureContext: {
        activeBlockers: [{ id: "blocker-1", label: "PAY-9 blocks this Work" }],
        incompleteChecklistItems: [
          { id: "check-1", label: "Verify the migration" },
        ],
        lastingContextSources: [],
      },
    });
    const work = await workLifecycle.create(
      "account-1",
      createInput("closure-check-create"),
    );

    await expect(
      workLifecycle.previewClose("account-1", { workId: work.id }),
    ).resolves.toMatchObject({
      closureCheck: {
        activeBlockers: [{ id: "blocker-1" }],
        incompleteChecklistItems: [{ id: "check-1" }],
      },
    });
    await expect(
      workLifecycle.close(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: "closure-check-without-choice",
          closureResult: "Abandoned",
          workId: work.id,
        },
        VISIBLE_USER,
      ),
    ).rejects.toBeInstanceOf(WorkClosureCheckRequiredError);
    await expect(
      workLifecycle.close(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: "closure-check-close-anyway",
          closureCheck: "Close anyway",
          closureResult: "Abandoned",
          workId: work.id,
        },
        VISIBLE_USER,
      ),
    ).resolves.toMatchObject({
      closureResult: "Abandoned",
      status: "Closed",
    });
  });

  test("previews lasting context destinations without generating text or blocking close", async () => {
    const workLifecycle = createMemoryWorkLifecycle({
      closureContext: {
        activeBlockers: [],
        incompleteChecklistItems: [],
        lastingContextSources: [
          { id: "note-1", label: "Payment retry learning" },
        ],
      },
    });
    const work = await workLifecycle.create(
      "account-1",
      createInput("lasting-context-create"),
    );

    await expect(
      workLifecycle.previewClose("account-1", { workId: work.id }),
    ).resolves.toMatchObject({
      lastingContext: {
        commands: [
          { generatedText: null, target: "Decision" },
          { generatedText: null, target: "Personal Wiki" },
        ],
        sources: [{ id: "note-1" }],
      },
    });
    await expect(
      workLifecycle.close(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: "lasting-context-close",
          closureResult: "Completed",
          workId: work.id,
        },
        VISIBLE_USER,
      ),
    ).resolves.toMatchObject({ status: "Closed" });
  });
});
