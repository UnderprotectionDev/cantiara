import type { Context } from "@cantiara/api/context";
import type { Document } from "@cantiara/api/documents";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
} from "@cantiara/db/schema/mutation";
import {
  priorityMetricDefinition,
  workPriorityMetricValue,
} from "@cantiara/db/schema/priority-metrics";
import { project } from "@cantiara/db/schema/project";
import {
  diagramDocumentOrigin,
  diagramView,
  technicalDiagram,
} from "@cantiara/db/schema/technical-diagram";
import { work } from "@cantiara/db/schema/work";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseUsageLinks } from "../../relations/server/usage-links-database";
import { createDatabaseSmartCollections } from "../../smart-collections/server/smart-collections-database";
import { createDatabaseTechnicalDiagrams } from "../../technical-diagrams/server/technical-diagrams-database";
import {
  createDatabaseDocumentMutationContracts,
  createDatabaseDocuments,
} from "./documents-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Documents database boundary", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `documents-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;

  function client(actorId = accountId) {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const context: Context = {
      accountAccess: {
        listSessions: async () => [],
        revokeOtherSessions: async () => undefined,
        revokeSession: async () => undefined,
      },
      accountPreferences: {
        get: () => Promise.reject(new Error("Not part of this test.")),
      },
      auth: null,
      db: database,
      documentMutationContracts:
        createDatabaseDocumentMutationContracts(database),
      documents: createDatabaseDocuments(database),
      smartCollections: createDatabaseSmartCollections(database),
      technicalDiagrams: createDatabaseTechnicalDiagrams(database),
      githubAvailability: { getStatus: () => "available" },
      session: {
        session: { id: "session-1" },
        user: { id: actorId },
      } as Context["session"],
    };
    return createRouterClient(appRouter, { context });
  }

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await database
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await database.insert(project).values({
      id: projectId,
      workspaceId,
      name: "Documents test",
      shortCode: `DOC-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      starterConfiguration: "Blank Project",
    });
  });

  afterEach(async () => {
    await database
      ?.delete(mutationHistory)
      .where(eq(mutationHistory.actorId, accountId));
    await database
      ?.delete(mutationReceipt)
      .where(eq(mutationReceipt.actorId, accountId));
    await database
      ?.delete(mutationStaging)
      .where(eq(mutationStaging.actorId, accountId));
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  it("persists Markdown edits, replays retries, and blocks writes after Project archive", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const documents = client();
    const source =
      "| A | B |\n| - | - |\n| 1 | 2 |\n\n```mermaid\ngraph TD; A-->B;\n```\n\n$$x^2$$";
    const createInput = {
      baseRevision: 0,
      body: source,
      clientIdempotencyKey: "create-document-once",
      projectId,
      title: "Architecture",
      type: "General" as const,
    };
    const created = await documents.createDocument(createInput);
    const retriedCreate = await documents.createDocument(createInput);

    expect(retriedCreate).toEqual(created);
    expect(await documents.documents({ projectId })).toEqual([created]);

    await expect(
      documents.createDocument({ ...createInput, body: "different payload" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const updateInput = {
      baseRevision: created.revision,
      body: `${source}\n\nUpdated.`,
      clientIdempotencyKey: "update-document-once",
      documentId: created.id,
    };
    const updated = await documents.updateDocument(updateInput);
    const retriedUpdate = await documents.updateDocument(updateInput);

    expect(retriedUpdate).toEqual(updated);
    expect(updated).toMatchObject({
      body: `${source}\n\nUpdated.`,
      id: created.id,
      revision: 2,
    });
    await expect(
      documents.updateDocument({
        baseRevision: created.revision,
        body: "stale edit",
        clientIdempotencyKey: "update-document-stale",
        documentId: created.id,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: { code: "STALE_BASE_REVISION", currentRevision: updated.revision },
    });
    const drafts = await documents.documentConflictDrafts({
      documentId: created.id,
    });
    expect(drafts).toMatchObject([
      {
        body: "stale edit",
        documentId: created.id,
        projectId,
        baseRevision: 1,
      },
    ]);
    expect(await documents.document({ documentId: created.id })).toEqual(
      updated,
    );
    expect(
      await documents.documentVersions({ documentId: created.id }),
    ).toHaveLength(2);
    await expect(
      documents.updateDocument({
        baseRevision: 1,
        body: "stale edit",
        clientIdempotencyKey: "update-document-stale",
        documentId: created.id,
      }),
    ).rejects.toMatchObject({ data: { conflictDraft: { id: drafts[0]?.id } } });
    expect(
      await documents.documentConflictDrafts({ documentId: created.id }),
    ).toHaveLength(1);

    await database
      .update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, projectId));

    await expect(
      documents.createDocument({
        ...createInput,
        clientIdempotencyKey: "create-after-archive",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      documents.updateDocument({
        baseRevision: updated.revision,
        body: "archived edit",
        clientIdempotencyKey: "update-after-archive",
        documentId: created.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const stillReadable = (await documents.document({
      documentId: created.id,
    })) as Document;
    expect(stillReadable).toEqual(updated);
    expect(await documents.documents({ projectId })).toEqual([updated]);
  });

  it("supports Personal Wiki CRUD and same-scope Conflict Draft resolution", async () => {
    const documents = client();
    const created = await documents.createDocument({
      baseRevision: 0,
      body: "Wiki original",
      clientIdempotencyKey: "wiki-document-create",
      title: "Wiki notes",
      type: "General",
      workspaceId,
    });

    expect(created).toMatchObject({
      body: "Wiki original",
      projectId: null,
      workspaceId,
    });
    expect(await documents.documents({ workspaceId })).toEqual([created]);
    expect(await documents.document({ documentId: created.id })).toEqual(
      created,
    );
    await expect(
      client("another-account").document({ documentId: created.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client("another-account").documents({ workspaceId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const current = await documents.updateDocument({
      baseRevision: created.revision,
      body: "Wiki current",
      clientIdempotencyKey: "wiki-document-current",
      documentId: created.id,
    });
    await expect(
      documents.updateDocument({
        baseRevision: created.revision,
        body: "Wiki rejected",
        clientIdempotencyKey: "wiki-document-stale",
        documentId: created.id,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: {
        conflictDraft: {
          body: "Wiki rejected",
          documentId: created.id,
          projectId: null,
          workspaceId,
        },
      },
    });

    const [draft] = await documents.documentConflictDrafts({
      documentId: created.id,
    });
    if (!draft) {
      throw new Error("A Personal Wiki Conflict Draft is required.");
    }
    expect(draft).toMatchObject({
      projectId: null,
      workspaceId,
    });

    const resolved = await documents.updateDocument({
      baseRevision: current.revision,
      body: "Wiki reconciled",
      clientIdempotencyKey: "wiki-document-resolve",
      conflictDraftId: draft.id,
      documentId: created.id,
    });
    expect(resolved.body).toBe("Wiki reconciled");
    expect(
      await documents.documentConflictDrafts({ documentId: created.id }),
    ).toEqual([]);

    await expect(
      documents.updateDocument({
        baseRevision: current.revision,
        body: "Wiki independent text",
        clientIdempotencyKey: "wiki-document-independent-draft",
        documentId: created.id,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const [independentDraft] = await documents.documentConflictDrafts({
      documentId: created.id,
    });
    if (!independentDraft) {
      throw new Error("A Wiki Conflict Draft is required.");
    }
    await expect(
      documents.createDocument({
        projectId,
        body: independentDraft.body,
        title: "Wrong scope",
        type: independentDraft.type,
        conflictDraftId: independentDraft.id,
        baseRevision: 0,
        clientIdempotencyKey: "wiki-document-wrong-scope",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const independent = await documents.createDocument({
      workspaceId,
      body: independentDraft.body,
      title: "Independent Wiki notes",
      type: independentDraft.type,
      conflictDraftId: independentDraft.id,
      baseRevision: 0,
      clientIdempotencyKey: "wiki-document-independent-create",
    });
    expect(independent).toMatchObject({
      projectId: null,
      workspaceId,
      title: "Independent Wiki notes",
      body: "Wiki independent text",
      origin: {
        documentId: created.id,
        revision: independentDraft.baseRevision,
        conflictDraftId: independentDraft.id,
      },
    });
    expect(
      await documents.documentConflictDrafts({ documentId: created.id }),
    ).toEqual([]);

    await expect(
      documents.updateDocument({
        baseRevision: independent.revision,
        body: "Wiki draft to delete",
        clientIdempotencyKey: "wiki-document-delete-draft",
        documentId: independent.id,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const [deleteDraft] = await documents.documentConflictDrafts({
      documentId: independent.id,
    });
    if (!deleteDraft) {
      throw new Error("A Wiki Conflict Draft is required for deletion.");
    }
    await expect(
      client("another-account").discardDocumentConflictDraft({
        documentId: independent.id,
        conflictDraftId: deleteDraft.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await documents.discardDocumentConflictDraft({
      documentId: independent.id,
      conflictDraftId: deleteDraft.id,
    });
    expect(
      await documents.documentConflictDrafts({ documentId: independent.id }),
    ).toEqual([]);
  });

  it("resolves Conflict Drafts atomically by applying parts, creating an independent Document, or deleting", async () => {
    const documents = client();
    const created = await documents.createDocument({
      projectId,
      title: "Conflict Notes",
      body: "Base",
      type: "General",
      baseRevision: 0,
      clientIdempotencyKey: "conflict-create",
    });
    const current = await documents.updateDocument({
      documentId: created.id,
      body: "Current",
      baseRevision: 1,
      clientIdempotencyKey: "conflict-current",
    });
    await Promise.all(
      ["apply", "spawn", "delete"].map(async (key) => {
        await expect(
          documents.updateDocument({
            documentId: created.id,
            body: `Rejected ${key}`,
            baseRevision: 1,
            clientIdempotencyKey: key,
          }),
        ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      }),
    );
    const drafts = await documents.documentConflictDrafts({
      documentId: created.id,
    });
    const applyDraft = drafts.find((draft) => draft.body === "Rejected apply");
    const spawnDraft = drafts.find((draft) => draft.body === "Rejected spawn");
    const deleteDraft = drafts.find(
      (draft) => draft.body === "Rejected delete",
    );
    if (!(applyDraft && spawnDraft && deleteDraft)) {
      throw new Error("Three Conflict Drafts are required.");
    }
    await expect(
      client("another-account").documentConflictDrafts({
        documentId: created.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const applyInput = {
      documentId: created.id,
      conflictDraftId: applyDraft.id,
      body: "Current\nSelected part",
      baseRevision: current.revision,
      clientIdempotencyKey: "resolve-apply",
    };
    const applied = await documents.updateDocument(applyInput);
    expect(applied).toMatchObject({
      body: "Current\nSelected part",
      revision: 3,
    });
    expect(await documents.updateDocument(applyInput)).toEqual(applied);
    await expect(
      documents.updateDocument({
        ...applyInput,
        clientIdempotencyKey: "apply-again",
        baseRevision: 3,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const spawnInput = {
      projectId,
      conflictDraftId: spawnDraft.id,
      body: spawnDraft.body,
      title: "Independent Notes",
      type: spawnDraft.type,
      baseRevision: 0,
      clientIdempotencyKey: "resolve-spawn",
    };
    const spawned = await documents.createDocument(spawnInput);
    expect(spawned.id).not.toBe(created.id);
    expect(spawned).toMatchObject({
      body: "Rejected spawn",
      projectId,
      origin: {
        documentId: created.id,
        revision: 1,
        conflictDraftId: spawnDraft.id,
      },
    });
    expect(await documents.createDocument(spawnInput)).toEqual(spawned);
    await documents.discardDocumentConflictDraft({
      documentId: created.id,
      conflictDraftId: deleteDraft.id,
    });
    await documents.discardDocumentConflictDraft({
      documentId: created.id,
      conflictDraftId: deleteDraft.id,
    });
    expect(
      await documents.documentConflictDrafts({ documentId: created.id }),
    ).toEqual([]);
    expect(await documents.document({ documentId: created.id })).toEqual(
      applied,
    );
    expect(
      await documents.documentVersions({ documentId: created.id }),
    ).toHaveLength(3);
    expect(
      (await documents.documents({ projectId })).map(({ body }) => body).sort(),
    ).toEqual(["Current\nSelected part", "Rejected spawn"]);
  });

  it("rejects stale comparisons and cross-account resolution without producing another draft", async () => {
    const documents = client();
    const source = await documents.createDocument({
      projectId,
      title: "Comparison Notes",
      body: "Base",
      type: "General",
      baseRevision: 0,
      clientIdempotencyKey: "comparison-create",
    });
    const compared = await documents.updateDocument({
      documentId: source.id,
      body: "Compared",
      baseRevision: 1,
      clientIdempotencyKey: "comparison-save",
    });
    await expect(
      documents.updateDocument({
        documentId: source.id,
        body: "Rejected",
        baseRevision: 1,
        clientIdempotencyKey: "comparison-reject",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const [draft] = await documents.documentConflictDrafts({
      documentId: source.id,
    });
    if (!draft) {
      throw new Error("A Conflict Draft is required.");
    }
    const latest = await documents.updateDocument({
      documentId: source.id,
      body: "Latest",
      baseRevision: compared.revision,
      clientIdempotencyKey: "comparison-compete",
    });
    await expect(
      documents.updateDocument({
        documentId: source.id,
        conflictDraftId: draft.id,
        body: "Must not overwrite",
        baseRevision: compared.revision,
        clientIdempotencyKey: "comparison-apply",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      client("another-account").discardDocumentConflictDraft({
        documentId: source.id,
        conflictDraftId: draft.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      documents.createDocument({
        projectId: "another-project",
        title: "Wrong scope",
        body: "Rejected",
        type: "General",
        conflictDraftId: draft.id,
        baseRevision: 0,
        clientIdempotencyKey: "comparison-wrong-scope",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await documents.document({ documentId: source.id })).toEqual(latest);
    expect(
      await documents.documentConflictDrafts({ documentId: source.id }),
    ).toEqual([draft]);
    expect(
      await documents.documentVersions({ documentId: source.id }),
    ).toHaveLength(3);
  });

  it("derives live Work usage links from committed Document content", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const documents = client();
    const usages = createDatabaseUsageLinks(database);
    await database.insert(work).values({
      id: "work-source",
      key: "DOC-1",
      number: 1,
      projectId,
      title: "Current source",
      type: "Task",
    });
    await database.insert(priorityMetricDefinition).values({
      id: "metric-impact",
      name: "Impact",
      nameKey: "impact",
      projectId,
      rankDescriptions: {
        "Very low": "Very low impact",
        Low: "Low impact",
        Medium: "Medium impact",
        High: "High impact",
        "Very high": "Very high impact",
      },
      shortDescription: "Expected impact",
    });
    await database.insert(workPriorityMetricValue).values({
      id: "value-impact",
      metricId: "metric-impact",
      projectId,
      rank: "High",
      workId: "work-source",
    });
    const created = await documents.createDocument({
      baseRevision: 0,
      body: ':::live-work{workId="work-source"}',
      clientIdempotencyKey: "create-document-live-usage",
      projectId,
      title: "Live references",
      type: "General",
    });
    const initialLinks = await usages.listBySource(accountId, {
      recordId: "work-source",
      recordType: "Work",
    });
    expect(initialLinks).toMatchObject([
      {
        kind: "Live block",
        surface: { recordId: created.id, recordType: "Document" },
      },
    ]);
    expect(
      await documents.documentLiveWorkBlocks({ documentId: created.id }),
    ).toMatchObject([
      {
        source: {
          title: "Current source",
          priority: [{ name: "Impact", rank: "High" }],
        },
      },
    ]);

    await database
      .update(work)
      .set({ trashedAt: new Date() })
      .where(eq(work.id, "work-source"));
    expect(
      await documents.documentLiveWorkBlocks({ documentId: created.id }),
    ).toEqual([{ workId: "work-source", source: null }]);

    const revised = await documents.updateDocument({
      baseRevision: created.revision,
      body: 'A note.\n\n:::live-work{workId="work-source"}',
      clientIdempotencyKey: "keep-document-live-usage",
      documentId: created.id,
    });
    expect(
      await usages.listBySource(accountId, {
        recordId: "work-source",
        recordType: "Work",
      }),
    ).toMatchObject([
      { id: initialLinks[0]?.id, createdAt: initialLinks[0]?.createdAt },
    ]);

    await documents.updateDocument({
      baseRevision: revised.revision,
      body: "Reference removed.",
      clientIdempotencyKey: "remove-document-live-usage",
      documentId: created.id,
    });
    expect(
      await usages.listBySource(accountId, {
        recordId: "work-source",
        recordType: "Work",
      }),
    ).toEqual([]);
  });

  it("embeds a named Smart Collection view and Diagram View from their current sources", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const api = client();
    await database.insert(work).values({
      id: "collection-work",
      key: "DOC-2",
      number: 2,
      projectId,
      title: "Matching Work",
      type: "Task",
      status: "In Progress",
    });
    const createCollection = {
      clientIdempotencyKey: crypto.randomUUID(),
      projectId,
      name: "Active tasks",
      conditions: { status: "In Progress" },
      viewName: "Team list",
      presentation: "List",
    } as const;
    const concurrentCollections = await Promise.all([
      api.createSmartCollection(createCollection),
      api.createSmartCollection(createCollection),
    ]);
    const [collection] = concurrentCollections;
    expect(concurrentCollections).toEqual([collection, collection]);
    expect(await api.createSmartCollection(createCollection)).toEqual(
      collection,
    );
    await expect(
      api.createSmartCollection({ ...createCollection, name: "Different" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(collection.works).toMatchObject([{ title: "Matching Work" }]);
    await database.insert(technicalDiagram).values({
      id: "diagram-source",
      projectId,
      title: "Architecture",
      type: "Technical Architecture",
      authorityMode: "Imported Independent Copy",
      model: {
        nodes: [{ id: "service", label: "API", kind: "Service" }],
        links: [],
      },
    });
    await database.insert(diagramView).values({
      id: "diagram-view",
      diagramId: "diagram-source",
      name: "Services",
      selectedNodeIds: ["service"],
    });
    const created = await api.createDocument({
      baseRevision: 0,
      body: `:::live-collection{viewId="${collection.id}"}\n:::live-diagram{diagramId="diagram-source" viewId="diagram-view"}`,
      clientIdempotencyKey: crypto.randomUUID(),
      projectId,
      title: "Embedded sources",
      type: "General",
    });
    expect(
      await api.documentLiveOtherBlocks({ documentId: created.id }),
    ).toMatchObject([
      {
        kind: "Smart Collection",
        source: { works: [{ title: "Matching Work" }] },
      },
      { kind: "Technical Diagram", source: { view: { name: "Services" } } },
    ]);
    await database
      .update(work)
      .set({ status: "Not Started" })
      .where(eq(work.id, "collection-work"));
    expect(
      await api.documentLiveOtherBlocks({ documentId: created.id }),
    ).toMatchObject([
      { source: { works: [] } },
      { source: { model: { nodes: [{ label: "API" }] } } },
    ]);
    const links = await createDatabaseUsageLinks(database).listBySource(
      accountId,
      {
        recordType: "Technical Diagram",
        recordId: "diagram-source",
      },
    );
    expect(links).toMatchObject([
      { kind: "Live block", surface: { recordId: created.id } },
    ]);
    expect(
      await createDatabaseSmartCollections(database).getView(
        "another-account",
        collection.id,
      ),
    ).toBeNull();
    expect(
      await createDatabaseTechnicalDiagrams(database).get(
        "another-account",
        "diagram-source",
      ),
    ).toBeNull();
    await database
      .update(technicalDiagram)
      .set({ authorityMode: "Product-authored Model" })
      .where(eq(technicalDiagram.id, "diagram-source"));
    expect(
      await api.documentLiveOtherBlocks({ documentId: created.id }),
    ).toMatchObject([
      { source: { works: [] } },
      { source: { authorityMode: "Product-authored Model" } },
    ]);
    await database
      .update(technicalDiagram)
      .set({
        model: {
          nodes: [],
          links: [{ from: "missing", to: "missing", label: null }],
        },
      })
      .where(eq(technicalDiagram.id, "diagram-source"));
    expect(
      await api.documentLiveOtherBlocks({ documentId: created.id }),
    ).toMatchObject([{ source: { works: [] } }, { source: null }]);
    await database
      .delete(diagramView)
      .where(eq(diagramView.id, "diagram-view"));
    await database
      .delete(technicalDiagram)
      .where(eq(technicalDiagram.id, "diagram-source"));
    expect(
      await api.documentLiveOtherBlocks({ documentId: created.id }),
    ).toMatchObject([{ source: { works: [] } }, { source: null }]);
  });

  it("previews and atomically converts a saved Mermaid block into an independent Technical Diagram", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const api = client();
    const block = "```mermaid\ngraph TD\nweb[Web] --> api[API]\n```";
    const saved = await api.createDocument({
      baseRevision: 0,
      body: `# Design\n\n${block}`,
      clientIdempotencyKey: crypto.randomUUID(),
      projectId,
      title: "Design",
      type: "General",
    });
    const command = {
      documentId: saved.id,
      documentRevision: saved.revision,
      blockStart: saved.body.indexOf(block),
      blockEnd: saved.body.indexOf(block) + block.length,
      title: "Web architecture",
    };
    const preview = await api.previewMermaidConversion(command);
    expect(preview).toMatchObject({
      authorityMode: "Imported Independent Copy",
      originalBlock: "Keep independent",
      model: { nodes: [{ label: "Web" }, { label: "API" }] },
    });
    const tildeBlock = "~~~~mermaid\ngraph TD\nweb[Web] --> api[API]\n~~~~";
    const tildeDocument = await api.createDocument({
      baseRevision: 0,
      body: tildeBlock,
      clientIdempotencyKey: crypto.randomUUID(),
      projectId,
      title: "Tilde design",
      type: "General",
    });
    expect(
      await api.previewMermaidConversion({
        documentId: tildeDocument.id,
        documentRevision: tildeDocument.revision,
        blockStart: 0,
        blockEnd: tildeBlock.length,
        title: "Tilde architecture",
      }),
    ).toMatchObject({
      model: { nodes: [{ label: "Web" }, { label: "API" }] },
    });
    const confirmed = { ...command, clientIdempotencyKey: crypto.randomUUID() };
    const concurrentConversions = await Promise.all([
      api.convertMermaidToTechnicalDiagram(confirmed),
      api.convertMermaidToTechnicalDiagram(confirmed),
    ]);
    const [created] = concurrentConversions;
    expect(concurrentConversions).toEqual([created, created]);
    expect(created).toMatchObject({
      title: "Web architecture",
      view: { name: "Default" },
    });
    const viewInput = {
      clientIdempotencyKey: crypto.randomUUID(),
      diagramId: created.id,
      name: "Web only",
      selectedNodeIds: ["web"],
    };
    const namedView = await api.createDiagramView(viewInput);
    expect(namedView.view).toMatchObject({
      name: "Web only",
      selectedNodeIds: ["web"],
    });
    expect(await api.createDiagramView(viewInput)).toEqual(namedView);
    await expect(
      api.createDiagramView({
        ...viewInput,
        clientIdempotencyKey: crypto.randomUUID(),
        selectedNodeIds: ["missing"],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await api.convertMermaidToTechnicalDiagram(confirmed)).toEqual(
      created,
    );
    expect((await api.document({ documentId: saved.id })).body).toBe(
      saved.body,
    );
    expect(
      await database
        .select()
        .from(diagramDocumentOrigin)
        .where(eq(diagramDocumentOrigin.diagramId, created.id)),
    ).toMatchObject([
      { documentId: saved.id, documentRevision: saved.revision },
    ]);
    await expect(
      api.previewMermaidConversion({
        ...command,
        blockEnd: command.blockEnd - 1,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await api.technicalDiagrams({ projectId })).toHaveLength(1);
  });
  it("compares product versions and restores a prior version as a new head", async () => {
    const documents = client();
    const created = await documents.createDocument({
      baseRevision: 0,
      body: "# First\nOriginal text",
      clientIdempotencyKey: "version-create",
      projectId,
      title: "Architecture",
      type: "Spec",
    });
    const changed = await documents.updateDocument({
      baseRevision: created.revision,
      body: "# Second\nChanged text",
      clientIdempotencyKey: "version-update",
      documentId: created.id,
      title: "Revised architecture",
    });

    const versionsBeforeRestore = await documents.documentVersions({
      documentId: created.id,
    });
    expect(versionsBeforeRestore).toMatchObject([
      { revision: 2, title: changed.title, type: changed.type },
      { revision: 1, title: created.title, type: created.type },
    ]);
    expect(
      versionsBeforeRestore?.every((version) => !("body" in version)),
    ).toBe(true);
    expect(
      await documents.documentVersion({
        documentId: created.id,
        revision: changed.revision,
      }),
    ).toEqual(changed);
    expect(
      await documents.documentVersion({
        documentId: created.id,
        revision: created.revision,
      }),
    ).toEqual(created);
    const restored = await documents.restoreDocumentVersion({
      baseRevision: changed.revision,
      clientIdempotencyKey: "version-restore",
      documentId: created.id,
      revision: created.revision,
    });
    expect(
      await documents.restoreDocumentVersion({
        baseRevision: changed.revision,
        clientIdempotencyKey: "version-restore",
        documentId: created.id,
        revision: created.revision,
      }),
    ).toEqual(restored);
    expect(restored).toMatchObject({
      id: created.id,
      revision: 3,
      body: created.body,
      title: created.title,
      type: created.type,
    });
    const versionsAfterRestore = await documents.documentVersions({
      documentId: created.id,
    });
    expect(versionsAfterRestore).toMatchObject([
      { revision: 3, title: created.title },
      { revision: 2, title: changed.title },
      { revision: 1, title: created.title },
    ]);
    expect(versionsAfterRestore?.every((version) => !("body" in version))).toBe(
      true,
    );
    expect(
      await documents.documentVersion({
        documentId: created.id,
        revision: created.revision,
      }),
    ).toEqual(created);
    await expect(
      documents.restoreDocumentVersion({
        baseRevision: changed.revision,
        clientIdempotencyKey: "version-stale",
        documentId: created.id,
        revision: 1,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
