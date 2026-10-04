import type { Context } from "@cantiara/api/context";
import { universalSearchRecordTypes } from "@cantiara/api/record-discovery";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import {
  fileAttachment,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { risk } from "@cantiara/db/schema/risk";
import {
  diagramView,
  technicalDiagram,
} from "@cantiara/db/schema/technical-diagram";
import { work } from "@cantiara/db/schema/work";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseDocuments } from "../../documents/server/documents-database";
import { createDatabaseUniversalSearch } from "./universal-search-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Record Discovery universal search boundary", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `universal-search-${crypto.randomUUID()}`;
  const otherAccountId = `universal-search-other-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const otherWorkspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;
  const otherProjectId = `project-${crypto.randomUUID()}`;
  const foreignProjectId = `project-${crypto.randomUUID()}`;
  const recordNamespace = crypto.randomUUID();
  const recordId = (suffix: string) =>
    `universal-search-record-${recordNamespace}-${suffix}`;
  const contentHash = () =>
    `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;

  function client(principalAccountId = accountId) {
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
      documents: createDatabaseDocuments(database),
      universalSearch: createDatabaseUniversalSearch(database),
      githubAvailability: { getStatus: () => "available" },
      session: {
        session: { id: "session-1" },
        user: { id: principalAccountId },
      } as Context["session"],
    };
    return createRouterClient(appRouter, { context });
  }

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values([
      {
        email: `${accountId}@example.invalid`,
        id: accountId,
        name: "Founder",
      },
      {
        email: `${otherAccountId}@example.invalid`,
        id: otherAccountId,
        name: "Other Founder",
      },
    ]);
    await database.insert(workspace).values([
      { id: workspaceId, ownerAccountId: accountId },
      { id: otherWorkspaceId, ownerAccountId: otherAccountId },
    ]);
    await database.insert(project).values([
      {
        id: projectId,
        workspaceId,
        name: "Current Project",
        shortCode: `CUR-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      },
      {
        id: otherProjectId,
        workspaceId,
        name: "Other Project",
        shortCode: `OTH-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      },
      {
        id: foreignProjectId,
        workspaceId: otherWorkspaceId,
        name: "Private Project",
        shortCode: `PRV-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      },
    ]);
  });

  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
    await database?.delete(user).where(eq(user.id, otherAccountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  it("applies the closed ranking order and excludes Trash and other Accounts", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(work).values([
      {
        id: recordId("work-current-active"),
        key: "CUR-1",
        number: 1,
        projectId,
        title: "PostgreSQL active title",
        type: "Task",
        status: "In Progress",
        updatedAt: new Date("2026-08-01T00:00:00Z"),
      },
      {
        id: recordId("work-current-completed"),
        key: "CUR-2",
        number: 2,
        projectId,
        title: "PostgreSQL completed title",
        type: "Task",
        status: "Closed",
        closureResult: "Completed",
        updatedAt: new Date("2026-10-01T00:00:00Z"),
      },
      {
        id: recordId("work-current-abandoned"),
        key: "CUR-3",
        number: 3,
        projectId,
        title: "PostgreSQL abandoned title",
        type: "Task",
        status: "Closed",
        closureResult: "Abandoned",
        updatedAt: new Date("2026-10-02T00:00:00Z"),
      },
      {
        id: recordId("work-tie-b"),
        key: "CUR-7",
        number: 7,
        projectId,
        title: "PostgreSQL stable order",
        type: "Task",
        status: "In Progress",
        updatedAt: new Date("2026-09-15T00:00:00Z"),
      },
      {
        id: recordId("work-tie-a"),
        key: "CUR-8",
        number: 8,
        projectId,
        title: "PostgreSQL stable order",
        type: "Task",
        status: "In Progress",
        updatedAt: new Date("2026-09-15T00:00:00Z"),
      },
      {
        id: recordId("work-other-project"),
        key: "OTH-1",
        number: 1,
        projectId: otherProjectId,
        title: "PostgreSQL other project title",
        type: "Task",
        status: "In Progress",
        updatedAt: new Date("2026-12-01T00:00:00Z"),
      },
      {
        id: recordId("work-current-body"),
        key: "CUR-4",
        number: 4,
        projectId,
        title: "Recovery notes",
        type: "Task",
        status: "In Progress",
        description: "PostgreSQL body match",
        updatedAt: new Date("2026-12-02T00:00:00Z"),
      },
      {
        archivedAt: new Date("2026-12-03T00:00:00Z"),
        id: recordId("work-archived"),
        key: "CUR-5",
        number: 5,
        projectId,
        title: "PostgreSQL archived title",
        type: "Task",
        status: "Not Started",
      },
      {
        id: recordId("work-trashed"),
        key: "CUR-6",
        number: 6,
        projectId,
        title: "PostgreSQL trashed title",
        trashedAt: new Date("2026-12-04T00:00:00Z"),
        type: "Task",
      },
      {
        id: recordId("work-private"),
        key: "PRV-1",
        number: 1,
        projectId: foreignProjectId,
        title: "PostgreSQL private title",
        type: "Task",
      },
    ]);
    await database.insert(decision).values({
      decision: "Prefer the supported recovery path.",
      id: recordId("decision-current-title"),
      projectId,
      title: "PostgreSQL decision title",
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    });

    const input = { currentProjectId: projectId, query: "PostgreSQL" };
    const results = await client().searchRecords(input);
    expect(results.map(({ id }) => id)).toEqual([
      recordId("work-tie-a"),
      recordId("work-tie-b"),
      recordId("decision-current-title"),
      recordId("work-current-active"),
      recordId("work-current-completed"),
      recordId("work-current-abandoned"),
      recordId("work-other-project"),
      recordId("work-current-body"),
    ]);
    expect(await client().searchRecords(input)).toEqual(results);
    expect(
      results.find(({ id }) => id === recordId("work-current-active")),
    ).toMatchObject({
      category: "Task",
      matchCount: 1,
      recordType: "Work",
      snippet: expect.stringContaining("PostgreSQL active title"),
    });
    expect(
      (await client().searchRecords({ query: "private" })).map(({ id }) => id),
    ).toEqual([]);
    expect(
      (await client(otherAccountId).searchRecords({ query: "private" })).map(
        ({ id }) => id,
      ),
    ).toEqual([recordId("work-private")]);
    expect(
      (await client().searchRecords({ ...input, archived: true })).map(
        ({ id }) => id,
      ),
    ).toEqual([recordId("work-archived")]);
    expect(await client().searchRecords({ query: "   " })).toEqual([]);
  });

  it("ranks Work key matches ahead of body-only matches", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(work).values({
      id: recordId("work-key-match"),
      key: "CUR-9",
      number: 9,
      projectId,
      title: "Recovery task",
      type: "Task",
      status: "In Progress",
    });
    await database.insert(document).values({
      body: "The CUR-9 key appears in this body.",
      id: recordId("document-body-match"),
      projectId,
      title: "Recovery notes",
    });

    const results = await client().searchRecords({ query: "CUR-9" });

    expect(results.map(({ id }) => id)).toEqual([
      recordId("work-key-match"),
      recordId("document-body-match"),
    ]);
  });

  it("indexes every canonical main record type and diagram view labels", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(work).values({
      id: recordId("universal-work"),
      key: "CUR-10",
      number: 10,
      projectId,
      title: "PostgreSQL Work",
      type: "Task",
      status: "In Progress",
    });
    await database.insert(decision).values({
      decision: "Use the supported database path.",
      id: recordId("universal-decision"),
      projectId,
      title: "PostgreSQL Decision",
    });
    await database.insert(risk).values({
      description: "Database recovery may be delayed.",
      id: recordId("universal-risk"),
      projectId,
      title: "PostgreSQL Risk",
    });
    await database.insert(assumption).values({
      id: recordId("universal-assumption"),
      projectId,
      statement: "Database access is available.",
      title: "PostgreSQL Assumption",
    });
    await database.insert(openQuestion).values({
      id: recordId("universal-question"),
      projectId,
      question: "Which database is active?",
      title: "PostgreSQL Open Question",
    });
    await database.insert(projectMilestone).values({
      id: recordId("universal-milestone"),
      projectId,
      title: "PostgreSQL Milestone",
    });
    await database.insert(projectRelease).values({
      id: recordId("universal-release"),
      name: "PostgreSQL Project Release",
      projectId,
    });
    await database.insert(productionIncident).values({
      id: recordId("universal-incident"),
      occurredAt: new Date("2026-09-01T00:00:00Z"),
      projectId,
      title: "PostgreSQL Production Incident",
    });
    await database.insert(technicalDiagram).values({
      authorityMode: "Product-authored Model",
      id: recordId("universal-diagram"),
      model: {
        links: [],
        nodes: [{ id: "node-1", kind: "Datastore", label: "Project table" }],
      },
      projectId,
      title: "Database model",
      type: "Data Model",
    });
    await database.insert(diagramView).values({
      diagramId: recordId("universal-diagram"),
      id: recordId("universal-diagram-view"),
      name: "PostgreSQL schema view",
      selectedNodeIds: ["node-1"],
    });
    await database.insert(document).values({
      body: "Searchable PostgreSQL document body.",
      id: recordId("universal-document"),
      projectId,
      title: "Database document",
    });
    await database.insert(fileAttachment).values({
      id: recordId("universal-attachment"),
      name: "Database attachment",
      projectId,
      scopeType: "Project",
      workspaceId,
    });
    await database.insert(fileAttachmentVersion).values({
      attachmentId: recordId("universal-attachment"),
      byteSize: 1,
      contentHash: contentHash(),
      detectedMimeType: "text/plain",
      extension: "txt",
      fileName: "PostgreSQL metadata.txt",
      id: recordId("universal-attachment-version"),
      mimeType: "text/plain",
      objectKey: recordId("universal-object"),
      version: 1,
    });

    const results = await client().searchRecords({ query: "PostgreSQL" });
    expect(results.map(({ recordType }) => recordType).sort()).toEqual(
      [...universalSearchRecordTypes].sort(),
    );
    expect(
      results.find(({ id }) => id === recordId("universal-diagram")),
    ).toMatchObject({
      matchCount: 1,
      recordType: "Technical Diagram",
      snippet: expect.stringContaining("PostgreSQL schema view"),
    });
    expect(
      (await client().searchRecords({ query: "Project table" })).map(
        ({ id }) => id,
      ),
    ).toContain(recordId("universal-diagram"));
  });

  it("searches owned Documents and only current File Attachment metadata", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(document).values([
      {
        id: recordId("document-project"),
        projectId,
        title: "Connection guide",
        body: "PostgreSQL recovery steps.",
      },
      {
        id: recordId("document-wiki"),
        workspaceId,
        title: "PostgreSQL handbook",
        body: "Owned Wiki content.",
      },
      {
        id: recordId("document-private"),
        workspaceId: otherWorkspaceId,
        title: "PostgreSQL private handbook",
        body: "Private content.",
      },
    ]);
    await database.insert(fileAttachment).values([
      {
        id: recordId("attachment-current"),
        workspaceId,
        scopeType: "Personal Wiki",
        personalWikiId: recordId("wiki-one"),
        projectId: null,
        name: "Recovery attachment",
        currentVersion: 2,
      },
      {
        id: recordId("attachment-trash"),
        workspaceId,
        scopeType: "Personal Wiki",
        personalWikiId: recordId("wiki-one"),
        projectId: null,
        name: "PostgreSQL deleted file",
        lifecycleStatus: "Trash",
      },
    ]);
    await database.insert(fileAttachmentVersion).values([
      {
        id: recordId("attachment-current-old-version"),
        attachmentId: recordId("attachment-current"),
        version: 1,
        byteSize: 1,
        contentHash: contentHash(),
        detectedMimeType: "text/plain",
        extension: "txt",
        fileName: "PostgreSQL-old.txt",
        mimeType: "text/plain",
        objectKey: recordId("old-object"),
      },
      {
        id: recordId("attachment-current-version"),
        attachmentId: recordId("attachment-current"),
        version: 2,
        byteSize: 1,
        contentHash: contentHash(),
        detectedMimeType: "text/plain",
        extension: "txt",
        fileName: "PostgreSQL-current.txt",
        mimeType: "text/plain",
        objectKey: recordId("current-object"),
      },
      {
        id: recordId("attachment-trash-version"),
        attachmentId: recordId("attachment-trash"),
        version: 1,
        byteSize: 1,
        contentHash: contentHash(),
        detectedMimeType: "text/plain",
        extension: "txt",
        fileName: "PostgreSQL-trash.txt",
        mimeType: "text/plain",
        objectKey: recordId("trash-object"),
      },
    ]);

    const results = await client().searchRecords({ query: "PostgreSQL" });
    expect(new Set(results.map(({ id }) => id))).toEqual(
      new Set([
        recordId("document-wiki"),
        recordId("document-project"),
        recordId("attachment-current"),
      ]),
    );
    expect(
      results.find(({ id }) => id === recordId("attachment-current")),
    ).toMatchObject({
      category: "txt",
      matchCount: 1,
      recordType: "File Attachment",
      title: "Recovery attachment",
      snippet: expect.stringContaining("Recovery attachment"),
    });
    expect(
      (await client().searchRecords({ query: "Recovery" })).find(
        ({ id }) => id === recordId("attachment-current"),
      ),
    ).toMatchObject({ matchCount: 1 });
    expect(results.map(({ title }) => title).join(" ")).not.toContain(
      "private",
    );
    expect(results.map(({ title }) => title).join(" ")).not.toContain("old");
    expect(results.map(({ id }) => id)).not.toContain(
      recordId("attachment-trash"),
    );
  });
});
