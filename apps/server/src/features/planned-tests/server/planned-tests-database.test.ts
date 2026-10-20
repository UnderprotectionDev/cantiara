// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal case is asserted in sequence against one store.
import type { CreatePlannedTestCaseInput } from "@cantiara/api/planned-tests";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import {
  plannedTestCaseRelation,
  plannedTestCaseVersion,
} from "@cantiara/db/schema/planned-test";
import { project } from "@cantiara/db/schema/project";
import { projectGoal } from "@cantiara/db/schema/project-goal";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { risk } from "@cantiara/db/schema/risk";
import { screen } from "@cantiara/db/schema/screen";
import { source, sourceVersion } from "@cantiara/db/schema/source";
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
  PlannedTestCaseNotFoundError,
  PlannedTestNoChangeError,
  PlannedTestProjectNotFoundError,
  PlannedTestProjectReadOnlyError,
  PlannedTestRelationTargetError,
  PlannedTestVersionConflictError,
} from "./planned-tests";
import { createDatabasePlannedTests } from "./planned-tests-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

const content = {
  expectedBehavior: "The order is confirmed and a receipt is shown.",
  preconditions: "A signed-in customer with one item in the cart.",
  purpose: "Confirm checkout completes.",
  scope: "Card payment only; no coupons.",
  title: "Checkout with a saved card",
};

describeDatabase("Planned Tests PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const suffix = crypto.randomUUID().slice(0, 8);
  const accountId = `planned-tests-${suffix}`;
  const otherAccountId = `planned-tests-other-${suffix}`;
  const workspaceId = `workspace-${suffix}`;
  const otherWorkspaceId = `workspace-other-${suffix}`;
  const projectId = `project-${suffix}`;
  const archivedProjectId = `project-archived-${suffix}`;
  const siblingProjectId = `project-sibling-${suffix}`;
  const otherProjectId = `project-other-${suffix}`;
  const ids = {
    decision: `decision-${suffix}`,
    document: `document-${suffix}`,
    feature: `feature-${suffix}`,
    goal: `goal-${suffix}`,
    milestone: `milestone-${suffix}`,
    risk: `risk-${suffix}`,
    screen: `screen-${suffix}`,
    siblingWork: `sibling-work-${suffix}`,
    source: `source-${suffix}`,
    task: `task-${suffix}`,
    workspaceDocument: `workspace-document-${suffix}`,
  };

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
  }

  function newCase(
    overrides: Partial<CreatePlannedTestCaseInput> = {},
  ): CreatePlannedTestCaseInput {
    return { ...content, projectId, ...overrides };
  }

  beforeEach(async () => {
    const db = requireDatabase();
    await db.insert(user).values([
      { email: `${accountId}@example.invalid`, id: accountId, name: "Founder" },
      {
        email: `${otherAccountId}@example.invalid`,
        id: otherAccountId,
        name: "Other",
      },
    ]);
    await db.insert(workspace).values([
      { id: workspaceId, ownerAccountId: accountId },
      { id: otherWorkspaceId, ownerAccountId: otherAccountId },
    ]);
    const base = { starterConfiguration: "Blank Project" as const };
    await db.insert(project).values([
      {
        ...base,
        id: projectId,
        name: "Tests",
        shortCode: `TST-${suffix.toUpperCase()}`,
        workspaceId,
      },
      {
        ...base,
        archivedAt: new Date(),
        id: archivedProjectId,
        name: "Archived",
        shortCode: `ARC-${suffix.toUpperCase()}`,
        workspaceId,
      },
      {
        ...base,
        id: siblingProjectId,
        name: "Sibling",
        shortCode: `SIB-${suffix.toUpperCase()}`,
        workspaceId,
      },
      {
        ...base,
        id: otherProjectId,
        name: "Other",
        shortCode: `OTH-${suffix.toUpperCase()}`,
        workspaceId: otherWorkspaceId,
      },
    ]);
    await db.insert(work).values([
      {
        id: ids.task,
        key: `TST-${suffix.toUpperCase()}-1`,
        number: 1,
        projectId,
        title: "Build checkout",
        type: "Task",
      },
      {
        id: ids.feature,
        key: `TST-${suffix.toUpperCase()}-2`,
        number: 2,
        projectId,
        title: "Saved cards",
        type: "Feature",
      },
      {
        id: ids.siblingWork,
        key: `SIB-${suffix.toUpperCase()}-1`,
        number: 1,
        projectId: siblingProjectId,
        title: "Sibling work",
        type: "Task",
      },
    ]);
    await db.insert(document).values([
      {
        body: "# Checkout {#checkout}\n\n## Payment {#payment}\n\nCard flow.\n",
        id: ids.document,
        projectId,
        revision: 3,
        title: "Checkout spec",
      },
      {
        body: "# Workspace note\n",
        id: ids.workspaceDocument,
        title: "Workspace document",
        workspaceId,
      },
    ]);
    await db.insert(decision).values({
      decision: "Use Stripe",
      id: ids.decision,
      projectId,
      title: "Payment provider",
    });
    await db.insert(risk).values({
      id: ids.risk,
      projectId,
      title: "Double charge",
    });
    await db.insert(projectGoal).values({
      description: "Ship checkout",
      id: ids.goal,
      projectId,
      title: "Launch checkout",
    });
    await db.insert(projectMilestone).values({
      id: ids.milestone,
      projectId,
      title: "Beta",
    });
    await db.insert(source).values({
      id: ids.source,
      projectId,
      revision: 1,
    });
    await db.insert(sourceVersion).values({
      accessedAt: new Date(),
      capturedContent: "Docs",
      revision: 1,
      sourceId: ids.source,
      title: "Stripe docs",
      url: "https://stripe.com/docs",
    });
    await db.insert(screen).values({
      id: ids.screen,
      projectId,
      title: "Checkout screen",
    });
  });

  afterEach(async () => {
    const db = requireDatabase();
    await db.delete(user).where(eq(user.id, accountId));
    await db.delete(user).where(eq(user.id, otherAccountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("versions a case: version 1 stays exact when version 2 is saved", async () => {
    const access = createDatabasePlannedTests(requireDatabase());
    const created = await access.create(
      accountId,
      newCase({ notes: "Retry." }),
    );

    const changed = await access.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Meaningful change",
      expectedBehavior: "The order is confirmed and an email is sent.",
      expectedVersion: 1,
      projectId,
    });

    expect(changed.current).toMatchObject({
      changeKind: "Meaningful change",
      notes: null,
      version: 2,
    });
    expect(
      await access.version(accountId, {
        caseId: created.id,
        projectId,
        version: 1,
      }),
    ).toMatchObject({
      ...content,
      changeKind: "Initial version",
      notes: "Retry.",
      version: 1,
    });
    const rows = await requireDatabase()
      .select()
      .from(plannedTestCaseVersion)
      .where(eq(plannedTestCaseVersion.caseId, created.id));
    expect(rows.map(({ version }) => version).sort()).toEqual([1, 2]);
  });

  test("an editorial change versions too, and a no-op or outdated save is refused", async () => {
    const access = createDatabasePlannedTests(requireDatabase());
    const created = await access.create(accountId, newCase());

    const edited = await access.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Editorial change",
      expectedVersion: 1,
      projectId,
      title: "Checkout with a saved card.",
    });
    expect(edited.current.changeKind).toBe("Editorial change");
    await expect(
      access.createVersion(accountId, {
        ...content,
        caseId: created.id,
        changeKind: "Editorial change",
        expectedVersion: 2,
        projectId,
        title: "Checkout with a saved card.",
      }),
    ).rejects.toBeInstanceOf(PlannedTestNoChangeError);
    await expect(
      access.createVersion(accountId, {
        ...content,
        caseId: created.id,
        changeKind: "Meaningful change",
        expectedVersion: 1,
        projectId,
        purpose: "Competing edit.",
      }),
    ).rejects.toBeInstanceOf(PlannedTestVersionConflictError);
  });

  test("concurrent saves from the same version create exactly one new version", async () => {
    const access = createDatabasePlannedTests(requireDatabase());
    const created = await access.create(accountId, newCase());
    const attempt = (purpose: string) =>
      access.createVersion(accountId, {
        ...content,
        caseId: created.id,
        changeKind: "Meaningful change",
        expectedVersion: 1,
        projectId,
        purpose,
      });

    const results = await Promise.allSettled([attempt("A"), attempt("B")]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const listed = await access.list(accountId, projectId);
    expect(listed.cases[0]?.versions.map(({ version }) => version)).toEqual([
      1, 2,
    ]);
  });

  test("resolves one relation for every owned target family against live owner records", async () => {
    const access = createDatabasePlannedTests(requireDatabase());

    const created = await access.create(
      accountId,
      newCase({
        relations: [
          { targetId: ids.task, targetType: "Work" },
          { targetId: ids.feature, targetType: "Feature" },
          {
            documentRevision: 3,
            sectionId: "payment",
            targetId: ids.document,
            targetType: "Document",
          },
          { targetId: ids.decision, targetType: "Decision" },
          { targetId: ids.risk, targetType: "Risk" },
          { targetId: ids.goal, targetType: "Project Goal" },
          { targetId: ids.milestone, targetType: "Milestone" },
          { targetId: ids.source, targetType: "Source" },
          { targetId: ids.screen, targetType: "Screen" },
        ],
      }),
    );

    expect(
      created.current.relations.map(({ label, state, targetType }) => ({
        label,
        state,
        targetType,
      })),
    ).toEqual([
      { label: "Build checkout", state: "resolved", targetType: "Work" },
      { label: "Saved cards", state: "resolved", targetType: "Feature" },
      { label: "Checkout spec", state: "resolved", targetType: "Document" },
      { label: "Payment provider", state: "resolved", targetType: "Decision" },
      { label: "Double charge", state: "resolved", targetType: "Risk" },
      {
        label: "Launch checkout",
        state: "resolved",
        targetType: "Project Goal",
      },
      { label: "Beta", state: "resolved", targetType: "Milestone" },
      { label: "Stripe docs", state: "resolved", targetType: "Source" },
      { label: "Checkout screen", state: "resolved", targetType: "Screen" },
    ]);
    expect(created.current.relations[2]).toMatchObject({
      documentRevision: 3,
      sectionId: "payment",
      sectionLabel: "Payment",
    });
  });

  test("rejects a target without an owner record, from another Project, of the wrong family or stale", async () => {
    const access = createDatabasePlannedTests(requireDatabase());

    for (const relation of [
      { targetId: "does-not-exist", targetType: "Work" },
      { targetId: ids.siblingWork, targetType: "Work" },
      { targetId: ids.task, targetType: "Feature" },
      { targetId: ids.feature, targetType: "Work" },
      { targetId: ids.task, targetType: "Risk" },
      {
        targetId: ids.workspaceDocument,
        documentRevision: 0,
        targetType: "Document",
      },
      { documentRevision: 2, targetId: ids.document, targetType: "Document" },
      {
        documentRevision: 3,
        sectionId: "gone",
        targetId: ids.document,
        targetType: "Document",
      },
    ] as const) {
      await expect(
        access.create(accountId, newCase({ relations: [relation] })),
      ).rejects.toBeInstanceOf(PlannedTestRelationTargetError);
    }
    expect((await access.list(accountId, projectId)).cases).toEqual([]);
  });

  test("refuses an archived or trashed target for a new relation and reports it broken afterwards", async () => {
    const db = requireDatabase();
    const access = createDatabasePlannedTests(db);
    const created = await access.create(
      accountId,
      newCase({
        relations: [
          { targetId: ids.task, targetType: "Work" },
          { targetId: ids.screen, targetType: "Screen" },
          {
            documentRevision: 3,
            targetId: ids.document,
            targetType: "Document",
          },
          { targetId: ids.risk, targetType: "Risk" },
        ],
      }),
    );
    await db
      .update(work)
      .set({ trashedAt: new Date() })
      .where(eq(work.id, ids.task));
    await db
      .update(screen)
      .set({ archivedAt: new Date() })
      .where(eq(screen.id, ids.screen));
    await db
      .update(document)
      .set({ archivedAt: new Date() })
      .where(eq(document.id, ids.document));
    await db.delete(risk).where(eq(risk.id, ids.risk));

    const relations = (await access.list(accountId, projectId)).cases[0]
      ?.current.relations;

    expect(
      relations?.map(({ brokenReason, label, state }) => ({
        brokenReason,
        label,
        state,
      })),
    ).toEqual([
      { brokenReason: "In Trash", label: null, state: "broken" },
      { brokenReason: "Archived", label: null, state: "broken" },
      { brokenReason: "Archived", label: null, state: "broken" },
      { brokenReason: "Permanently deleted", label: null, state: "broken" },
    ]);
    await expect(
      access.create(
        accountId,
        newCase({ relations: [{ targetId: ids.task, targetType: "Work" }] }),
      ),
    ).rejects.toBeInstanceOf(PlannedTestRelationTargetError);
    const carried = await access.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      purpose: "Confirm checkout completes quickly.",
      relations: [{ targetId: ids.task, targetType: "Work" }],
    });
    expect(carried.current.version).toBe(2);
  });

  test("lists candidate targets of the Project only, with Document revision and sections", async () => {
    const access = createDatabasePlannedTests(requireDatabase());

    const works = await access.relationTargets(accountId, {
      projectId,
      targetType: "Work",
    });
    const features = await access.relationTargets(accountId, {
      projectId,
      targetType: "Feature",
    });
    const documents = await access.relationTargets(accountId, {
      projectId,
      targetType: "Document",
    });

    expect(works.map(({ targetId }) => targetId)).toEqual([ids.task]);
    expect(features.map(({ targetId }) => targetId)).toEqual([ids.feature]);
    expect(documents).toMatchObject([
      {
        documentRevision: 3,
        label: "Checkout spec",
        sections: [
          { id: "checkout", label: "Checkout" },
          { id: "payment", label: "Payment" },
        ],
        targetId: ids.document,
      },
    ]);
  });

  test("stores relations on the version they were saved with", async () => {
    const db = requireDatabase();
    const access = createDatabasePlannedTests(db);
    const created = await access.create(accountId, newCase());
    const changed = await access.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      relations: [{ targetId: ids.risk, targetType: "Risk" }],
    });

    expect(changed.versions[0]?.relations).toEqual([]);
    const rows = await db
      .select()
      .from(plannedTestCaseRelation)
      .where(eq(plannedTestCaseRelation.versionId, changed.current.id));
    expect(rows).toMatchObject([{ targetId: ids.risk, targetType: "Risk" }]);
  });

  test("another account cannot reach the Project, its cases or its targets", async () => {
    const access = createDatabasePlannedTests(requireDatabase());
    const created = await access.create(accountId, newCase());

    for (const run of [
      () => access.list(otherAccountId, projectId),
      () => access.create(otherAccountId, newCase()),
      () =>
        access.version(otherAccountId, {
          caseId: created.id,
          projectId,
          version: 1,
        }),
      () =>
        access.relationTargets(otherAccountId, {
          projectId,
          targetType: "Work",
        }),
    ]) {
      await expect(run()).rejects.toBeInstanceOf(
        PlannedTestProjectNotFoundError,
      );
    }
    await expect(
      access.version(accountId, {
        caseId: created.id,
        projectId: siblingProjectId,
        version: 1,
      }),
    ).rejects.toBeInstanceOf(PlannedTestCaseNotFoundError);
  });

  test("an archived Project stays readable and refuses writes", async () => {
    const access = createDatabasePlannedTests(requireDatabase());

    expect(await access.list(accountId, archivedProjectId)).toEqual({
      cases: [],
      readOnly: true,
    });
    await expect(
      access.create(accountId, newCase({ projectId: archivedProjectId })),
    ).rejects.toBeInstanceOf(PlannedTestProjectReadOnlyError);
  });
});
