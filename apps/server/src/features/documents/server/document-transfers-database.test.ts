import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
} from "@cantiara/db/schema/external-surface";
import { fileAttachment } from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import {
  diagramView,
  technicalDiagram,
} from "@cantiara/db/schema/technical-diagram";
import { work } from "@cantiara/db/schema/work";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseSmartCollections } from "../../smart-collections/server/smart-collections-database";
import type { DocumentSurfaceCancellation } from "./document-surface-cancellations";
import { createDatabaseDocumentTransfers } from "./document-transfers-database";
import {
  createDatabaseDocumentMutationContracts,
  createDatabaseDocuments,
} from "./documents-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
describeDatabase("Documents transfer database seam", () => {
  const database = createDb({ DATABASE_URL: databaseUrl ?? "" });
  const accountId = `transfer-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const sourceProjectId = `source-${crypto.randomUUID()}`;
  const targetProjectId = `target-${crypto.randomUUID()}`;
  const rootId = `document-${crypto.randomUUID()}`;
  const childId = `child-${crypto.randomUUID()}`;
  const access = createDatabaseDocuments(database);
  const cancellations = new Map<string, DocumentSurfaceCancellation>();
  const transfers = createDatabaseDocumentTransfers(database, access, {
    append: (event) => {
      cancellations.set(event.surfaceId, event);
      return Promise.resolve();
    },
    list: async () => [...cancellations.values()],
  });
  beforeEach(async () => {
    cancellations.clear();
    await database.insert(user).values({
      id: accountId,
      name: "Transfer tester",
      email: `${accountId}@example.invalid`,
    });
    await database
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await database.insert(project).values([
      {
        id: sourceProjectId,
        workspaceId,
        name: "Source",
        shortCode: "SRC",
        starterConfiguration: "Blank Project",
      },
      {
        id: targetProjectId,
        workspaceId,
        name: "Target",
        shortCode: "DST",
        starterConfiguration: "Blank Project",
      },
    ]);
    await database.insert(document).values({
      id: rootId,
      projectId: sourceProjectId,
      title: "Root",
      body: "# Root",
      revision: 1,
    });
    await database.insert(document).values({
      id: childId,
      projectId: sourceProjectId,
      title: "Child",
      body: "Child text",
      parentDocumentId: rootId,
      revision: 1,
    });
  });
  afterEach(async () => {
    await database.delete(user).where(eq(user.id, accountId));
  });

  async function apply(
    command: Parameters<typeof transfers.preview>[1],
    baseRevision = 1,
    key = crypto.randomUUID(),
  ) {
    const preview = await transfers.preview(accountId, command);
    return transfers.mutation(accountId).mutate(
      {
        actor: { actorId: accountId, type: "User" },
        kind: "human",
        clientIdempotencyKey: key,
        targetId: command.newDocumentId ?? command.documentId,
        baseRevision,
        payload: { ...command, previewFingerprint: preview.fingerprint },
      },
      ({ currentValue }) => ({
        ...currentValue,
        command: { ...command, previewFingerprint: preview.fingerprint },
      }),
    );
  }

  async function edit(documentId: string, body: string) {
    const current = await access.get(accountId, documentId);
    if (!current) {
      throw new Error("Document is unavailable.");
    }
    return createDatabaseDocumentMutationContracts(database)
      .update(accountId)
      .mutate(
        {
          actor: { actorId: accountId, type: "User" },
          kind: "human",
          clientIdempotencyKey: crypto.randomUUID(),
          targetId: documentId,
          baseRevision: current.revision,
          payload: { documentId, body },
        },
        () => ({ document: { ...current, body } }),
      );
  }

  it("copies the chosen historical version and keeps later edits independent", async () => {
    await edit(rootId, "New source text");
    const copyId = crypto.randomUUID();
    await apply(
      {
        action: "Copy",
        documentId: rootId,
        targetProjectId,
        childDocumentIds: [],
        sourceRevision: 1,
        newDocumentId: copyId,
      },
      0,
    );
    expect(await access.get(accountId, copyId)).toMatchObject({
      body: "# Root",
      origin: { documentId: rootId, revision: 1 },
    });
    await edit(copyId, "Independent copy text");
    expect(await access.get(accountId, rootId)).toMatchObject({
      body: "New source text",
      revision: 2,
    });
    expect(await access.get(accountId, copyId)).toMatchObject({
      body: "Independent copy text",
      revision: 2,
    });
  });

  it("assigns only same-scope File Attachments and carries them to Personal Wiki", async () => {
    await database.insert(fileAttachment).values([
      {
        id: "unowned",
        name: "Project file",
        workspaceId,
        projectId: sourceProjectId,
        scopeType: "Project",
      },
      {
        id: "foreign-scope",
        name: "Target file",
        workspaceId,
        projectId: targetProjectId,
        scopeType: "Project",
      },
    ]);
    const assign = {
      action: "Assign File Attachments" as const,
      documentId: rootId,
      targetProjectId: sourceProjectId,
      childDocumentIds: [],
      sourceRevision: 1,
      attachmentIds: ["unowned"],
    };
    await expect(
      apply({ ...assign, attachmentIds: ["foreign-scope"] }),
    ).rejects.toThrow();
    await apply(assign);
    const move = {
      action: "Move" as const,
      documentId: rootId,
      targetProjectId: null,
      childDocumentIds: [],
      sourceRevision: 2,
    };
    expect(
      (await transfers.preview(accountId, move)).attachments.map(
        (item) => item.name,
      ),
    ).toEqual(["Project file"]);
    await apply(move, 2);
    const [owned] = await database
      .select()
      .from(fileAttachment)
      .where(eq(fileAttachment.id, "unowned"));
    expect(owned).toMatchObject({
      ownerDocumentId: rootId,
      scopeType: "Personal Wiki",
      personalWikiId: accountId,
      revision: 2,
    });
    await expect(apply({ ...assign, documentId: childId })).rejects.toThrow();
  });

  it("blocks Move from an inactive Project without changing identity", async () => {
    await database
      .update(project)
      .set({ status: "Completed" })
      .where(eq(project.id, sourceProjectId));
    const move = {
      action: "Move" as const,
      documentId: rootId,
      targetProjectId,
      childDocumentIds: [],
      sourceRevision: 1,
    };
    expect(await transfers.preview(accountId, move)).toMatchObject({
      allowed: false,
      reason: "Move is available only from an Active Project.",
    });
    await expect(apply(move)).rejects.toThrow();
    expect(await access.get(accountId, rootId)).toMatchObject({
      projectId: sourceProjectId,
      revision: 1,
    });
  });

  it("moves an explicitly chosen grandchild without its parent and leaves Work scope unchanged", async () => {
    const grandchildId = crypto.randomUUID();
    const workId = crypto.randomUUID();
    await database.insert(document).values({
      id: grandchildId,
      projectId: sourceProjectId,
      parentDocumentId: childId,
      title: "Grandchild",
      body: "Archived content",
      archivedAt: new Date("2026-10-01T12:00:00.000Z"),
    });
    await database.insert(work).values({
      id: workId,
      key: "SRC-1",
      number: 1,
      projectId: sourceProjectId,
      title: "Work stays",
      type: "Task",
    });
    await edit(rootId, `:::live-work{workId="${workId}"}`);
    const move = {
      action: "Move" as const,
      documentId: rootId,
      targetProjectId,
      childDocumentIds: [grandchildId],
      sourceRevision: 2,
    };
    expect((await transfers.preview(accountId, move)).brokenReferences).toEqual(
      [],
    );
    await apply(move, 2);
    expect(await access.get(accountId, grandchildId)).toMatchObject({
      projectId: targetProjectId,
      parentDocumentId: null,
      archivedAt: "2026-10-01T12:00:00.000Z",
      body: "Archived content",
    });
    expect(await access.get(accountId, childId)).toMatchObject({
      projectId: sourceProjectId,
    });
    expect(await access.getLiveWork(accountId, workId)).toMatchObject({
      projectId: sourceProjectId,
      key: "SRC-1",
    });
    expect((await transfers.snapshot(accountId, rootId, 3)).markdown).toContain(
      "Snapshot — Work: SRC-1 Work stays",
    );
  });

  it("preserves move identity and detaches unselected children without moving unrelated attachments", async () => {
    await database.insert(fileAttachment).values([
      {
        id: "owned",
        name: "Owned",
        workspaceId,
        projectId: sourceProjectId,
        scopeType: "Project",
        ownerDocumentId: rootId,
      },
      {
        id: "other",
        name: "Other",
        workspaceId,
        projectId: sourceProjectId,
        scopeType: "Project",
        ownerDocumentId: childId,
      },
    ]);
    const command = {
      action: "Move" as const,
      documentId: rootId,
      targetProjectId,
      childDocumentIds: [],
      sourceRevision: 1,
    };
    const preview = await transfers.preview(accountId, command);
    expect(preview.attachments.map((item) => item.id)).toEqual(["owned"]);
    const receipt = await apply(command);
    expect(receipt.nextValue.document).toMatchObject({
      id: rootId,
      projectId: targetProjectId,
    });
    expect(await access.get(accountId, childId)).toMatchObject({
      projectId: sourceProjectId,
      parentDocumentId: null,
    });
    expect(
      (
        await database
          .select()
          .from(fileAttachment)
          .where(eq(fileAttachment.id, "other"))
      )[0]?.projectId,
    ).toBe(sourceProjectId);
  });

  it("requires explicit surface cancellation and preserves its original scope and snapshot chain", async () => {
    await database.insert(externalSurface).values({
      id: "surface",
      workspaceId,
      projectId: sourceProjectId,
      documentId: rootId,
    });
    await database.insert(externalSurfaceSnapshotRevision).values({
      id: "snapshot",
      surfaceId: "surface",
      revision: 1,
      snapshot: { body: "Original public text" },
    });
    const command = {
      action: "Move" as const,
      documentId: rootId,
      targetProjectId,
      childDocumentIds: [childId],
      sourceRevision: 1,
    };
    expect((await transfers.preview(accountId, command)).allowed).toBe(false);
    await expect(apply(command)).rejects.toThrow();
    await apply({ ...command, action: "Cancel External Surface" });
    await database
      .update(externalSurface)
      .set({ cancelledAt: null })
      .where(eq(externalSurface.id, "surface"));
    await transfers.replayCancellations();
    expect(
      (await transfers.preview(accountId, { ...command, sourceRevision: 2 }))
        .externalSurfaceIds,
    ).toEqual([]);
    await apply({ ...command, sourceRevision: 2 }, 2);
    const [surface] = await database
      .select()
      .from(externalSurface)
      .where(eq(externalSurface.id, "surface"));
    expect(surface).toMatchObject({ projectId: sourceProjectId });
    expect(surface?.cancelledAt).toBeInstanceOf(Date);
    expect(
      await database.select().from(externalSurfaceSnapshotRevision),
    ).toHaveLength(1);
  });

  it("copies a selected Version into a new independent identity and rejects foreign access", async () => {
    const newDocumentId = `copy-${crypto.randomUUID()}`;
    const command = {
      action: "Copy" as const,
      documentId: rootId,
      targetProjectId: null,
      childDocumentIds: [],
      sourceRevision: 1,
      newDocumentId,
    };
    const receipt = await apply(command, 0);
    expect(receipt.nextValue.document).toMatchObject({
      id: newDocumentId,
      projectId: null,
      revision: 1,
      origin: { documentId: rootId, revision: 1 },
    });
    expect(await access.get(accountId, rootId)).toMatchObject({
      projectId: sourceProjectId,
      revision: 1,
    });
    await expect(
      transfers.preview("foreign-account", command),
    ).rejects.toThrow();
  });

  it("rejects a stale preview atomically and replays an identical Move only once", async () => {
    const command = {
      action: "Move" as const,
      documentId: rootId,
      targetProjectId,
      childDocumentIds: [childId],
      sourceRevision: 1,
    };
    const preview = await transfers.preview(accountId, command);
    await database
      .update(document)
      .set({ revision: 2 })
      .where(eq(document.id, childId));
    const payload = { ...command, previewFingerprint: preview.fingerprint };
    const mutation = transfers.mutation(accountId);
    await expect(
      mutation.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          kind: "human",
          clientIdempotencyKey: crypto.randomUUID(),
          targetId: rootId,
          baseRevision: 1,
          payload,
        },
        ({ currentValue }) => ({ ...currentValue, command: payload }),
      ),
    ).rejects.toThrow();
    expect(await access.get(accountId, rootId)).toMatchObject({
      projectId: sourceProjectId,
      revision: 1,
    });
    const fresh = await transfers.preview(accountId, command);
    const nextPayload = { ...command, previewFingerprint: fresh.fingerprint };
    const request = {
      actor: { actorId: accountId, type: "User" as const },
      kind: "human" as const,
      clientIdempotencyKey: crypto.randomUUID(),
      targetId: rootId,
      baseRevision: 1,
      payload: nextPayload,
    };
    const first = await mutation.mutate(request, ({ currentValue }) => ({
      ...currentValue,
      command: nextPayload,
    }));
    const replay = await mutation.mutate(request, ({ currentValue }) => ({
      ...currentValue,
      command: nextPayload,
    }));
    expect(replay).toEqual(first);
    expect(await access.get(accountId, childId)).toMatchObject({
      projectId: targetProjectId,
      parentDocumentId: rootId,
      revision: 3,
    });
  });

  it("preserves a named collection's Table presentation in its frozen snapshot", async () => {
    await database.insert(work).values({
      id: crypto.randomUUID(),
      key: "SRC-1",
      number: 1,
      projectId: sourceProjectId,
      title: "Plan | ship",
      type: "Task",
    });
    const collection = await createDatabaseSmartCollections(database).create(
      accountId,
      {
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: sourceProjectId,
        name: "Tasks",
        viewName: "Planning",
        conditions: {},
        presentation: "Table",
      },
    );
    await database
      .update(document)
      .set({
        body: `:::live-collection{viewId="${collection.id}"}`,
      })
      .where(eq(document.id, rootId));
    const snapshot = await transfers.snapshot(accountId, rootId, 1);
    expect(snapshot.markdown).toContain("Tasks / Planning");
    expect(snapshot.markdown).toContain("| Key | Title | Type | Status |");
    expect(snapshot.markdown).toContain("| SRC-1 | Plan \\| ship | Task |");
  });

  it("fails closed when the independent cancellation journal cannot commit", async () => {
    await database.insert(externalSurface).values({
      id: "surface",
      workspaceId,
      projectId: sourceProjectId,
      documentId: rootId,
    });
    const unavailable = createDatabaseDocumentTransfers(database, access, {
      append: () => Promise.reject(new Error("Journal unavailable")),
      list: async () => [],
    });
    const selection = {
      action: "Cancel External Surface" as const,
      documentId: rootId,
      targetProjectId,
      childDocumentIds: [],
      sourceRevision: 1,
    };
    const preview = await unavailable.preview(accountId, selection);
    await expect(
      unavailable.mutation(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          kind: "human",
          clientIdempotencyKey: crypto.randomUUID(),
          baseRevision: 1,
          targetId: rootId,
          payload: { ...selection, previewFingerprint: preview.fingerprint },
        },
        ({ currentValue }) => ({
          ...currentValue,
          command: { ...selection, previewFingerprint: preview.fingerprint },
        }),
      ),
    ).rejects.toThrow("Journal unavailable");
    expect(await access.get(accountId, rootId)).toMatchObject({ revision: 1 });
    const [surface] = await database
      .select()
      .from(externalSurface)
      .where(eq(externalSurface.id, "surface"));
    expect(surface?.cancelledAt).toBeNull();
  });

  it("freezes a named diagram view with only its visible nodes and links", async () => {
    const diagramId = `diagram-${crypto.randomUUID()}`;
    const viewId = `view-${crypto.randomUUID()}`;
    await database.insert(technicalDiagram).values({
      id: diagramId,
      projectId: sourceProjectId,
      title: "Architecture",
      type: "Technical Architecture",
      authorityMode: "Product-authored Model",
      model: {
        nodes: [
          { id: "web", label: "Web", kind: "Component" },
          { id: "api", label: "API", kind: "Service" },
          { id: "hidden", label: "Hidden storage", kind: "Datastore" },
        ],
        links: [
          { from: "web", to: "api", label: "requests" },
          { from: "api", to: "hidden", label: "persists" },
        ],
      },
    });
    await database.insert(diagramView).values({
      id: viewId,
      diagramId,
      name: "Services",
      selectedNodeIds: ["web", "api"],
    });
    await database
      .update(document)
      .set({
        body: `:::live-diagram{diagramId="${diagramId}" viewId="${viewId}"}`,
      })
      .where(eq(document.id, rootId));
    const snapshot = await transfers.snapshot(accountId, rootId, 1);
    expect(snapshot.markdown).toContain("Architecture / Services");
    expect(snapshot.markdown).toContain("Web → API — requests");
    expect(snapshot.markdown).not.toContain("Hidden storage");
    expect(snapshot.markdown).not.toContain("persists");
  });

  it("freezes a nested live section and renders missing sources without stale text", async () => {
    await database
      .update(document)
      .set({
        body:
          ':::live-section{documentId="' +
          childId +
          '" sectionId="summary"}\n:::live-work{workId="missing"}',
      })
      .where(eq(document.id, rootId));
    await database
      .update(document)
      .set({ body: "## Summary {#summary}\n\nOriginal section" })
      .where(eq(document.id, childId));
    const snapshot = await transfers.snapshot(accountId, rootId, 1);
    expect(snapshot.markdown).toContain("Original section");
    expect(snapshot.markdown).toContain(
      "Snapshot — Document section: Child / Summary",
    );
    expect(snapshot.markdown).toContain("Source unavailable.");
    await database
      .update(document)
      .set({ body: "## Summary {#summary}\n\nChanged section" })
      .where(eq(document.id, childId));
    expect(snapshot.markdown).not.toContain("Changed section");
    expect(snapshot.markdown).not.toContain(":::live-");
    await expect(
      transfers.snapshot("foreign-account", rootId, 1),
    ).rejects.toThrow();
  });
});
