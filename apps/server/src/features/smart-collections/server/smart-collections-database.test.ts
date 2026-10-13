import {
  createSmartCollectionInputSchema,
  SmartCollectionUnavailableError,
  setSmartCollectionSubscriptionInputSchema,
} from "@cantiara/api/smart-collections";
import { createDb } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { risk } from "@cantiara/db/schema/risk";
import {
  smartCollectionAttentionSignal,
  smartCollectionSubscription,
  smartCollectionSubscriptionMembership,
  smartCollectionView,
} from "@cantiara/db/schema/smart-collection";
import { work } from "@cantiara/db/schema/work";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import {
  createDatabaseSmartCollections,
  sweepSmartCollectionSubscriptionSignals,
} from "./smart-collections-database";

const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const databaseTarget = databaseUrl ? new URL(databaseUrl) : undefined;
const databaseHost = databaseTarget?.hostname.replace(/^\[|\]$/g, "");
if (
  databaseTarget &&
  !(
    databaseHost &&
    ["localhost", "127.0.0.1", "::1"].includes(databaseHost) &&
    databaseTarget.pathname.slice(1).startsWith("cantiara_migration_test")
  )
) {
  throw new Error(
    "Smart Collections database tests require a loopback cantiara_migration_test database",
  );
}
const describeDatabase = databaseUrl ? describe : describe.skip;

describe("Smart Collections condition contract", () => {
  const baseInput = {
    clientIdempotencyKey: crypto.randomUUID(),
    projectId: "project-id",
    name: "Current work",
    viewName: "Default",
    presentation: "List" as const,
    conditions: { status: "In Progress" },
  };

  test("accepts a scoped Work collection and structured Document filters", () => {
    expect(
      createSmartCollectionInputSchema.safeParse({
        ...baseInput,
        sourceType: "Work",
        scope: { projectIds: ["project-id", "another-project"] },
      }).success,
    ).toBe(true);
    expect(
      createSmartCollectionInputSchema.safeParse({
        ...baseInput,
        sourceType: "Document",
        conditions: { documentType: "Spec", tag: "launch" },
      }).success,
    ).toBe(true);
    expect(
      createSmartCollectionInputSchema.safeParse({
        ...baseInput,
        sourceType: "Wiki Document",
        conditions: { documentType: "Research Note" },
      }).success,
    ).toBe(true);
  });

  test("keeps Project scope anchored and reserves Workspace scope for Wiki Documents", () => {
    expect(
      createSmartCollectionInputSchema.safeParse({
        ...baseInput,
        sourceType: "Work",
        scope: { projectIds: ["another-project"] },
      }).success,
    ).toBe(false);
    expect(
      createSmartCollectionInputSchema.safeParse({
        ...baseInput,
        sourceType: "Wiki Document",
        scope: { projectIds: ["project-id"] },
        conditions: { documentType: "Research Note" },
      }).success,
    ).toBe(false);
    expect(
      createSmartCollectionInputSchema.safeParse({
        ...baseInput,
        sourceType: "Work",
        scope: { projectIds: [] },
      }).success,
    ).toBe(false);
    expect(
      createSmartCollectionInputSchema.safeParse({
        ...baseInput,
        sourceType: "Work",
        scope: { projectIds: ["project-id", "project-id"] },
      }).success,
    ).toBe(false);
    expect(
      createSmartCollectionInputSchema.safeParse({
        ...baseInput,
        sourceType: "Document",
        conditions: { status: "In Progress" },
      }).success,
    ).toBe(false);
  });

  test("accepts live filters for persisted Project source record types", () => {
    const sourceFilters = [
      ["Decision", "Valid"],
      ["Risk", "Mitigating"],
      ["Assumption", "Confirmed"],
      ["Open Question", "Answered"],
      ["Milestone", "Reached"],
      ["Project Release", "Published"],
      ["Production Incident", "Resolved"],
    ] as const;

    for (const [sourceType, status] of sourceFilters) {
      expect(
        createSmartCollectionInputSchema.safeParse({
          ...baseInput,
          sourceType,
          scope: { projectIds: ["project-id"] },
          conditions: { status },
        }).success,
      ).toBe(true);
    }
    expect(
      createSmartCollectionInputSchema.safeParse({
        ...baseInput,
        sourceType: "Decision",
        conditions: { status: "In Progress" },
      }).success,
    ).toBe(false);
  });

  test("rejects pins, exceptions, query text, and source types outside the issue scope", () => {
    for (const conditions of [
      { pinnedRecordIds: ["record-id"] },
      { exceptions: ["record-id"] },
      { query: "status = 'In Progress'" },
    ]) {
      expect(
        createSmartCollectionInputSchema.safeParse({
          ...baseInput,
          conditions,
        }).success,
      ).toBe(false);
    }
    for (const sourceType of [
      "Screen",
      "User Flow",
      "Project Wall",
      "Moodboard",
      "Technical Diagram",
      "File Attachment",
      "Capture Inbox item",
      "Draft",
      "External Surface",
      "GitHub external record",
    ]) {
      expect(
        createSmartCollectionInputSchema.safeParse({
          ...baseInput,
          sourceType,
        }).success,
      ).toBe(false);
    }
  });

  test("requires Subscribe before Notify on leave", () => {
    expect(
      setSmartCollectionSubscriptionInputSchema.safeParse({
        viewId: "view-id",
        subscribe: false,
        notifyOnLeave: true,
      }),
    ).toMatchObject({
      success: false,
      error: {
        issues: [
          {
            message: "Turn on Subscribe first.",
            path: ["notifyOnLeave"],
          },
        ],
      },
    });
  });
});

describeDatabase(
  "Smart Collections live membership PostgreSQL integration",
  () => {
    const database = databaseUrl
      ? createDb({ DATABASE_URL: databaseUrl })
      : undefined;
    const accountId = `smart-collections-${crypto.randomUUID()}`;
    const workspaceId = `workspace-${crypto.randomUUID()}`;
    const projectAId = `project-${crypto.randomUUID()}`;
    const projectBId = `project-${crypto.randomUUID()}`;
    const shortCode = `S${crypto
      .randomUUID()
      .replaceAll("-", "")
      .slice(0, 4)
      .toUpperCase()}`;

    beforeEach(async () => {
      if (!database) {
        throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      }
      await database.insert(user).values({
        email: `${accountId}@example.invalid`,
        id: accountId,
        name: "Founder",
      });
      await database.insert(workspace).values({
        id: workspaceId,
        ownerAccountId: accountId,
      });
      await database.insert(project).values([
        {
          id: projectAId,
          name: "First project",
          shortCode: `${shortCode}A`,
          starterConfiguration: "Blank Project",
          workspaceId,
        },
        {
          id: projectBId,
          name: "Second project",
          shortCode: `${shortCode}B`,
          starterConfiguration: "Blank Project",
          workspaceId,
        },
      ]);
    });

    afterEach(async () => {
      await database?.delete(user).where(eq(user.id, accountId));
    });

    afterAll(async () => {
      await database?.$client.end();
    });

    test("recomputes Work membership across selected Projects when a condition changes", async () => {
      if (!database) {
        throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      }
      const firstWorkId = `work-${crypto.randomUUID()}`;
      const secondWorkId = `work-${crypto.randomUUID()}`;
      const outsideScopeWorkId = `work-${crypto.randomUUID()}`;
      const outsideProjectId = `project-${crypto.randomUUID()}`;
      const firstCreatedAt = new Date("2026-09-01T08:00:00.000Z");
      const firstStatusChangedAt = new Date("2026-09-03T10:00:00.000Z");
      const secondCreatedAt = new Date("2026-09-02T08:00:00.000Z");
      const secondStatusChangedAt = new Date("2026-09-04T10:00:00.000Z");
      await database.insert(project).values({
        id: outsideProjectId,
        name: "Outside project",
        shortCode: `${shortCode}C`,
        starterConfiguration: "Blank Project",
        workspaceId,
      });
      await database.insert(work).values([
        {
          id: firstWorkId,
          key: `${shortCode}A-1`,
          number: 1,
          projectId: projectAId,
          createdAt: firstCreatedAt,
          effort: "Large",
          status: "In Progress",
          statusChangedAt: firstStatusChangedAt,
          title: "Matching Work A",
          type: "Task",
        },
        {
          id: secondWorkId,
          key: `${shortCode}B-1`,
          number: 1,
          projectId: projectBId,
          createdAt: secondCreatedAt,
          effort: null,
          status: "In Progress",
          statusChangedAt: secondStatusChangedAt,
          title: "Matching Work B",
          type: "Task",
        },
        {
          id: outsideScopeWorkId,
          key: `${shortCode}C-1`,
          number: 1,
          projectId: outsideProjectId,
          status: "In Progress",
          title: "Outside scope Work",
          type: "Task",
        },
      ]);

      const access = createDatabaseSmartCollections(database);
      const view = await access.create(accountId, {
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: projectAId,
        name: "Active work",
        sourceType: "Work",
        scope: { projectIds: [projectAId, projectBId] },
        viewName: "Default",
        presentation: "List",
        conditions: { status: "In Progress" },
      });
      expect(view.works.map(({ id }) => id).sort()).toEqual(
        [firstWorkId, secondWorkId].sort(),
      );
      expect(view.works).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: firstWorkId,
            effort: "Large",
            createdAt: firstCreatedAt.toISOString(),
            statusChangedAt: firstStatusChangedAt.toISOString(),
          }),
          expect.objectContaining({
            id: secondWorkId,
            effort: null,
            createdAt: secondCreatedAt.toISOString(),
            statusChangedAt: secondStatusChangedAt.toISOString(),
          }),
        ]),
      );
      expect(view.works[0]?.membershipReasons).toContain("Status: In Progress");
      expect(
        (await access.listViews(accountId, projectBId)).map(({ id }) => id),
      ).toContain(view.id);
      expect(await access.listViews(accountId, outsideProjectId)).toEqual([]);

      await database
        .update(work)
        .set({ status: "Not Started" })
        .where(eq(work.id, firstWorkId));
      expect(
        (await access.getView(accountId, view.id))?.works.map(({ id }) => id),
      ).toEqual([secondWorkId]);
    });

    test("rejects scope Projects outside the accessible Workspace", async () => {
      if (!database) {
        throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      }
      const otherAccountId = `smart-collections-other-${crypto.randomUUID()}`;
      const otherWorkspaceId = `workspace-${crypto.randomUUID()}`;
      const otherProjectId = `project-${crypto.randomUUID()}`;
      try {
        await database.insert(user).values({
          email: `${otherAccountId}@example.invalid`,
          id: otherAccountId,
          name: "Other founder",
        });
        await database.insert(workspace).values({
          id: otherWorkspaceId,
          ownerAccountId: otherAccountId,
        });
        await database.insert(project).values({
          id: otherProjectId,
          name: "Other workspace project",
          shortCode: `${shortCode}X`,
          starterConfiguration: "Blank Project",
          workspaceId: otherWorkspaceId,
        });

        const access = createDatabaseSmartCollections(database);
        await expect(
          access.create(accountId, {
            clientIdempotencyKey: crypto.randomUUID(),
            projectId: projectAId,
            name: "Cross-workspace collection",
            sourceType: "Work",
            scope: { projectIds: [projectAId, otherProjectId] },
            viewName: "Default",
            presentation: "List",
            conditions: {},
          }),
        ).rejects.toBeInstanceOf(SmartCollectionUnavailableError);
      } finally {
        await database.delete(user).where(eq(user.id, otherAccountId));
      }
    });

    test("matches Documents from metadata, tags, and Project scope without searching body text", async () => {
      if (!database) {
        throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      }
      const matchingDocumentId = `document-${crypto.randomUUID()}`;
      const bodyOnlyDocumentId = `document-${crypto.randomUUID()}`;
      const crossProjectDocumentId = `document-${crypto.randomUUID()}`;
      const outsideScopeDocumentId = `document-${crypto.randomUUID()}`;
      const outsideProjectId = `project-${crypto.randomUUID()}`;
      await database.insert(project).values({
        id: outsideProjectId,
        name: "Outside project",
        shortCode: `${shortCode}C`,
        starterConfiguration: "Blank Project",
        workspaceId,
      });
      await database.insert(document).values([
        {
          id: matchingDocumentId,
          projectId: projectAId,
          title: "Launch specification",
          body: "Structured project document.",
          type: "Spec",
          inlineTags: [
            { tagId: "tag-launch", name: "launch", start: 0, end: 6 },
          ],
        },
        {
          id: bodyOnlyDocumentId,
          projectId: projectAId,
          title: "Unlabelled notes",
          body: "This body mentions launch, but the document has no tag.",
          type: "Spec",
          inlineTags: [],
        },
        {
          id: crossProjectDocumentId,
          projectId: projectBId,
          title: "Other project specification",
          body: "Structured project document.",
          type: "Spec",
          inlineTags: [
            { tagId: "tag-launch", name: "launch", start: 0, end: 6 },
          ],
        },
        {
          id: outsideScopeDocumentId,
          projectId: outsideProjectId,
          title: "Outside project specification",
          body: "Structured project document.",
          type: "Spec",
          inlineTags: [
            { tagId: "tag-launch", name: "launch", start: 0, end: 6 },
          ],
        },
      ]);

      const access = createDatabaseSmartCollections(database);
      const view = await access.create(accountId, {
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: projectAId,
        name: "Launch documents",
        sourceType: "Document",
        scope: { projectIds: [projectAId, projectBId] },
        viewName: "Default",
        presentation: "List",
        conditions: { documentType: "Spec", tag: "launch" },
      });
      expect(view.works).toEqual([]);
      expect(view.documents.map(({ id }) => id).sort()).toEqual(
        [matchingDocumentId, crossProjectDocumentId].sort(),
      );
      expect(view.documents[0]?.membershipReasons).toEqual(
        expect.arrayContaining(["Document type: Spec", "Tag: launch"]),
      );
      expect(
        view.documents.find(({ id }) => id === crossProjectDocumentId)
          ?.membershipReasons,
      ).toContain("Project: Second project");

      await database
        .update(document)
        .set({ inlineTags: [] })
        .where(eq(document.id, matchingDocumentId));
      expect(
        (await access.getView(accountId, view.id))?.documents.map(
          ({ id }) => id,
        ),
      ).toEqual([crossProjectDocumentId]);
    });

    test("recomputes Decision membership when its lifecycle changes", async () => {
      if (!database) {
        throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      }
      const validDecisionId = `decision-${crypto.randomUUID()}`;
      const withdrawnDecisionId = `decision-${crypto.randomUUID()}`;
      await database.insert(decision).values([
        {
          id: validDecisionId,
          projectId: projectAId,
          decision: "Keep the first release focused.",
          life: "Valid",
          title: "First release scope",
        },
        {
          id: withdrawnDecisionId,
          projectId: projectAId,
          decision: "Use the broad launch plan.",
          life: "Withdrawn",
          title: "Old launch scope",
        },
      ]);

      const access = createDatabaseSmartCollections(database);
      const view = await access.create(accountId, {
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: projectAId,
        name: "Valid decisions",
        sourceType: "Decision",
        viewName: "Default",
        presentation: "List",
        conditions: { status: "Valid" },
      });
      expect(view.projectSourceRecords.map(({ id }) => id)).toEqual([
        validDecisionId,
      ]);
      expect(view.projectSourceRecords[0]?.membershipReasons).toContain(
        "Status: Valid",
      );

      await database
        .update(decision)
        .set({ life: "Withdrawn" })
        .where(eq(decision.id, validDecisionId));
      expect(
        (await access.getView(accountId, view.id))?.projectSourceRecords,
      ).toEqual([]);
    });

    test("recomputes live membership for every persisted Project source type", async () => {
      if (!database) {
        throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      }

      const sources = [
        {
          id: `decision-${crypto.randomUUID()}`,
          sourceType: "Decision",
          status: "Valid",
          title: "Collection decision",
          insert: (id: string) =>
            database.insert(decision).values({
              id,
              projectId: projectAId,
              decision: "Keep the first release focused.",
              life: "Valid",
              title: "Collection decision",
            }),
          changeStatus: (id: string) =>
            database
              .update(decision)
              .set({ life: "Withdrawn" })
              .where(eq(decision.id, id)),
        },
        {
          id: `risk-${crypto.randomUUID()}`,
          sourceType: "Risk",
          status: "Mitigating",
          title: "Collection risk",
          insert: (id: string) =>
            database.insert(risk).values({
              id,
              projectId: projectAId,
              life: "Mitigating",
              title: "Collection risk",
            }),
          changeStatus: (id: string) =>
            database
              .update(risk)
              .set({ life: "Resolved" })
              .where(eq(risk.id, id)),
        },
        {
          id: `assumption-${crypto.randomUUID()}`,
          sourceType: "Assumption",
          status: "Confirmed",
          title: "Collection assumption",
          insert: (id: string) =>
            database.insert(assumption).values({
              id,
              projectId: projectAId,
              life: "Confirmed",
              statement: "The release will remain focused.",
              title: "Collection assumption",
            }),
          changeStatus: (id: string) =>
            database
              .update(assumption)
              .set({ life: "Refuted" })
              .where(eq(assumption.id, id)),
        },
        {
          id: `open-question-${crypto.randomUUID()}`,
          sourceType: "Open Question",
          status: "Answered",
          title: "Collection question",
          insert: (id: string) =>
            database.insert(openQuestion).values({
              id,
              projectId: projectAId,
              life: "Answered",
              question: "Which release scope was selected?",
              title: "Collection question",
            }),
          changeStatus: (id: string) =>
            database
              .update(openQuestion)
              .set({ life: "Open" })
              .where(eq(openQuestion.id, id)),
        },
        {
          id: `milestone-${crypto.randomUUID()}`,
          sourceType: "Milestone",
          status: "Reached",
          title: "Collection milestone",
          insert: (id: string) =>
            database.insert(projectMilestone).values({
              id,
              projectId: projectAId,
              status: "Reached",
              title: "Collection milestone",
            }),
          changeStatus: (id: string) =>
            database
              .update(projectMilestone)
              .set({ status: "Abandoned" })
              .where(eq(projectMilestone.id, id)),
        },
        {
          id: `project-release-${crypto.randomUUID()}`,
          sourceType: "Project Release",
          status: "Published",
          title: "Collection release",
          insert: (id: string) =>
            database.insert(projectRelease).values({
              id,
              projectId: projectAId,
              name: "Collection release",
              status: "Published",
            }),
          changeStatus: (id: string) =>
            database
              .update(projectRelease)
              .set({ status: "Cancelled" })
              .where(eq(projectRelease.id, id)),
        },
        {
          id: `production-incident-${crypto.randomUUID()}`,
          sourceType: "Production Incident",
          status: "Resolved",
          title: "Collection incident",
          insert: (id: string) =>
            database.insert(productionIncident).values({
              id,
              occurredAt: new Date("2026-10-01T10:00:00.000Z"),
              projectId: projectAId,
              status: "Resolved",
              title: "Collection incident",
            }),
          changeStatus: (id: string) =>
            database
              .update(productionIncident)
              .set({ status: "Open" })
              .where(eq(productionIncident.id, id)),
        },
      ] as const;

      const access = createDatabaseSmartCollections(database);
      await Promise.all(
        sources.map(async (source) => {
          const view = await access.create(accountId, {
            clientIdempotencyKey: crypto.randomUUID(),
            projectId: projectAId,
            name: `${source.sourceType} collection`,
            sourceType: source.sourceType,
            viewName: "Default",
            presentation: "List",
            conditions: { status: source.status },
          });
          expect(view.projectSourceRecords).toEqual([]);

          await source.insert(source.id);
          expect(
            (await access.getView(accountId, view.id))?.projectSourceRecords,
          ).toEqual([
            {
              id: source.id,
              title: source.title,
              status: source.status,
              projectId: projectAId,
              sourceType: source.sourceType,
              membershipReasons: [
                "Project: First project",
                `Status: ${source.status}`,
              ],
            },
          ]);

          await source.changeStatus(source.id);
          expect(
            (await access.getView(accountId, view.id))?.projectSourceRecords,
          ).toEqual([]);
        }),
      );
    });

    test("keeps Wiki Document membership inside the owning workspace", async () => {
      if (!database) {
        throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      }
      const wikiDocumentId = `document-${crypto.randomUUID()}`;
      await database.insert(document).values({
        id: wikiDocumentId,
        workspaceId,
        title: "Research notes",
        body: "Workspace-owned research.",
        type: "Research Note",
        inlineTags: [],
      });
      const access = createDatabaseSmartCollections(database);
      const view = await access.create(accountId, {
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: projectAId,
        name: "Workspace research",
        sourceType: "Wiki Document",
        viewName: "Default",
        presentation: "List",
        conditions: { documentType: "Research Note" },
      });
      expect(view.documents.map(({ id }) => id)).toEqual([wikiDocumentId]);
      expect(view.documents[0]?.membershipReasons).toContain(
        "Document type: Research Note",
      );
      expect(
        (await access.listViews(accountId, projectBId)).map(({ id }) => id),
      ).toContain(view.id);
    });

    test("emits one registered entry signal for a membership period", async () => {
      if (!database) {
        throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      }
      const workId = `work-${crypto.randomUUID()}`;
      await database.insert(work).values({
        id: workId,
        key: `${shortCode}A-1`,
        number: 1,
        projectId: projectAId,
        status: "Not Started",
        title: "Incoming Work",
        type: "Task",
      });

      const access = createDatabaseSmartCollections(database);
      const view = await access.create(accountId, {
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: projectAId,
        name: "Active Work",
        sourceType: "Work",
        viewName: "Default",
        presentation: "List",
        conditions: { status: "In Progress" },
      });

      expect(view.isSubscribed).toBe(false);
      const subscribed = await access.setSubscription(accountId, {
        viewId: view.id,
        subscribe: true,
        notifyOnLeave: false,
      });
      expect(subscribed).toMatchObject({
        isSubscribed: true,
        notifyOnLeave: false,
      });
      expect(
        (
          await database
            .select({ status: work.status })
            .from(work)
            .where(eq(work.id, workId))
        )[0]?.status,
      ).toBe("Not Started");

      const alternateViewId = `${view.id}:table`;
      await database.insert(smartCollectionView).values({
        id: alternateViewId,
        collectionId: view.collectionId,
        name: "Table",
        presentation: "Table",
      });
      const alternateSubscription = await access.setSubscription(accountId, {
        viewId: alternateViewId,
        subscribe: true,
        notifyOnLeave: true,
      });
      expect(alternateSubscription).toMatchObject({
        id: alternateViewId,
        isSubscribed: true,
        notifyOnLeave: true,
      });
      expect(
        await database
          .select()
          .from(smartCollectionSubscription)
          .where(
            eq(smartCollectionSubscription.collectionId, view.collectionId),
          ),
      ).toHaveLength(1);

      await database
        .update(work)
        .set({ status: "In Progress" })
        .where(eq(work.id, workId));
      await Promise.all([
        access.getView(accountId, view.id),
        access.getView(accountId, alternateViewId),
        sweepSmartCollectionSubscriptionSignals(
          database,
          new Date("2026-10-05T10:05:00.000Z"),
        ),
      ]);

      const signals = await database
        .select()
        .from(smartCollectionAttentionSignal)
        .where(
          eq(smartCollectionAttentionSignal.collectionId, view.collectionId),
        );
      expect(signals).toHaveLength(1);
      expect(signals[0]).toMatchObject({
        eventType: "entry",
        signalType: "smart-collection-entry",
        sourceRecordId: workId,
        sourceRecordType: "Work",
      });
      expect(signals[0]?.reason).toContain("Status: In Progress");
    });

    test("rejects an unregistered attention signal type", async () => {
      if (!database) {
        throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      }
      const access = createDatabaseSmartCollections(database);
      const view = await access.create(accountId, {
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: projectAId,
        name: "Active Work",
        sourceType: "Work",
        viewName: "Default",
        presentation: "List",
        conditions: { status: "In Progress" },
      });

      await expect(
        database.insert(smartCollectionAttentionSignal).values({
          signalId: crypto.randomUUID(),
          subscriptionId: crypto.randomUUID(),
          collectionId: view.collectionId,
          ownerAccountId: accountId,
          eventType: "entry",
          signalType: "unregistered-smart-collection-signal",
          presentation: "Information Flow",
          membershipPeriod: 1,
          sourceRecordType: "Work",
          sourceRecordId: "work-unregistered-signal",
          sourceProjectId: projectAId,
          sourceRecordName: "Unregistered signal",
          sourcePath: `/projects/${projectAId}#work-work-unregistered-signal`,
          reason: "Unregistered signal type",
          occurredAt: new Date("2026-10-05T10:00:00.000Z"),
        }),
      ).rejects.toMatchObject({
        cause: {
          message: expect.stringContaining(
            "smart_collection_attention_signal_type_check",
          ),
        },
      });
    });

    test("keeps existing members silent, then emits an optional leave and a new-period entry", async () => {
      if (!database) {
        throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      }
      const workId = `work-${crypto.randomUUID()}`;
      await database.insert(work).values({
        id: workId,
        key: `${shortCode}A-2`,
        number: 2,
        projectId: projectAId,
        status: "In Progress",
        title: "Existing Work",
        type: "Task",
      });

      const access = createDatabaseSmartCollections(database);
      const view = await access.create(accountId, {
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: projectAId,
        name: "Active Work",
        sourceType: "Work",
        viewName: "Default",
        presentation: "List",
        conditions: { status: "In Progress" },
      });

      await access.setSubscription(accountId, {
        viewId: view.id,
        subscribe: true,
        notifyOnLeave: true,
      });
      expect(
        await database
          .select()
          .from(smartCollectionAttentionSignal)
          .where(
            eq(smartCollectionAttentionSignal.collectionId, view.collectionId),
          ),
      ).toEqual([]);

      await database
        .update(work)
        .set({ status: "Not Started" })
        .where(eq(work.id, workId));
      await access.getView(accountId, view.id);
      await access.getView(accountId, view.id);

      const afterLeave = await database
        .select()
        .from(smartCollectionAttentionSignal)
        .where(
          eq(smartCollectionAttentionSignal.collectionId, view.collectionId),
        );
      expect(afterLeave).toHaveLength(1);
      expect(afterLeave[0]).toMatchObject({
        eventType: "leave",
        membershipPeriod: 1,
        signalType: "smart-collection-entry",
        sourceRecordId: workId,
        sourceRecordType: "Work",
      });
      expect(afterLeave[0]?.reason).toContain("Status: In Progress");

      await database
        .update(work)
        .set({ status: "In Progress" })
        .where(eq(work.id, workId));
      await access.getView(accountId, view.id);
      await access.getView(accountId, view.id);

      const afterReentry = await database
        .select()
        .from(smartCollectionAttentionSignal)
        .where(
          eq(smartCollectionAttentionSignal.collectionId, view.collectionId),
        );
      expect(afterReentry).toHaveLength(2);
      expect(afterReentry).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventType: "entry",
            membershipPeriod: 2,
            signalType: "smart-collection-entry",
            sourceRecordId: workId,
          }),
          expect.objectContaining({
            eventType: "leave",
            membershipPeriod: 1,
            signalType: "smart-collection-entry",
            sourceRecordId: workId,
          }),
        ]),
      );
    });

    test("clears the collection snapshot when unsubscribed and silently reseeds on subscribe", async () => {
      if (!database) {
        throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      }
      const workId = `work-${crypto.randomUUID()}`;
      await database.insert(work).values({
        id: workId,
        key: `${shortCode}A-4`,
        number: 4,
        projectId: projectAId,
        status: "In Progress",
        title: "Existing Work",
        type: "Task",
      });

      const access = createDatabaseSmartCollections(database);
      const view = await access.create(accountId, {
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: projectAId,
        name: "Active Work",
        sourceType: "Work",
        viewName: "Default",
        presentation: "List",
        conditions: { status: "In Progress" },
      });
      const subscribed = await access.setSubscription(accountId, {
        viewId: view.id,
        subscribe: true,
        notifyOnLeave: false,
      });
      const [subscription] = await database
        .select({ id: smartCollectionSubscription.id })
        .from(smartCollectionSubscription)
        .where(eq(smartCollectionSubscription.collectionId, view.collectionId));
      expect(subscription).toBeDefined();
      expect(subscribed).toMatchObject({ isSubscribed: true });
      if (!subscription) {
        throw new Error("Expected a subscription after enabling Subscribe.");
      }
      expect(
        await database
          .select()
          .from(smartCollectionSubscriptionMembership)
          .where(
            eq(
              smartCollectionSubscriptionMembership.subscriptionId,
              subscription.id,
            ),
          ),
      ).toHaveLength(1);

      const unsubscribed = await access.setSubscription(accountId, {
        viewId: view.id,
        subscribe: false,
        notifyOnLeave: false,
      });
      expect(unsubscribed).toMatchObject({
        isSubscribed: false,
        notifyOnLeave: false,
      });
      expect(
        await database
          .select()
          .from(smartCollectionSubscription)
          .where(
            eq(smartCollectionSubscription.collectionId, view.collectionId),
          ),
      ).toEqual([]);
      expect(
        await database
          .select()
          .from(smartCollectionSubscriptionMembership)
          .where(
            eq(
              smartCollectionSubscriptionMembership.subscriptionId,
              subscription.id,
            ),
          ),
      ).toEqual([]);

      const resubscribed = await access.setSubscription(accountId, {
        viewId: view.id,
        subscribe: true,
        notifyOnLeave: false,
      });
      expect(resubscribed).toMatchObject({ isSubscribed: true });
      expect(
        await database
          .select()
          .from(smartCollectionAttentionSignal)
          .where(
            eq(smartCollectionAttentionSignal.collectionId, view.collectionId),
          ),
      ).toEqual([]);
      expect(
        (
          await database
            .select({ status: work.status })
            .from(work)
            .where(eq(work.id, workId))
        )[0]?.status,
      ).toBe("In Progress");
    });

    test("reconciles pending entry and leave signals before unsubscribing", async () => {
      if (!database) {
        throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      }
      const existingMemberId = `work-${crypto.randomUUID()}`;
      const newMemberId = `work-${crypto.randomUUID()}`;
      await database.insert(work).values([
        {
          id: existingMemberId,
          key: `${shortCode}A-5`,
          number: 5,
          projectId: projectAId,
          status: "In Progress",
          title: "Leaving Work",
          type: "Task",
        },
        {
          id: newMemberId,
          key: `${shortCode}A-6`,
          number: 6,
          projectId: projectAId,
          status: "Not Started",
          title: "Entering Work",
          type: "Task",
        },
      ]);

      const access = createDatabaseSmartCollections(database);
      const view = await access.create(accountId, {
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: projectAId,
        name: "Active Work",
        sourceType: "Work",
        viewName: "Default",
        presentation: "List",
        conditions: { status: "In Progress" },
      });
      await access.setSubscription(accountId, {
        viewId: view.id,
        subscribe: true,
        notifyOnLeave: true,
      });

      await database
        .update(work)
        .set({ status: "Not Started" })
        .where(eq(work.id, existingMemberId));
      await database
        .update(work)
        .set({ status: "In Progress" })
        .where(eq(work.id, newMemberId));

      await access.setSubscription(accountId, {
        viewId: view.id,
        subscribe: false,
        notifyOnLeave: false,
      });

      const signals = await database
        .select()
        .from(smartCollectionAttentionSignal)
        .where(
          eq(smartCollectionAttentionSignal.collectionId, view.collectionId),
        );
      expect(signals).toHaveLength(2);
      expect(signals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventType: "leave",
            membershipPeriod: 1,
            signalType: "smart-collection-entry",
            sourceRecordId: existingMemberId,
            sourceRecordType: "Work",
          }),
          expect.objectContaining({
            eventType: "entry",
            membershipPeriod: 1,
            signalType: "smart-collection-entry",
            sourceRecordId: newMemberId,
            sourceRecordType: "Work",
          }),
        ]),
      );
    });

    test("sweeps subscribed views that are not being read", async () => {
      if (!database) {
        throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      }
      const workId = `work-${crypto.randomUUID()}`;
      await database.insert(work).values({
        id: workId,
        key: `${shortCode}A-3`,
        number: 3,
        projectId: projectAId,
        status: "Not Started",
        title: "Unopened Work",
        type: "Task",
      });

      const access = createDatabaseSmartCollections(database);
      const view = await access.create(accountId, {
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: projectAId,
        name: "Active Work",
        sourceType: "Work",
        viewName: "Default",
        presentation: "List",
        conditions: { status: "In Progress" },
      });
      await access.setSubscription(accountId, {
        viewId: view.id,
        subscribe: true,
        notifyOnLeave: false,
      });
      await database
        .update(work)
        .set({ status: "In Progress" })
        .where(eq(work.id, workId));

      await sweepSmartCollectionSubscriptionSignals(
        database,
        new Date("2026-10-05T10:05:00.000Z"),
      );

      const signals = await database
        .select()
        .from(smartCollectionAttentionSignal)
        .where(
          eq(smartCollectionAttentionSignal.collectionId, view.collectionId),
        );
      expect(signals).toHaveLength(1);
      expect(signals[0]).toMatchObject({
        eventType: "entry",
        membershipPeriod: 1,
        signalType: "smart-collection-entry",
        sourceRecordId: workId,
      });
    });
  },
);
