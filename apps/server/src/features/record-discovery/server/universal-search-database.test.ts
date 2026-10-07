import type { Context } from "@cantiara/api/context";
import { universalSearchRecordTypes } from "@cantiara/api/record-discovery";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import {
  account as authAccount,
  session as authSession,
  user,
  workspace,
} from "@cantiara/db/schema/auth";
import {
  captureExtensionLink,
  captureExtensionPairingCode,
  captureInboxItem,
} from "@cantiara/db/schema/capture-triage";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
} from "@cantiara/db/schema/external-surface";
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
import { workDraft } from "@cantiara/db/schema/work-draft";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseDocuments } from "../../documents/server/documents-database";
import { createDatabaseUniversalSearch } from "./universal-search-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const databaseTestTimeout = 15_000;

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
  const canary = (prefix: string) =>
    `${prefix}${recordNamespace.replaceAll("-", "")}`;
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

  it("searches the current Next concrete step and drops a replaced hint", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const id = recordId("next-step");
    await database.insert(work).values({
      id,
      key: "CUR-1",
      number: 1,
      projectId,
      title: "Payment investigation",
      type: "Task",
      nextConcreteStep: "Obtain transaction evidence",
    });
    expect(
      (
        await client().searchRecords({
          query: "transaction evidence",
          currentProjectId: projectId,
        })
      ).map((result) => result.id),
    ).toContain(id);
    await database
      .update(work)
      .set({ nextConcreteStep: "Contact customer" })
      .where(eq(work.id, id));
    expect(
      (
        await client().searchRecords({
          query: "transaction evidence",
          currentProjectId: projectId,
        })
      ).map((result) => result.id),
    ).not.toContain(id);
  });

  it("finds the Project source by its current next step within Account, scope and archive boundaries", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const [source] = await database
      .select({ shortCode: project.shortCode })
      .from(project)
      .where(eq(project.id, projectId));
    if (!source) {
      throw new Error("Project fixture is unavailable.");
    }
    const keyMatches = await client().searchRecords({
      query: source.shortCode,
    });
    expect(keyMatches).toEqual([
      expect.objectContaining({
        id: projectId,
        snippet: expect.stringContaining(source.shortCode),
      }),
    ]);
    expect(keyMatches[0]?.matchCount).toBeGreaterThan(0);
    await database
      .update(project)
      .set({ nextConcreteStep: "Inspect billing evidence" })
      .where(eq(project.id, projectId));
    expect(await client().searchRecords({ query: "billing evidence" })).toEqual(
      [expect.objectContaining({ id: projectId, recordType: "Project" })],
    );
    expect(
      await client(otherAccountId).searchRecords({ query: "billing evidence" }),
    ).toEqual([]);
    expect(
      await client().searchRecords({
        query: "billing evidence",
        scope: { kind: "wiki" },
      }),
    ).toEqual([]);
    await database
      .update(project)
      .set({ nextConcreteStep: "Talk to customer" })
      .where(eq(project.id, projectId));
    expect(await client().searchRecords({ query: "billing evidence" })).toEqual(
      [],
    );
    await database
      .update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, projectId));
    expect(await client().searchRecords({ query: "Talk to customer" })).toEqual(
      [],
    );
    expect(
      await client().searchRecords({
        query: "Talk to customer",
        archived: true,
      }),
    ).toEqual([
      expect.objectContaining({ id: projectId, recordType: "Project" }),
    ]);
  });

  it(
    "applies the closed ranking order and excludes Trash and other Accounts",
    async () => {
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
        (await client().searchRecords({ query: "private" })).map(
          ({ id }) => id,
        ),
      ).toEqual([]);
      expect(
        (await client(otherAccountId).searchRecords({ query: "private" })).map(
          ({ id }) => id,
        ),
      ).toEqual([recordId("work-private"), foreignProjectId]);
      expect(
        (await client().searchRecords({ ...input, archived: true })).map(
          ({ id }) => id,
        ),
      ).toEqual([recordId("work-archived")]);
      expect(await client().searchRecords({ query: "   " })).toEqual([]);
    },
    databaseTestTimeout,
  );

  it(
    "keeps Capture Inbox items, Drafts, External Surfaces, and credentials outside Search",
    async () => {
      if (!database) {
        throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
      }

      const captureText = canary("CaptureInboxOnly");
      const draftText = canary("WorkDraftOnly");
      const externalSurfaceText = canary("ExternalSurfaceOnly");
      const shareToken = canary("ShareTokenSecret");
      const linkPassword = canary("LinkPasswordSecret");
      const sessionToken = canary("SessionTokenSecret");
      const accessToken = canary("GitHubAccessTokenSecret");
      const refreshToken = canary("GitHubRefreshTokenSecret");
      const idToken = canary("GitHubIdTokenSecret");
      const credentialPassword = canary("CredentialPasswordSecret");
      const captureExtensionTokenHash = contentHash();
      const captureExtensionPairingCodeHash = contentHash();
      const searchableWorkTitle = canary("SearchableWork");
      const diagramLabel = canary("DiagramMigrationName");
      const secretCanaries = [
        shareToken,
        linkPassword,
        sessionToken,
        accessToken,
        refreshToken,
        idToken,
        credentialPassword,
        captureExtensionTokenHash,
        captureExtensionPairingCodeHash,
      ];
      const shareableSurfaceId = recordId("excluded-external-surface");
      const diagramId = recordId("migration-name-owner-diagram");
      const supportedRecordTypes: string[] = [...universalSearchRecordTypes];

      await database.insert(captureInboxItem).values({
        accountId,
        content: `${captureText} ${shareToken} ${linkPassword}`,
        fields: {},
        id: recordId("excluded-capture-inbox-item"),
      });
      await database.insert(workDraft).values({
        accountId,
        description: draftText,
        id: recordId("excluded-work-draft"),
        projectId,
        title: draftText,
        type: "Task",
      });
      await database.insert(externalSurface).values({
        id: shareableSurfaceId,
        projectId,
        workspaceId,
      });
      await database.insert(externalSurfaceSnapshotRevision).values({
        id: recordId("excluded-external-surface-snapshot"),
        revision: 1,
        snapshot: { body: externalSurfaceText },
        surfaceId: shareableSurfaceId,
      });
      await database.insert(authAccount).values({
        accountId: canary("ProviderAccount"),
        accessToken,
        id: recordId("secret-provider-account"),
        idToken,
        password: credentialPassword,
        providerId: "github",
        refreshToken,
        userId: accountId,
      });
      await database.insert(authSession).values({
        expiresAt: new Date("2027-01-01T00:00:00Z"),
        id: recordId("secret-session"),
        token: sessionToken,
        userId: accountId,
      });
      await database.insert(captureExtensionLink).values({
        accountId,
        browser: "Chrome",
        device: "Search exclusion fixture",
        id: recordId("secret-capture-extension-link"),
        tokenHash: captureExtensionTokenHash,
      });
      await database.insert(captureExtensionPairingCode).values({
        accountId,
        codeHash: captureExtensionPairingCodeHash,
        expiresAt: new Date("2027-01-01T00:00:00Z"),
        id: recordId("secret-capture-extension-pairing-code"),
      });
      await database.insert(work).values({
        id: recordId("searchable-work-without-secret-material"),
        key: "CUR-90",
        number: 90,
        projectId,
        status: "In Progress",
        title: searchableWorkTitle,
        type: "Task",
      });
      await database.insert(technicalDiagram).values({
        authorityMode: "Product-authored Model",
        id: diagramId,
        model: {
          links: [],
          nodes: [
            {
              id: "migration-name",
              kind: "Datastore",
              label: diagramLabel,
            },
          ],
        },
        projectId,
        title: "Schema owner",
        type: "Data Model",
      });

      for (const excludedRecordType of [
        "Capture Inbox",
        "Draft",
        "External Surface",
        "GitHub external",
        "Migration Artifact",
      ]) {
        expect(supportedRecordTypes).not.toContain(excludedRecordType);
      }

      const excludedQueries = [
        captureText,
        draftText,
        externalSurfaceText,
        ...secretCanaries,
      ];
      const excludedResults = await Promise.all(
        excludedQueries.map((query) => client().searchRecords({ query })),
      );
      expect(excludedResults).toEqual(excludedQueries.map(() => []));

      const safeResults = await client().searchRecords({
        query: searchableWorkTitle,
      });
      expect(safeResults).toMatchObject([
        {
          id: recordId("searchable-work-without-secret-material"),
          recordType: "Work",
          snippet: expect.stringContaining(searchableWorkTitle),
        },
      ]);
      const serializedSafeResults = JSON.stringify(safeResults);
      for (const secret of secretCanaries) {
        expect(serializedSafeResults).not.toContain(secret);
      }

      expect(
        (await client().searchRecords({ query: diagramLabel })).map(
          ({ id, recordType }) => ({ id, recordType }),
        ),
      ).toEqual([{ id: diagramId, recordType: "Technical Diagram" }]);
    },
    databaseTestTimeout,
  );

  it(
    "keeps trashed File Attachments out of Search and exposes archived ones only with the archive filter",
    async () => {
      if (!database) {
        throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
      }

      const archivedAttachmentId = recordId("archived-attachment");
      const archivedAttachmentName = canary("ArchivedAttachmentOnly");
      const trashedAttachmentId = recordId("trashed-attachment");
      const trashedAttachmentName = canary("TrashedAttachmentOnly");

      await database.insert(fileAttachment).values([
        {
          id: archivedAttachmentId,
          lifecycleStatus: "Archive",
          name: archivedAttachmentName,
          projectId,
          scopeType: "Project",
          workspaceId,
        },
        {
          id: trashedAttachmentId,
          lifecycleStatus: "Trash",
          name: trashedAttachmentName,
          projectId,
          scopeType: "Project",
          workspaceId,
        },
      ]);
      await database.insert(fileAttachmentVersion).values([
        {
          attachmentId: archivedAttachmentId,
          byteSize: 1,
          contentHash: contentHash(),
          detectedMimeType: "text/plain",
          extension: "txt",
          fileName: `${archivedAttachmentName}.txt`,
          id: recordId("archived-attachment-version"),
          mimeType: "text/plain",
          objectKey: recordId("archived-attachment-object"),
          version: 1,
        },
        {
          attachmentId: trashedAttachmentId,
          byteSize: 1,
          contentHash: contentHash(),
          detectedMimeType: "text/plain",
          extension: "txt",
          fileName: `${trashedAttachmentName}.txt`,
          id: recordId("trashed-attachment-version"),
          mimeType: "text/plain",
          objectKey: recordId("trashed-attachment-object"),
          version: 1,
        },
      ]);

      expect(
        await client().searchRecords({ query: archivedAttachmentName }),
      ).toEqual([]);
      expect(
        await client().searchRecords({
          archived: true,
          query: archivedAttachmentName,
        }),
      ).toMatchObject([
        {
          archived: true,
          id: archivedAttachmentId,
          recordType: "File Attachment",
          status: "Archived",
        },
      ]);
      const trashedResults = await Promise.all(
        [false, true].map((archived) =>
          client().searchRecords({
            archived,
            query: trashedAttachmentName,
          }),
        ),
      );
      expect(trashedResults).toEqual([[], []]);
    },
    databaseTestTimeout,
  );

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
    await database
      .update(project)
      .set({ nextConcreteStep: "Inspect PostgreSQL evidence" })
      .where(eq(project.id, projectId));
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

  it("browses prepared work, decision, risk, release, and diagram indexes", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(work).values([
      {
        archivedAt: new Date("2026-09-01T00:00:00Z"),
        id: recordId("index-work-archived"),
        key: "CUR-21",
        number: 21,
        projectId,
        title: "Archived work",
        type: "Task",
      },
      {
        id: recordId("index-work-current"),
        key: "CUR-22",
        number: 22,
        projectId,
        title: "Current work",
        type: "Feature",
      },
      {
        id: recordId("index-work-other-project"),
        key: "OTH-23",
        number: 23,
        projectId: otherProjectId,
        title: "Other project work",
        type: "Task",
      },
    ]);
    await database.insert(decision).values({
      decision: "Keep a bounded index.",
      id: recordId("index-decision"),
      projectId,
      title: "Index decision",
    });
    await database.insert(risk).values({
      id: recordId("index-risk"),
      projectId,
      title: "Index risk",
    });
    await database.insert(projectRelease).values({
      id: recordId("index-release"),
      name: "Index release",
      projectId,
    });
    await database.insert(technicalDiagram).values({
      authorityMode: "Imported Independent Copy",
      id: recordId("index-diagram"),
      model: { links: [], nodes: [] },
      projectId,
      title: "Index diagram",
      type: "Technical Architecture",
    });
    await database.insert(document).values({
      body: "",
      id: recordId("index-document"),
      projectId,
      title: "Index document",
    });
    await database.insert(fileAttachment).values({
      id: recordId("index-file"),
      name: "Index file",
      projectId,
      scopeType: "Project",
      workspaceId,
    });
    await database.insert(fileAttachmentVersion).values({
      attachmentId: recordId("index-file"),
      byteSize: 1,
      contentHash: contentHash(),
      detectedMimeType: "text/plain",
      extension: "txt",
      fileName: "index.txt",
      id: recordId("index-file-version"),
      mimeType: "text/plain",
      objectKey: recordId("index-file-object"),
      version: 1,
    });

    const scopedWork = await client().searchRecords({
      archived: false,
      index: "All Work",
      query: "",
      scope: { kind: "project", projectId },
    });
    expect(scopedWork.map(({ id }) => id)).toEqual([
      recordId("index-work-current"),
    ]);
    expect(scopedWork[0]).toMatchObject({
      category: "Feature",
      recordType: "Work",
      title: "Current work",
    });

    const archivedWork = await client().searchRecords({
      archived: true,
      index: "All Work",
      query: "",
      scope: { kind: "project", projectId },
    });
    expect(archivedWork.map(({ id }) => id)).toEqual([
      recordId("index-work-archived"),
    ]);

    const supportedIndexes = [
      ["All Decisions", "index-decision", "Decision"],
      ["All Risks", "index-risk", "Risk"],
      ["All Project Releases", "index-release", "Project Release"],
      ["All Technical Diagrams", "index-diagram", "Technical Diagram"],
    ] as const;
    const supportedResults = await Promise.all(
      supportedIndexes.map(([index]) =>
        client().searchRecords({
          archived: false,
          index,
          query: "",
          scope: { kind: "project", projectId },
        }),
      ),
    );
    for (const [
      resultIndex,
      [, id, recordType],
    ] of supportedIndexes.entries()) {
      const results = supportedResults[resultIndex];
      expect(results?.map(({ id: resultId }) => resultId)).toEqual([
        recordId(id),
      ]);
      expect(results?.[0]?.recordType).toBe(recordType);
    }

    const diagrams = await client().searchRecords({
      archived: false,
      index: "All Technical Diagrams",
      query: "",
      scope: { kind: "project", projectId },
      type: "Technical Architecture",
    });
    expect(diagrams[0]).toMatchObject({
      authorityMode: "Imported Independent Copy",
      category: "Technical Architecture",
    });

    const modelLessIndexes = [
      "All Research Sessions",
      "All Tests",
      "All Designs",
      "All Sources",
    ] as const;
    const modelLessResults = await Promise.all(
      modelLessIndexes.map((index) =>
        client().searchRecords({
          archived: false,
          index,
          query: "",
          scope: { kind: "project", projectId },
        }),
      ),
    );
    expect(modelLessResults).toEqual(modelLessIndexes.map(() => []));
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
      results.find(({ id }) => id === recordId("attachment-current"))?.snippet,
    ).toContain("PostgreSQL-current.txt");
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

  it("browses All Files once per attachment with scope, type, and Folder filters", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(document).values([
      {
        id: recordId("file-index-engineering-document"),
        projectId,
        title: "Engineering runbook",
        body: "",
        folder: "Engineering",
      },
      {
        id: recordId("file-index-operations-document"),
        projectId,
        title: "Operations runbook",
        body: "",
        folder: "Operations",
      },
      {
        id: recordId("file-index-other-project-document"),
        projectId: otherProjectId,
        title: "Other project runbook",
        body: "",
        folder: "Engineering",
      },
    ]);
    await database.insert(fileAttachment).values([
      {
        id: recordId("file-index-current"),
        name: "Runbook",
        ownerDocumentId: recordId("file-index-engineering-document"),
        currentVersion: 2,
        projectId,
        scopeType: "Project",
        workspaceId,
      },
      {
        id: recordId("file-index-other-folder"),
        name: "Operations PDF",
        ownerDocumentId: recordId("file-index-operations-document"),
        projectId,
        scopeType: "Project",
        workspaceId,
      },
      {
        id: recordId("file-index-other-project"),
        name: "Other project PDF",
        ownerDocumentId: recordId("file-index-other-project-document"),
        projectId: otherProjectId,
        scopeType: "Project",
        workspaceId,
      },
      {
        id: recordId("file-index-archived"),
        name: "Archived runbook",
        lifecycleStatus: "Archive",
        ownerDocumentId: recordId("file-index-engineering-document"),
        projectId,
        scopeType: "Project",
        workspaceId,
      },
    ]);
    await database.insert(fileAttachmentVersion).values([
      {
        id: recordId("file-index-current-v1"),
        attachmentId: recordId("file-index-current"),
        version: 1,
        byteSize: 1,
        contentHash: contentHash(),
        detectedMimeType: "application/pdf",
        extension: "pdf",
        fileName: "runbook-v1.pdf",
        mimeType: "application/pdf",
        objectKey: recordId("file-index-current-object-v1"),
      },
      {
        id: recordId("file-index-current-v2"),
        attachmentId: recordId("file-index-current"),
        version: 2,
        byteSize: 1,
        contentHash: contentHash(),
        detectedMimeType: "application/pdf",
        extension: "pdf",
        fileName: "runbook-v2.pdf",
        mimeType: "application/pdf",
        objectKey: recordId("file-index-current-object-v2"),
      },
      ...(
        [
          ["file-index-other-folder", "operations.pdf"],
          ["file-index-other-project", "other-project.pdf"],
          ["file-index-archived", "archived.pdf"],
        ] as const
      ).map(([attachment, fileName]) => ({
        id: recordId(`${attachment}-version`),
        attachmentId: recordId(attachment),
        version: 1,
        byteSize: 1,
        contentHash: contentHash(),
        detectedMimeType: "application/pdf",
        extension: "pdf",
        fileName,
        mimeType: "application/pdf",
        objectKey: recordId(`${attachment}-object`),
      })),
    ]);

    const input = {
      archived: false,
      folder: "Engineering",
      index: "All Files",
      query: "",
      scope: { kind: "project", projectId },
      type: "pdf",
    } as const;
    const results = await client().searchRecords(input);
    expect(results.map(({ id }) => id)).toEqual([
      recordId("file-index-current"),
    ]);
    expect(results[0]).toMatchObject({
      category: "pdf",
      fileMimeType: "application/pdf",
      fileName: "runbook-v2.pdf",
      folder: "Engineering",
      ownerDocumentId: recordId("file-index-engineering-document"),
      recordType: "File Attachment",
      snippet: expect.stringContaining("runbook-v2.pdf"),
      title: "Runbook",
    });
    expect(results[0]?.snippet).not.toContain("runbook-v1.pdf");

    const archivedResults = await client().searchRecords({
      ...input,
      archived: true,
    });
    expect(archivedResults.map(({ id }) => id)).toEqual([
      recordId("file-index-archived"),
    ]);
  });

  it("browses All Documents with scope, type, Folder, and Archived filters", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(document).values([
      {
        body: "",
        folder: "Engineering",
        id: recordId("document-index-project"),
        projectId,
        title: "Project plan",
        type: "Plan",
      },
      {
        archivedAt: new Date("2026-09-01T00:00:00Z"),
        body: "",
        folder: "Engineering",
        id: recordId("document-index-archived"),
        projectId,
        title: "Archived plan",
        type: "Plan",
      },
      {
        body: "",
        folder: "Research",
        id: recordId("document-index-wiki"),
        title: "Wiki research note",
        type: "Research Note",
        workspaceId,
      },
      {
        body: "",
        folder: "Engineering",
        id: recordId("document-index-other-project"),
        projectId: otherProjectId,
        title: "Other project plan",
        type: "Plan",
      },
    ]);

    const input = {
      archived: false,
      folder: "Engineering",
      index: "All Documents",
      query: "",
      scope: { kind: "project", projectId },
      type: "Plan",
    } as const;
    const results = await client().searchRecords(input);

    expect(results.map(({ id }) => id)).toEqual([
      recordId("document-index-project"),
    ]);
    expect(results[0]).toMatchObject({
      category: "Plan",
      folder: "Engineering",
      recordType: "Document",
      scopeName: "Current Project",
      scopeType: "Project",
      title: "Project plan",
    });

    const wikiResults = await client().searchRecords({
      ...input,
      folder: "Research",
      scope: { kind: "wiki" },
      type: "Research Note",
    });
    expect(wikiResults.map(({ id }) => id)).toEqual([
      recordId("document-index-wiki"),
    ]);

    const archivedResults = await client().searchRecords({
      ...input,
      archived: true,
    });
    expect(archivedResults.map(({ id }) => id)).toEqual([
      recordId("document-index-archived"),
    ]);
  });
});
