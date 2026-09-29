import type { Context } from "@cantiara/api/context";
import type {
  Document,
  DocumentMutationContracts,
  DocumentMutationValue,
  DocumentsAccess,
} from "@cantiara/api/documents";
import type {
  MutationApply,
  MutationCommand,
  MutationContract,
  MutationPayload,
  MutationReceipt,
} from "@cantiara/api/mutation-and-undo";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const initialDocument: Document = {
  body: "# Architecture",
  createdAt: "2026-09-29T12:00:00.000Z",
  id: "document-1",
  projectId: "project-1",
  revision: 1,
  title: "Architecture",
  type: "Spec",
  updatedAt: "2026-09-29T12:00:00.000Z",
};

function createContext(
  documents: DocumentsAccess,
  documentMutationContracts: DocumentMutationContracts,
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
    documentMutationContracts,
    documents,
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
  };
}

function createDocumentsAccess(): DocumentsAccess {
  return {
    get: vi.fn().mockResolvedValue(initialDocument),
    list: vi.fn().mockResolvedValue([initialDocument]),
  };
}

function createMutationContract(currentDocument: Document | null) {
  const commands: MutationCommand[] = [];
  const contract: MutationContract<DocumentMutationValue> = {
    mutate: async <TPayload extends MutationPayload>(
      command: MutationCommand<TPayload>,
      apply: MutationApply<DocumentMutationValue, TPayload>,
    ) => {
      commands.push(command);
      const previousValue = { document: currentDocument };
      const committedAt = "2026-09-29T12:01:00.000Z";
      const nextValue = await apply({
        committedAt,
        currentRevision: currentDocument?.revision ?? 0,
        currentValue: previousValue,
        payload: command.payload,
      });
      const receipt: MutationReceipt<DocumentMutationValue> = {
        actor: command.actor,
        committedAt,
        id: "receipt-1",
        nextValue,
        origin:
          command.kind === "human"
            ? {
                clientIdempotencyKey: command.clientIdempotencyKey,
                kind: "human",
              }
            : {
                deliveryId: command.source.deliveryId,
                kind: "source",
                sourceId: command.source.sourceId,
              },
        payloadFingerprint: "0".repeat(64),
        previousValue,
        revision: (currentDocument?.revision ?? 0) + 1,
        targetId: command.targetId,
      };
      return receipt;
    },
    replay: async () => null,
  };
  return { commands, contract };
}

function createFailingMutationContract(error: unknown) {
  const contract: MutationContract<DocumentMutationValue> = {
    mutate: () => Promise.reject(error),
    replay: async () => null,
  };
  return contract;
}

describe("Documents RPC", () => {
  test("routes create through the idempotent mutation contract", async () => {
    const documents = createDocumentsAccess();
    const creation = createMutationContract(null);
    const client = createRouterClient(appRouter, {
      context: createContext(documents, {
        create: () => creation.contract,
        update: () => createMutationContract(initialDocument).contract,
      }),
    });

    const created = await client.createDocument({
      baseRevision: 0,
      body: initialDocument.body,
      clientIdempotencyKey: "create-document-1",
      projectId: initialDocument.projectId,
      title: initialDocument.title,
      type: initialDocument.type,
    });

    expect(created).toMatchObject({
      body: initialDocument.body,
      projectId: initialDocument.projectId,
      revision: 1,
      title: initialDocument.title,
      type: initialDocument.type,
    });
    expect(creation.commands[0]).toMatchObject({
      baseRevision: 0,
      clientIdempotencyKey: "create-document-1",
      kind: "human",
      payload: {
        body: initialDocument.body,
        projectId: initialDocument.projectId,
      },
      targetId: "create-document-1",
    });
    expect(documents.get).not.toHaveBeenCalled();
  });

  test("routes updates through the idempotent mutation contract", async () => {
    const documents = createDocumentsAccess();
    const update = createMutationContract(initialDocument);
    const client = createRouterClient(appRouter, {
      context: createContext(documents, {
        create: () => createMutationContract(null).contract,
        update: () => update.contract,
      }),
    });

    const saved = await client.updateDocument({
      baseRevision: initialDocument.revision,
      body: "# Updated architecture",
      clientIdempotencyKey: "update-document-1",
      documentId: initialDocument.id,
    });

    expect(saved).toMatchObject({
      body: "# Updated architecture",
      id: initialDocument.id,
      revision: 2,
    });
    expect(update.commands[0]).toMatchObject({
      baseRevision: initialDocument.revision,
      clientIdempotencyKey: "update-document-1",
      kind: "human",
      payload: {
        body: "# Updated architecture",
        documentId: initialDocument.id,
      },
      targetId: initialDocument.id,
    });
    expect(documents.get).not.toHaveBeenCalled();
  });

  test("maps a stale base revision to a precondition failure", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(createDocumentsAccess(), {
        create: () => createMutationContract(null).contract,
        update: () =>
          createFailingMutationContract({
            code: "STALE_BASE_REVISION",
            currentRevision: 2,
            currentValue: { document: initialDocument },
          }),
      }),
    });

    await expect(
      client.updateDocument({
        baseRevision: 1,
        body: "stale update",
        clientIdempotencyKey: "update-document-stale",
        documentId: initialDocument.id,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: { code: "STALE_BASE_REVISION", currentRevision: 2 },
    });
  });

  test("maps a reused idempotency key with a changed payload to conflict", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(createDocumentsAccess(), {
        create: () => createFailingMutationContract({ code: "CONFLICT" }),
        update: () => createMutationContract(initialDocument).contract,
      }),
    });

    await expect(
      client.createDocument({
        baseRevision: 0,
        body: "different body",
        clientIdempotencyKey: "create-document-used",
        projectId: initialDocument.projectId,
        title: initialDocument.title,
        type: initialDocument.type,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      data: { code: "CONFLICT", targetId: "create-document-used" },
    });
  });
});
