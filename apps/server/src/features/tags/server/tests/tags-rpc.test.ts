import type { Context } from "@cantiara/api/context";
import type { MutationReceipt } from "@cantiara/api/mutation-and-undo";
import { appRouter } from "@cantiara/api/routers/index";
import type {
  Tag,
  TagAssignment,
  TagMutationContract,
  TagMutationContracts,
  TagMutationValue,
  TagRecord,
  TagsAccess,
} from "@cantiara/api/tags";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const tag: Tag = {
  createdAt: "2026-09-20T09:00:00.000Z",
  id: "tag-1",
  name: "roadmap/next",
  revision: 0,
  updatedAt: "2026-09-20T09:00:00.000Z",
};

const assignment: TagAssignment = {
  createdAt: "2026-09-20T09:00:00.000Z",
  id: "assignment-1",
  recordId: "work-1",
  recordType: "Work",
  tagId: tag.id,
};

const record: TagRecord = {
  archivedAt: null,
  id: "work-1",
  key: "PAY-1",
  projectId: "project-1",
  recordType: "Work",
  tags: [tag],
  title: "Prepare launch",
};

function createContext(
  tags: TagsAccess,
  tagMutationContracts: TagMutationContracts,
): Context {
  return {
    accountAccess: {
      listSessions: async () => [],
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    },
    accountPreferences: {
      get: () => Promise.reject(new Error("Not part of this test.")),
    },
    auth: null,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
    tagMutationContracts,
    tags,
  };
}

function createAccess(): TagsAccess {
  return {
    apply: () => Promise.resolve(assignment),
    create: () => Promise.resolve(tag),
    list: () => Promise.resolve([{ projectUsageCount: 1, tag }]),
    records: () => Promise.resolve([record]),
    remove: () => Promise.resolve({ status: true as const }),
    rename: () => Promise.resolve(tag),
  };
}

function createMutationContracts(
  mutate?: TagMutationContract["mutate"],
  onMutate?: (options: Parameters<TagMutationContract["mutate"]>[2]) => void,
  overrides: Partial<TagMutationContract> = {},
): TagMutationContracts {
  const receipts = new Map<string, MutationReceipt<TagMutationValue>>();
  const defaultMutate: TagMutationContract["mutate"] = async (
    command,
    apply,
    options,
  ) => {
    const idempotencyKey =
      command.kind === "human" ? command.clientIdempotencyKey : "test-key";
    const existing = receipts.get(idempotencyKey);
    if (existing) {
      return existing;
    }
    onMutate?.(options);
    const previousValue = { tag };
    const nextValue = await apply({
      committedAt: "2026-09-20T09:00:00.000Z",
      currentRevision: tag.revision,
      currentValue: previousValue,
      payload: command.payload,
    });
    const receipt = {
      actor: command.actor,
      committedAt: "2026-09-20T09:00:00.000Z",
      id: "receipt-1",
      nextValue,
      origin: {
        clientIdempotencyKey:
          command.kind === "human" ? command.clientIdempotencyKey : "test-key",
        kind: "human" as const,
      },
      payloadFingerprint: "0".repeat(64),
      previousValue,
      revision: tag.revision + 1,
      targetId: command.targetId,
    } satisfies MutationReceipt<TagMutationValue>;
    receipts.set(idempotencyKey, receipt);
    return receipt;
  };

  return {
    rename: () => ({
      ...overrides,
      mutate: mutate ?? defaultMutate,
      replay: async () => null,
    }),
  };
}

describe("Tags RPC", () => {
  test("exposes the Tags seam for create, apply, filter, and remove", async () => {
    const onMutate = vi.fn();
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(),
        createMutationContracts(undefined, onMutate),
      ),
    });

    await expect(client.createTag({ name: tag.name })).resolves.toEqual(tag);
    await expect(client.tags({ projectId: "project-1" })).resolves.toEqual([
      { projectUsageCount: 1, tag },
    ]);
    await expect(
      client.applyTag({
        projectId: "project-1",
        recordId: "work-1",
        recordType: "Work",
        tagId: tag.id,
      }),
    ).resolves.toEqual(assignment);
    await expect(
      client.tagRecords({ projectId: "project-1", tagId: tag.id }),
    ).resolves.toEqual([record]);
    await expect(
      client.removeTag({
        projectId: "project-1",
        recordId: "work-1",
        recordType: "Work",
        tagId: tag.id,
      }),
    ).resolves.toEqual({ status: true });
    await expect(
      client.renameTag({
        baseRevision: 0,
        clientIdempotencyKey: "rename-1",
        name: "launch/next",
        tagId: tag.id,
      }),
    ).resolves.toMatchObject({
      receiptId: "receipt-1",
      tag: {
        id: tag.id,
        name: "launch/next",
        revision: 1,
      },
    });
    expect(onMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        undo: { kind: "atomic-transform", scope: "tag.name" },
      }),
    );
  });

  test("maps a Workspace name conflict to the public conflict error", async () => {
    const access: TagsAccess = {
      ...createAccess(),
      create: () =>
        Promise.reject(
          Object.assign(new Error("Duplicate Tag"), {
            code: "TAG_NAME_CONFLICT",
          }),
        ),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access, createMutationContracts()),
    });

    await expect(client.createTag({ name: tag.name })).rejects.toThrow(
      "Duplicate Tag",
    );
  });

  test("maps a missing Workspace to the public not-found error", async () => {
    const access: TagsAccess = {
      ...createAccess(),
      create: () =>
        Promise.reject(
          Object.assign(new Error("Missing Workspace"), {
            code: "TAG_WORKSPACE_NOT_FOUND",
          }),
        ),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access, createMutationContracts()),
    });

    await expect(client.createTag({ name: tag.name })).rejects.toThrow(
      "Workspace is unavailable.",
    );
  });

  test("maps a stale rename revision to the public precondition error", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(),
        createMutationContracts(() =>
          Promise.reject(
            Object.assign(new Error("Stale Tag"), {
              code: "STALE_BASE_REVISION",
              currentRevision: 1,
            }),
          ),
        ),
      ),
    });

    await expect(
      client.renameTag({
        baseRevision: 0,
        clientIdempotencyKey: "rename-stale",
        name: "launch/next",
        tagId: tag.id,
      }),
    ).rejects.toThrow("Current value");
  });

  test("replays a rename receipt for an idempotent retry", async () => {
    const onMutate = vi.fn();
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(),
        createMutationContracts(undefined, onMutate),
      ),
    });
    const command = {
      baseRevision: 0,
      clientIdempotencyKey: "rename-retry",
      name: "launch/next",
      tagId: tag.id,
    };

    const first = await client.renameTag(command);
    const retry = await client.renameTag({ ...command, baseRevision: 99 });

    expect(retry).toEqual(first);
    expect(onMutate).toHaveBeenCalledTimes(1);
  });

  test("undoes a rename through the receipt-backed mutation seam", async () => {
    const renamedTag = {
      ...tag,
      name: "launch/next",
      revision: 1,
      updatedAt: "2026-09-20T09:01:00.000Z",
    };
    const sourceReceipt = {
      actor: { actorId: "account-1", type: "User" as const },
      committedAt: "2026-09-20T09:01:00.000Z",
      id: "receipt-1",
      nextValue: { tag: renamedTag },
      origin: {
        clientIdempotencyKey: "rename-1",
        kind: "human" as const,
      },
      payloadFingerprint: "0".repeat(64),
      previousValue: { tag },
      revision: 1,
      targetId: tag.id,
      undo: {
        after: "launch/next",
        afterPresent: true,
        before: "roadmap/next",
        beforePresent: true,
        kind: "atomic-transform" as const,
        scope: "tag.name",
      },
    } satisfies MutationReceipt<TagMutationValue>;
    const findReceiptById = vi.fn(async () => sourceReceipt);
    const undo = vi.fn(async () => ({
      ...sourceReceipt,
      id: "undo-receipt-1",
      nextValue: { tag: { ...tag, revision: 2 } },
      previousValue: { tag: renamedTag },
      revision: 2,
      undoOf: sourceReceipt.id,
    }));
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(),
        createMutationContracts(undefined, undefined, {
          findReceiptById,
          undo,
        }),
      ),
    });

    await expect(
      client.undoTagRename({
        baseRevision: 1,
        clientIdempotencyKey: "undo-rename-1",
        receiptId: sourceReceipt.id,
        tagId: tag.id,
      }),
    ).resolves.toMatchObject({
      id: tag.id,
      name: "roadmap/next",
      revision: 2,
    });
    expect(findReceiptById).toHaveBeenCalledWith(sourceReceipt.id);
    expect(undo).toHaveBeenCalledWith(
      sourceReceipt,
      expect.objectContaining({
        baseRevision: 1,
        clientIdempotencyKey: "undo-rename-1",
        targetId: tag.id,
      }),
      expect.any(Function),
    );
  });

  test("maps a same-field rename Undo conflict to the public conflict error", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(),
        createMutationContracts(undefined, undefined, {
          findReceiptById: async () => ({
            actor: { actorId: "account-1", type: "User" as const },
            committedAt: "2026-09-20T09:01:00.000Z",
            id: "receipt-1",
            nextValue: { tag: { ...tag, name: "launch/next", revision: 1 } },
            origin: {
              clientIdempotencyKey: "rename-1",
              kind: "human" as const,
            },
            payloadFingerprint: "0".repeat(64),
            previousValue: { tag },
            revision: 1,
            targetId: tag.id,
            undo: {
              after: "launch/next",
              afterPresent: true,
              before: "roadmap/next",
              beforePresent: true,
              kind: "atomic-transform" as const,
              scope: "tag.name",
            },
          }),
          undo: async () =>
            Promise.reject(
              Object.assign(new Error("Conflict"), { code: "CONFLICT" }),
            ),
        }),
      ),
    });

    await expect(
      client.undoTagRename({
        baseRevision: 1,
        clientIdempotencyKey: "undo-conflict",
        receiptId: "receipt-1",
        tagId: tag.id,
      }),
    ).rejects.toThrow("Conflict");
  });
});
