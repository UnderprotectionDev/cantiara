import type { Context } from "@cantiara/api/context";
import type {
  Document,
  DocumentMutationContracts,
  DocumentMutationValue,
  DocumentsAccess,
  DocumentVersionSummary,
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

const initialDocumentVersionSummary: DocumentVersionSummary = {
  createdAt: initialDocument.createdAt,
  id: initialDocument.id,
  revision: initialDocument.revision,
  title: initialDocument.title,
  type: initialDocument.type,
  updatedAt: initialDocument.updatedAt,
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
    getLiveWork: vi.fn().mockResolvedValue(null),
    getVersion: vi
      .fn()
      .mockImplementation(
        async (_accountId: string, documentId: string, revision: number) =>
          documentId === initialDocument.id &&
          revision === initialDocument.revision
            ? initialDocument
            : null,
      ),
    list: vi.fn().mockResolvedValue([initialDocument]),
    versions: vi.fn().mockResolvedValue([initialDocumentVersionSummary]),
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

describe("Personal Wiki ownership boundary", () => {
  test("Wiki evidence cannot use an unavailable target as Wiki ownership", async () => {
    const documents = createDocumentsAccess();
    vi.mocked(documents.get).mockImplementation(
      async (_accountId, documentId) =>
        documentId === "private-wiki"
          ? {
              ...initialDocument,
              id: "private-wiki",
              projectId: null,
              body: "Private knowledge",
            }
          : null,
    );
    const client = createRouterClient(appRouter, {
      context: createContext(documents, {
        create: () => createMutationContract(null).contract,
        update: () => createMutationContract(initialDocument).contract,
      }),
    });
    await expect(
      client.pinDocumentEvidence({
        documentId: "private-wiki",
        documentRevision: 1,
        selectionStart: 0,
        selectionEnd: 7,
        selectedText: "Private",
        targetRecordId: "unavailable-document",
        targetRecordType: "Document",
        baseRevision: 0,
        clientIdempotencyKey: "wiki-evidence",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  test("Personal Wiki creates a Document without a Project through the same commands", async () => {
    const documents = createDocumentsAccess();
    const mutation = createMutationContract(null);
    const client = createRouterClient(appRouter, {
      context: createContext(documents, {
        create: () => mutation.contract,
        update: () => createMutationContract(initialDocument).contract,
      }),
    });
    const created = await client.createDocument({
      projectId: null,
      title: "PostgreSQL troubleshooting",
      body: "# Connection recovery",
      type: "General",
      baseRevision: 0,
      clientIdempotencyKey: "wiki-create",
    });
    expect(created).toMatchObject({ projectId: null, type: "General" });
    expect(created).not.toHaveProperty("visitorUrl");
    expect(created).not.toHaveProperty("publicSlug");
    await client.documents({ projectId: null });
    expect(documents.list).toHaveBeenCalledWith("account-1", null, undefined);
  });
  test("rejects a second Wiki Document type", async () => {
    const mutation = createMutationContract(null);
    const client = createRouterClient(appRouter, {
      context: createContext(createDocumentsAccess(), {
        create: () => mutation.contract,
        update: () => mutation.contract,
      }),
    });
    const input = {
      projectId: null,
      title: "Personal knowledge",
      body: "Private text",
      type: initialDocument.type,
      baseRevision: 0,
      clientIdempotencyKey: "wiki-type",
    };
    Reflect.set(input, "type", "Wiki");
    await expect(client.createDocument(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mutation.commands).toHaveLength(0);
  });
  test("unauthenticated reads never reach live Wiki content", async () => {
    const documents = createDocumentsAccess();
    const context = createContext(documents, {
      create: () => createMutationContract(null).contract,
      update: () => createMutationContract(initialDocument).contract,
    });
    context.session = null;
    const client = createRouterClient(appRouter, { context });
    await expect(client.documents({ projectId: null })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      client.document({ documentId: "private-wiki" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(documents.list).not.toHaveBeenCalled();
    expect(documents.get).not.toHaveBeenCalled();
  });
});

describe("Documents RPC", () => {
  test("creates Persona with only its contracted empty headings", async () => {
    const context = createContext(createDocumentsAccess(), {
      create: () => createMutationContract(null).contract,
      update: () => createMutationContract(initialDocument).contract,
    });
    const client = createRouterClient(appRouter, { context });

    expect(
      await client.createDocument({
        baseRevision: 0,
        clientIdempotencyKey: "create-persona",
        projectId: "project-1",
        skeleton: "Persona",
      }),
    ).toMatchObject({
      body: "## Context\n\n## Goals\n\n## Behaviors\n\n## Pain Points\n\n## Constraints\n\n## Evidence\n\n## Open Questions",
      projectId: "project-1",
      revision: 1,
      title: "Persona",
      type: "Persona",
    });
  });

  test.each([
    {
      body: "## Period\n\n## What worked?\n\n## What did not?\n\n## What did we learn?\n\n## Decisions\n\n## Next changes\n\n## Related records",
      skeleton: "Retrospective" as const,
      type: "General",
    },
    {
      body: "## Release\n\n## Audience\n\n## Scope\n\n## Readiness\n\n## Communication\n\n## Launch steps\n\n## Risks\n\n## Observation plan\n\n## Related records",
      skeleton: "Launch Plan" as const,
      type: "Plan",
    },
  ])(
    "creates $skeleton with only its contracted empty headings",
    async ({ body, skeleton, type }) => {
      const context = createContext(createDocumentsAccess(), {
        create: () => createMutationContract(null).contract,
        update: () => createMutationContract(initialDocument).contract,
      });
      const client = createRouterClient(appRouter, { context });

      expect(
        await client.createDocument({
          baseRevision: 0,
          clientIdempotencyKey: `create-${skeleton}`,
          projectId: "project-1",
          skeleton,
        }),
      ).toMatchObject({
        body,
        projectId: "project-1",
        revision: 1,
        title: skeleton,
        type,
      });
    },
  );

  test("archives a Document without changing identity, content, scope, or child links", async () => {
    const record = {
      ...initialDocument,
      parentDocumentId: "parent-1",
      folder: "Planning",
    };
    const mutation = createMutationContract(record);
    const client = createRouterClient(appRouter, {
      context: createContext(createDocumentsAccess(), {
        create: () => createMutationContract(null).contract,
        update: () => mutation.contract,
        organize: () => mutation.contract,
      }),
    });
    const archived = await client.organizeDocument({
      action: "archive",
      archived: true,
      documentId: record.id,
      baseRevision: 1,
      clientIdempotencyKey: "archive-document-1",
    });
    expect(archived).toMatchObject({
      id: record.id,
      projectId: record.projectId,
      body: record.body,
      parentDocumentId: "parent-1",
      folder: "Planning",
      archivedAt: "2026-09-29T12:01:00.000Z",
    });
  });
  test("passes the Archive filter to the Documents seam", async () => {
    const documents = createDocumentsAccess();
    const client = createRouterClient(appRouter, {
      context: createContext(documents, {
        create: () => createMutationContract(null).contract,
        update: () => createMutationContract(initialDocument).contract,
      }),
    });
    await client.documents({ projectId: "project-1", archived: true });
    expect(documents.list).toHaveBeenCalledWith("account-1", "project-1", true);
  });
  test("resolves a live Work block from its current source and hides an unavailable target", async () => {
    const documents = createDocumentsAccess();
    vi.mocked(documents.get).mockResolvedValue({
      ...initialDocument,
      body: ':::live-work{workId="work-1"}\n:::live-work{workId="missing"}\n```text\n```not-a-closing-fence\n:::live-work{workId="example-only"}\n```',
    });
    const find = vi.fn(async (_accountId: string, id: string) =>
      id === "work-1"
        ? {
            id,
            projectId: "project-1",
            key: "PRO-1",
            title: "Current title",
            type: "Task",
            status: "In Progress",
            plannedStartDate: null,
            priority: [{ name: "Impact", rank: "High" }],
            targetDate: null,
          }
        : null,
    );
    documents.getLiveWork = find;
    const context = createContext(documents, {
      create: () => createMutationContract(null).contract,
      update: () => createMutationContract(initialDocument).contract,
    });
    const client = createRouterClient(appRouter, { context });

    expect(
      await client.documentLiveWorkBlocks({ documentId: "document-1" }),
    ).toEqual([
      {
        workId: "work-1",
        source: {
          id: "work-1",
          projectId: "project-1",
          key: "PRO-1",
          title: "Current title",
          type: "Task",
          status: "In Progress",
          plannedStartDate: null,
          priority: [{ name: "Impact", rank: "High" }],
          targetDate: null,
        },
      },
      { workId: "missing", source: null },
    ]);
    expect(find).toHaveBeenCalledWith("account-1", "work-1");
  });
  test("resolves a preview body while checking access to the saved Document", async () => {
    const documents = createDocumentsAccess();
    const client = createRouterClient(appRouter, {
      context: createContext(documents, {
        create: () => createMutationContract(null).contract,
        update: () => createMutationContract(initialDocument).contract,
      }),
    });

    expect(
      await client.documentLiveWorkBlocks({
        documentId: "document-1",
        body: ':::live-work{workId="draft-work"}',
      }),
    ).toEqual([{ workId: "draft-work", source: null }]);
    expect(documents.getLiveWork).toHaveBeenCalledWith(
      "account-1",
      "draft-work",
    );

    vi.mocked(documents.get).mockResolvedValue(null);
    await expect(
      client.documentLiveWorkBlocks({
        documentId: "document-1",
        body: ':::live-work{workId="draft-work"}',
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  test("lists product versions and restores the selected body as a new revision", async () => {
    const documents = createDocumentsAccess();
    const update = createMutationContract(initialDocument);
    const client = createRouterClient(appRouter, {
      context: createContext(documents, {
        create: () => createMutationContract(null).contract,
        update: () => update.contract,
      }),
    });

    expect(
      await client.documentVersion({
        documentId: initialDocument.id,
        revision: initialDocument.revision,
      }),
    ).toEqual(initialDocument);
    await expect(
      client.documentVersion({
        documentId: initialDocument.id,
        revision: 99,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      await client.documentVersions({ documentId: initialDocument.id }),
    ).toEqual([initialDocumentVersionSummary]);
    expect(documents.getVersion).toHaveBeenCalledWith(
      "account-1",
      initialDocument.id,
      initialDocument.revision,
    );
    const restored = await client.restoreDocumentVersion({
      baseRevision: initialDocument.revision,
      clientIdempotencyKey: "restore-document-1",
      documentId: initialDocument.id,
      revision: 1,
    });
    expect(restored).toMatchObject({ body: initialDocument.body, revision: 2 });
    expect(update.commands[0]).toMatchObject({
      baseRevision: 1,
      payload: { body: initialDocument.body, documentId: initialDocument.id },
      targetId: initialDocument.id,
    });
    expect(documents.getVersion).toHaveBeenLastCalledWith(
      "account-1",
      initialDocument.id,
      initialDocument.revision,
    );
    await expect(
      client.restoreDocumentVersion({
        baseRevision: 1,
        clientIdempotencyKey: "restore-missing",
        documentId: initialDocument.id,
        revision: 99,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
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
