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
  type WorkRecreateRelation,
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
    recreateRelations?: WorkRecreateRelation[];
  } = {},
) {
  const works = new Map<string, WorkProfile>();
  const reservations = new Map<string, WorkCreationReservation>();
  const copiedRelations = new Map<string, WorkRecreateRelation[]>();
  const {
    commitThenFailWithTitle: configuredCommitThenFailWithTitle,
    failNextCommit: configuredFailNextCommit,
  } = options;
  const nextNumberByProject = new Map<string, number>();
  let commitThenFailWithTitle = configuredCommitThenFailWithTitle;
  let failNextCommit = configuredFailNextCommit ?? false;

  const store: WorkLifecycleStore = {
    find: async (_accountId, workId) => works.get(workId) ?? null,
    findProject: (_accountId, projectId) => {
      const projects = new Map([
        [PROJECT_ID, "Cantiara"],
        ["project-2", "Second Project"],
        ["project-3", "Third Project"],
      ]);
      const name = projects.get(projectId);
      return Promise.resolve(name ? { id: projectId, name } : null);
    },
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
    listRecreateRelations: async (_accountId, workId) =>
      copiedRelations.get(workId) ?? options.recreateRelations ?? [],
    reserveCreate: (_accountId, projectId, key, payloadFingerprint) => {
      const reservationKey = `${projectId}:${key}`;
      const existing = reservations.get(reservationKey);
      if (existing) {
        if (existing.payloadFingerprint !== payloadFingerprint) {
          return Promise.reject(new WorkCreationConflictError());
        }
        return Promise.resolve(existing);
      }

      const number = nextNumberByProject.get(projectId) ?? 1;
      nextNumberByProject.set(projectId, number + 1);
      const shortCodes = new Map([
        [PROJECT_ID, "CANT"],
        ["project-2", "SECOND"],
        ["project-3", "THIRD"],
      ]);
      const shortCode = shortCodes.get(projectId) ?? "WORK";
      const reservation: WorkCreationReservation = {
        id: `${projectId}-work-${number}`,
        key: `${shortCode}-${number}`,
        number,
        payloadFingerprint,
        projectId,
        shortCode,
        workId: `${projectId}-work-${number}`,
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
          if (nextValue.recreate) {
            copiedRelations.set(nextValue.work.id, [
              ...(options.recreateRelations ?? []).filter((relation) =>
                nextValue.recreate?.selectedRelationIds.includes(relation.id),
              ),
              {
                id: `origin-${nextValue.work.id}`,
                kind: "Origin",
                label: "Origin",
                nonPortableReason: "Origin stays with the recreated Work.",
                portable: false,
                targetLabel: sourceWorkLabel(
                  works.get(nextValue.recreate.sourceWorkId),
                ),
                targetProjectName: "Cantiara",
              },
            ]);
          }
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

function sourceWorkLabel(sourceWork: WorkProfile | undefined) {
  return sourceWork?.key ?? "Unavailable Work";
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
  test("recreates selected portable content with a new identity and target key while the source stays unchanged", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const source = await workLifecycle.create(
      "account-1",
      createInput("recreate-source", {
        description: "Keep this context",
        checklist: [
          { completed: true, id: "item-1", text: "Confirm the problem" },
        ],
        type: "Bug",
      }),
    );
    const sourceBefore = await workLifecycle.find("account-1", source.id);

    const preview = await workLifecycle.previewRecreate("account-1", {
      sourceWorkId: source.id,
      targetProjectId: "project-2",
    });
    expect(preview).toMatchObject({
      sourceWork: { id: source.id, key: "CANT-1" },
      targetProject: { id: "project-2", name: "Second Project" },
    });
    expect(preview?.fields).toEqual([
      {
        key: "title",
        label: "Title",
        selectedByDefault: true,
        value: "Ship the first Work",
      },
      {
        key: "type",
        label: "Type",
        selectedByDefault: true,
        value: "Bug",
      },
      {
        key: "description",
        label: "Description",
        selectedByDefault: true,
        value: "Keep this context",
      },
      {
        key: "checklist",
        label: "Checklist",
        selectedByDefault: true,
        value: [{ completed: true, id: "item-1", text: "Confirm the problem" }],
      },
    ]);
    if (!preview) {
      throw new Error("Expected a recreate preview.");
    }

    const recreated = await workLifecycle.recreate("account-1", {
      baseRevision: 0,
      clientIdempotencyKey: "recreate-confirm",
      previewId: preview.previewId,
      selectedFields: ["title", "type", "description", "checklist"],
      selectedRelationIds: [],
      sourceWorkId: source.id,
      targetProjectId: "project-2",
    });

    expect(recreated).toMatchObject({
      checklist: source.checklist,
      closureResult: null,
      description: source.description,
      key: "SECOND-1",
      projectId: "project-2",
      recreatedFrom: { id: source.id, key: source.key },
      status: "Not Started",
      title: source.title,
      type: source.type,
    });
    expect(recreated.id).not.toBe(source.id);
    expect(recreated.key).not.toBe(source.key);
    await expect(workLifecycle.find("account-1", source.id)).resolves.toEqual(
      sourceBefore,
    );
  });

  test("shows every relation and refuses a non-portable relation selection", async () => {
    const workLifecycle = createMemoryWorkLifecycle({
      recreateRelations: [
        {
          id: "relation-related",
          kind: "Related",
          label: "Related",
          portable: true,
          targetLabel: "Decision DEC-1",
          targetProjectName: "Third Project",
        },
        {
          id: "relation-github",
          kind: "GitHub Completion",
          label: "Required for completion",
          nonPortableReason: "GitHub completion links do not travel.",
          portable: false,
          targetLabel: "Pull request #42",
          targetProjectName: "Cantiara",
        },
      ],
    });
    const source = await workLifecycle.create(
      "account-1",
      createInput("relation-source"),
    );
    const preview = await workLifecycle.previewRecreate("account-1", {
      sourceWorkId: source.id,
      targetProjectId: "project-2",
    });
    expect(preview?.relations).toHaveLength(2);
    expect(preview?.relations[1]).toMatchObject({
      id: "relation-github",
      portable: false,
    });
    if (!preview) {
      throw new Error("Expected a recreate preview.");
    }

    await expect(
      workLifecycle.recreate("account-1", {
        baseRevision: 0,
        clientIdempotencyKey: "recreate-non-portable",
        previewId: preview.previewId,
        selectedFields: ["title", "type"],
        selectedRelationIds: ["relation-github"],
        sourceWorkId: source.id,
        targetProjectId: "project-2",
      }),
    ).rejects.toMatchObject({ code: "WORK_RELATION_NOT_PORTABLE" });

    await expect(
      workLifecycle.list("account-1", "project-2"),
    ).resolves.toHaveLength(0);

    const recreated = await workLifecycle.recreate("account-1", {
      baseRevision: 0,
      clientIdempotencyKey: "recreate-portable",
      previewId: preview.previewId,
      selectedFields: ["title", "type"],
      selectedRelationIds: ["relation-related"],
      sourceWorkId: source.id,
      targetProjectId: "project-2",
    });
    await expect(
      workLifecycle.previewRecreate("account-1", {
        sourceWorkId: recreated.id,
        targetProjectId: "project-3",
      }),
    ).resolves.toMatchObject({
      relations: expect.arrayContaining([
        expect.objectContaining({ id: "relation-related", portable: true }),
        expect.objectContaining({ kind: "Origin", portable: false }),
      ]),
    });
  });

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
});
