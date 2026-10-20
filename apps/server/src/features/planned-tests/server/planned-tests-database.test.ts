// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal case is asserted in sequence against one store.
import type { CreatePlannedTestCaseInput } from "@cantiara/api/planned-tests";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import {
  plannedTestCaseRelation,
  plannedTestCaseVersion,
  sessionTest,
  testHandoff,
  testHandoffAdHocScope,
  testHandoffContextRef,
  testHandoffPackage,
  testHandoffScenario,
} from "@cantiara/db/schema/planned-test";
import { project } from "@cantiara/db/schema/project";
import { projectGoal } from "@cantiara/db/schema/project-goal";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { risk } from "@cantiara/db/schema/risk";
import { screen, screenWireframeVersion } from "@cantiara/db/schema/screen";
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
  PlannedTestVersionNotFoundError,
  SessionTestAlreadyBoundError,
  SessionTestAlreadyInHandoffError,
  TestHandoffLockedError,
  TestHandoffPackageBlockedError,
  TestHandoffPackageStaleError,
  TestHandoffPackageStateError,
  TestHandoffScopeMismatchError,
  TestHandoffStateConflictError,
  TestHandoffTransitionError,
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
    await db.insert(screenWireframeVersion).values([
      { id: `wire-1-${suffix}`, screenId: ids.screen, version: 1 },
      { id: `wire-2-${suffix}`, screenId: ids.screen, version: 2 },
    ]);
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

  test("a Session Test bind stays on its exact version and a late link never rewrites content", async () => {
    const access = createDatabasePlannedTests(requireDatabase());
    const created = await access.create(accountId, newCase());
    const bound = await access.recordSessionTest(accountId, {
      binding: { caseId: created.id, version: 1 },
      projectId,
      title: "Pay with the saved card",
    });
    const adHoc = await access.recordSessionTest(accountId, {
      expectedBehavior: "Tax is shown.",
      projectId,
      purpose: "Check tax display.",
      title: "Tax line",
    });
    await access.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Editorial change",
      expectedVersion: 1,
      projectId,
      scope: "Card payment only; coupons are out of scope.",
    });
    await access.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Meaningful change",
      expectedBehavior: "Changed.",
      expectedVersion: 2,
      projectId,
    });
    const linked = await access.linkSessionTest(accountId, {
      caseId: created.id,
      projectId,
      sessionTestId: adHoc.id,
      version: 3,
    });

    expect(linked).toMatchObject({
      expectedBehavior: "Tax is shown.",
      purpose: "Check tax display.",
    });
    const { sessionTests } = await access.sessionTests(accountId, projectId);
    expect(sessionTests.find(({ id }) => id === bound.id)?.bind).toMatchObject({
      executedVersion: 1,
      pinnedVersion: 1,
      summary: "Bound to v1, current v3",
      validatesCurrentVersion: false,
    });
    expect(sessionTests.find(({ id }) => id === adHoc.id)).toMatchObject({
      bind: {
        executedVersion: null,
        origin: "Linked later",
        pinnedVersion: 3,
        validatesCurrentVersion: false,
      },
      expectedBehavior: "Tax is shown.",
      purpose: "Check tax display.",
    });
    for (const sessionTestId of [bound.id, adHoc.id]) {
      await expect(
        access.linkSessionTest(accountId, {
          caseId: created.id,
          projectId,
          sessionTestId,
          version: 2,
        }),
      ).rejects.toBeInstanceOf(SessionTestAlreadyBoundError);
    }
    await expect(
      access.recordSessionTest(accountId, {
        binding: { caseId: created.id, version: 9 },
        projectId,
        title: "x",
      }),
    ).rejects.toBeInstanceOf(PlannedTestVersionNotFoundError);
    await expect(
      access.recordSessionTest(accountId, {
        binding: { caseId: created.id, version: 1 },
        projectId: siblingProjectId,
        title: "x",
      }),
    ).rejects.toBeInstanceOf(PlannedTestCaseNotFoundError);
    await expect(
      access.sessionTests(otherAccountId, projectId),
    ).rejects.toBeInstanceOf(PlannedTestProjectNotFoundError);
  });

  test("the database refuses a half bind, a moved content split and a missing version", async () => {
    const db = requireDatabase();
    const access = createDatabasePlannedTests(db);
    const created = await access.create(accountId, newCase());
    const base = { id: crypto.randomUUID(), projectId, title: "x" };

    await expect(
      db.insert(sessionTest).values({
        ...base,
        expectedBehavior: "e",
        purpose: "p",
        scenarioId: created.id,
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(sessionTest).values({
        ...base,
        bindOrigin: "Bound when recorded",
        scenarioId: created.id,
        scenarioVersion: 7,
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(sessionTest).values({ ...base, purpose: "p" }),
    ).rejects.toThrow();
  });

  test("a Test Handoff keeps exact versions, moves only as asked and never closes itself", async () => {
    const access = createDatabasePlannedTests(requireDatabase());
    const created = await access.create(accountId, newCase());
    const handoff = await access.createHandoff(accountId, {
      buildContext: { branch: "main", commit: "abc1234" },
      dueDate: "2026-11-02",
      projectId,
      purpose: "Check checkout on staging.",
      scenarios: [{ caseId: created.id, version: 1 }],
      targetExecutor: "Claude Code",
      title: "Checkout round 1",
    });
    await access.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      scope: "Card and wallet.",
    });
    for (const [expectedState, to] of [
      ["Draft", "Ready to share"],
      ["Ready to share", "Shared"],
    ] as const) {
      await access.transitionHandoff(accountId, {
        expectedState,
        handoffId: handoff.id,
        projectId,
        to,
      });
    }
    const arrived = await access.recordSessionTest(accountId, {
      binding: { caseId: created.id, version: 1 },
      projectId,
      title: "Pay with the saved card",
    });
    const linked = await access.linkHandoffSessionTest(accountId, {
      handoffId: handoff.id,
      projectId,
      sessionTestId: arrived.id,
    });

    expect(linked).toMatchObject({
      buildContext: { branch: "main", build: null, commit: "abc1234" },
      dueDate: "2026-11-02",
      packageVersion: 0,
      scenarios: [{ summary: "Pinned to v1, current v2", version: 1 }],
      state: "Shared",
      suggestion: { state: "Result received" },
      targetExecutor: "Claude Code",
    });
    const [listed] = (await access.handoffs(accountId, projectId)).handoffs;
    expect(listed).toMatchObject({
      sessionTests: [{ id: arrived.id }],
      state: "Shared",
    });

    await expect(
      access.transitionHandoff(accountId, {
        expectedState: "Draft",
        handoffId: handoff.id,
        projectId,
        to: "Canceled",
      }),
    ).rejects.toBeInstanceOf(TestHandoffStateConflictError);
    await expect(
      access.transitionHandoff(accountId, {
        expectedState: "Shared",
        handoffId: handoff.id,
        projectId,
        to: "Draft",
      }),
    ).rejects.toBeInstanceOf(TestHandoffTransitionError);
    await expect(
      access.updateHandoff(accountId, {
        handoffId: handoff.id,
        projectId,
        purpose: "Rewritten.",
        title: "x",
      }),
    ).rejects.toBeInstanceOf(TestHandoffLockedError);
    await expect(
      access.linkHandoffSessionTest(accountId, {
        handoffId: handoff.id,
        projectId,
        sessionTestId: arrived.id,
      }),
    ).rejects.toBeInstanceOf(SessionTestAlreadyInHandoffError);
  });

  test("a Test Handoff selects only exact versions of this Project and replaces them while editable", async () => {
    const access = createDatabasePlannedTests(requireDatabase());
    const created = await access.create(accountId, newCase());
    const sibling = await access.create(
      accountId,
      newCase({ projectId: siblingProjectId, title: "Sibling case" }),
    );

    await expect(
      access.createHandoff(accountId, {
        projectId,
        purpose: "p",
        scenarios: [{ caseId: sibling.id, version: 1 }],
        title: "x",
      }),
    ).rejects.toBeInstanceOf(PlannedTestCaseNotFoundError);
    await expect(
      access.createHandoff(accountId, {
        projectId,
        purpose: "p",
        scenarios: [{ caseId: created.id, version: 5 }],
        title: "x",
      }),
    ).rejects.toBeInstanceOf(PlannedTestVersionNotFoundError);
    await expect(
      access.handoffs(otherAccountId, projectId),
    ).rejects.toBeInstanceOf(PlannedTestProjectNotFoundError);
    await expect(
      access.createHandoff(accountId, {
        projectId: archivedProjectId,
        purpose: "p",
        title: "x",
      }),
    ).rejects.toBeInstanceOf(PlannedTestProjectReadOnlyError);

    const handoff = await access.createHandoff(accountId, {
      projectId,
      purpose: "p",
      scenarios: [{ caseId: created.id, version: 1 }],
      title: "x",
    });
    const edited = await access.updateHandoff(accountId, {
      handoffId: handoff.id,
      projectId,
      purpose: "p2",
      scenarios: [],
      title: "x",
    });
    expect(edited.scenarios).toEqual([]);

    // A recorded scope mismatch is refused: v2 was never selected.
    await access.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      scope: "Changed.",
    });
    const onV2 = await access.recordSessionTest(accountId, {
      binding: { caseId: created.id, version: 2 },
      projectId,
      title: "On v2",
    });
    const withV1 = await access.updateHandoff(accountId, {
      handoffId: handoff.id,
      projectId,
      purpose: "p3",
      scenarios: [{ caseId: created.id, version: 1 }],
      title: "x",
    });
    expect(withV1.scenarios).toHaveLength(1);
    await expect(
      access.linkHandoffSessionTest(accountId, {
        handoffId: handoff.id,
        projectId,
        sessionTestId: onV2.id,
      }),
    ).rejects.toBeInstanceOf(TestHandoffScopeMismatchError);
  });

  test("the database refuses a state outside the six, a negative package version and a missing version", async () => {
    const db = requireDatabase();
    const access = createDatabasePlannedTests(db);
    const created = await access.create(accountId, newCase());
    const handoff = await access.createHandoff(accountId, {
      projectId,
      purpose: "p",
      title: "x",
    });

    await expect(
      db
        .update(testHandoff)
        .set({ state: "Passed" })
        .where(eq(testHandoff.id, handoff.id)),
    ).rejects.toThrow();
    await expect(
      db
        .update(testHandoff)
        .set({ packageVersion: -1 })
        .where(eq(testHandoff.id, handoff.id)),
    ).rejects.toThrow();
    await expect(
      db.insert(testHandoffScenario).values({
        caseId: created.id,
        handoffId: handoff.id,
        position: 0,
        version: 9,
      }),
    ).rejects.toThrow();
  });

  test("produces a snapshot package from stored rows, increments the version with it and keeps it after later edits", async () => {
    const db = requireDatabase();
    const access = createDatabasePlannedTests(db);
    const created = await access.create(accountId, newCase());
    const handoff = await access.createHandoff(accountId, {
      adHocScope: [{ expectedBehavior: "Tax shown.", intent: "Tax line." }],
      buildContext: { branch: "main", commit: "abc1234" },
      contextRefs: [
        { kind: "Work", targetId: ids.task },
        { kind: "Feature", targetId: ids.feature },
        {
          documentRevision: 3,
          kind: "Document",
          sectionId: "payment",
          targetId: ids.document,
        },
        { kind: "Wireframe", targetId: ids.screen, wireframeVersion: 2 },
      ],
      environmentPreconditions: "Staging tenant.",
      projectId,
      purpose: "Check checkout.",
      scenarios: [{ caseId: created.id, version: 1 }],
      title: "Round 1",
    });
    const [reloaded] = (await access.handoffs(accountId, projectId)).handoffs;
    expect(reloaded?.contextRefs.map(({ label }) => label)).toEqual([
      "Build checkout",
      "Saved cards",
      "Checkout spec",
      "Checkout screen",
    ]);
    expect(reloaded?.adHocScope).toEqual([
      { expectedBehavior: "Tax shown.", intent: "Tax line." },
    ]);

    // A Draft is not shareable yet.
    await expect(
      access.producePackage(accountId, {
        expectedPackageVersion: 1,
        handoffId: handoff.id,
        previewFingerprint: "a".repeat(64),
        projectId,
      }),
    ).rejects.toBeInstanceOf(TestHandoffPackageStateError);
    await access.transitionHandoff(accountId, {
      expectedState: "Draft",
      handoffId: handoff.id,
      projectId,
      to: "Ready to share",
    });
    const preview = await access.previewPackage(accountId, {
      handoffId: handoff.id,
      projectId,
    });
    expect(preview).toMatchObject({ blockers: [], canProduce: true });
    expect(
      (await db.select().from(testHandoffPackage)).filter(
        ({ handoffId }) => handoffId === handoff.id,
      ),
    ).toEqual([]);

    const first = await access.producePackage(accountId, {
      expectedPackageVersion: 1,
      handoffId: handoff.id,
      previewFingerprint: preview.fingerprint ?? "",
      projectId,
    });
    expect(first.package).toMatchObject({
      handoff_package_version: 1,
      project: { id: projectId, name: "Tests" },
      schema_version: "test-handoff-package/1",
    });
    expect(first.package.document_context).toEqual([
      {
        document_id: ids.document,
        revision: 3,
        section_id: "payment",
        title: "Checkout spec",
      },
    ]);
    const [row] = await db
      .select()
      .from(testHandoff)
      .where(eq(testHandoff.id, handoff.id));
    expect(row).toMatchObject({ packageVersion: 1, state: "Ready to share" });

    // The same confirm cannot claim the version twice.
    await expect(
      access.producePackage(accountId, {
        expectedPackageVersion: 1,
        handoffId: handoff.id,
        previewFingerprint: preview.fingerprint ?? "",
        projectId,
      }),
    ).rejects.toBeInstanceOf(TestHandoffPackageStaleError);

    // Later edits of the case, the Work and the Handoff leave the copy alone.
    await access.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      scope: "Rewritten.",
    });
    await db
      .update(work)
      .set({ title: "Renamed work" })
      .where(eq(work.id, ids.task));
    const stored = await access.packages(accountId, {
      handoffId: handoff.id,
      projectId,
    });
    expect(stored.packages).toHaveLength(1);
    expect(stored.packages[0]?.json).toBe(first.json);
    expect(stored.packages[0]?.markdown).toBe(first.markdown);

    const next = await access.previewPackage(accountId, {
      handoffId: handoff.id,
      projectId,
    });
    const second = await access.producePackage(accountId, {
      expectedPackageVersion: 2,
      handoffId: handoff.id,
      previewFingerprint: next.fingerprint ?? "",
      projectId,
    });
    expect(second.package.work_context[0]?.title).toBe("Renamed work");
    expect(second.package.scenarios[0]?.scope).toBe(content.scope);
    expect(
      (
        await access.packages(accountId, { handoffId: handoff.id, projectId })
      ).packages.map(({ packageVersion }) => packageVersion),
    ).toEqual([2, 1]);
  });

  test("a trashed selection or a secret in a copied case blocks the package, and another account cannot read it", async () => {
    const db = requireDatabase();
    const access = createDatabasePlannedTests(db);
    const token = `ghp_${"a1B2c3D4e5F6g7H8i9J0".repeat(2)}`;
    const leaky = await access.create(
      accountId,
      newCase({ scope: `Sign in with ${token}` }),
    );
    const handoff = await access.createHandoff(accountId, {
      contextRefs: [{ kind: "Work", targetId: ids.task }],
      projectId,
      purpose: "p",
      scenarios: [{ caseId: leaky.id, version: 1 }],
      title: "x",
    });
    await access.transitionHandoff(accountId, {
      expectedState: "Draft",
      handoffId: handoff.id,
      projectId,
      to: "Ready to share",
    });

    const blocked = await access.previewPackage(accountId, {
      handoffId: handoff.id,
      projectId,
    });
    expect(blocked.blockers).toMatchObject([
      { kind: "secret", path: "scenarios[0].scope" },
    ]);
    expect(JSON.stringify(blocked)).not.toContain(token);

    await db
      .update(work)
      .set({ trashedAt: new Date() })
      .where(eq(work.id, ids.task));
    const trashed = await access.previewPackage(accountId, {
      handoffId: handoff.id,
      projectId,
    });
    expect(trashed.blockers.map(({ kind }) => kind)).toEqual(["unavailable"]);
    await expect(
      access.producePackage(accountId, {
        expectedPackageVersion: 1,
        handoffId: handoff.id,
        previewFingerprint: "a".repeat(64),
        projectId,
      }),
    ).rejects.toBeInstanceOf(TestHandoffPackageBlockedError);
    expect(
      (
        await db
          .select()
          .from(testHandoffPackage)
          .where(eq(testHandoffPackage.handoffId, handoff.id))
      ).length,
    ).toBe(0);
    await expect(
      access.packages(otherAccountId, { handoffId: handoff.id, projectId }),
    ).rejects.toBeInstanceOf(PlannedTestProjectNotFoundError);
  });

  test("context refs are exact, Project-scoped and refused by the database when malformed", async () => {
    const db = requireDatabase();
    const access = createDatabasePlannedTests(db);
    const rejected = [
      { kind: "Work" as const, targetId: ids.siblingWork },
      { kind: "Work" as const, targetId: ids.feature },
      {
        documentRevision: 1,
        kind: "Document" as const,
        sectionId: null,
        targetId: ids.document,
      },
      {
        documentRevision: 3,
        kind: "Document" as const,
        sectionId: "missing",
        targetId: ids.document,
      },
      { kind: "Wireframe" as const, targetId: ids.screen, wireframeVersion: 7 },
    ];
    for (const ref of rejected) {
      await expect(
        access.createHandoff(accountId, {
          contextRefs: [ref],
          projectId,
          purpose: "p",
          title: "x",
        }),
      ).rejects.toBeInstanceOf(PlannedTestRelationTargetError);
    }
    const handoff = await access.createHandoff(accountId, {
      adHocScope: [{ expectedBehavior: "b", intent: "i" }],
      projectId,
      purpose: "p",
      title: "x",
    });
    await expect(
      db.insert(testHandoffContextRef).values({
        handoffId: handoff.id,
        kind: "Work",
        position: 0,
        targetId: ids.task,
        wireframeVersion: 1,
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(testHandoffContextRef).values({
        handoffId: handoff.id,
        kind: "Latest",
        position: 0,
        targetId: ids.task,
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(testHandoffPackage).values({
        createdAt: new Date(),
        handoffId: handoff.id,
        json: "{}",
        markdown: "",
        packageVersion: 0,
      }),
    ).rejects.toThrow();
    expect(
      (await db.select().from(testHandoffAdHocScope)).filter(
        ({ handoffId }) => handoffId === handoff.id,
      ),
    ).toHaveLength(1);
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
