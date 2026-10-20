// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal case is asserted in sequence against one store.
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { plannedTestCaseVersion } from "@cantiara/db/schema/planned-test";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { risk } from "@cantiara/db/schema/risk";
import {
  testGap,
  testGapCaseBind,
  testGapHandoffBind,
  testGapRelation,
} from "@cantiara/db/schema/test-gap";
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

import { createDatabasePlannedTests } from "../../planned-tests/server/planned-tests-database";
import {
  TestGapCaseVersionNotFoundError,
  TestGapHandoffNotFoundError,
  TestGapProjectNotFoundError,
  TestGapProjectReadOnlyError,
  TestGapRelationTargetError,
} from "./test-gaps";
import { createDatabaseTestGaps } from "./test-gaps-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Test Gaps PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const suffix = crypto.randomUUID().slice(0, 8);
  const accountId = `test-gaps-${suffix}`;
  const otherAccountId = `test-gaps-other-${suffix}`;
  const workspaceId = `workspace-${suffix}`;
  const otherWorkspaceId = `workspace-other-${suffix}`;
  const projectId = `project-${suffix}`;
  const archivedProjectId = `project-archived-${suffix}`;
  const siblingProjectId = `project-sibling-${suffix}`;
  const ids = {
    document: `document-${suffix}`,
    feature: `feature-${suffix}`,
    release: `release-${suffix}`,
    risk: `risk-${suffix}`,
    siblingRisk: `sibling-risk-${suffix}`,
    task: `task-${suffix}`,
  };
  const gap = {
    projectId,
    rationale: "Coupon stacking was never tried on mobile.",
    title: "Mobile coupon stacking untested",
  };

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
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
    ]);
    await db.insert(document).values({
      body: "# Checkout {#checkout}\n\n## Payment {#payment}\n\nCard flow.\n",
      id: ids.document,
      projectId,
      revision: 3,
      title: "Checkout spec",
    });
    await db.insert(risk).values([
      { id: ids.risk, projectId, title: "Double charge" },
      { id: ids.siblingRisk, projectId: siblingProjectId, title: "Sibling" },
    ]);
    await db
      .insert(projectRelease)
      .values({ id: ids.release, name: "Release 1.0", projectId });
  });

  afterEach(async () => {
    const db = requireDatabase();
    await db.delete(user).where(eq(user.id, accountId));
    await db.delete(user).where(eq(user.id, otherAccountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("files a Gap with every support family and reads each live", async () => {
    const access = createDatabaseTestGaps(requireDatabase());

    const created = await access.create(accountId, {
      ...gap,
      relations: [
        { targetId: ids.feature, targetType: "Feature" },
        { targetId: ids.task, targetType: "Work" },
        { targetId: ids.risk, targetType: "Risk" },
        {
          documentRevision: 3,
          sectionId: "payment",
          targetId: ids.document,
          targetType: "Document",
        },
        { targetId: ids.release, targetType: "Project Release" },
      ],
    });

    expect(
      created.relations.map(({ label, targetType }) => [targetType, label]),
    ).toEqual([
      ["Feature", "Saved cards"],
      ["Work", "Build checkout"],
      ["Risk", "Double charge"],
      ["Document", "Checkout spec"],
      ["Project Release", "Release 1.0"],
    ]);
    expect(created.relations[3]?.sectionLabel).toBe("Payment");
    expect((await access.list(accountId, projectId)).gaps).toEqual([created]);
  });

  test("refuses a relation that is not an active record of this Project", async () => {
    const access = createDatabaseTestGaps(requireDatabase());

    for (const relation of [
      { targetId: ids.siblingRisk, targetType: "Risk" },
      { targetId: ids.task, targetType: "Feature" },
      { targetId: "missing", targetType: "Project Release" },
      { documentRevision: 2, targetId: ids.document, targetType: "Document" },
    ] as const) {
      await expect(
        access.create(accountId, { ...gap, relations: [relation] }),
      ).rejects.toBeInstanceOf(TestGapRelationTargetError);
    }
    expect((await access.list(accountId, projectId)).gaps).toEqual([]);
  });

  test("stores no result or coverage column and cascades with its Project", async () => {
    const db = requireDatabase();
    const access = createDatabaseTestGaps(db);
    const created = await access.create(accountId, {
      ...gap,
      relations: [{ targetId: ids.risk, targetType: "Risk" }],
    });

    const [row] = await db
      .select()
      .from(testGap)
      .where(eq(testGap.id, created.id));
    expect(Object.keys(row ?? {}).sort()).toEqual([
      "createdAt",
      "id",
      "projectId",
      "rationale",
      "state",
      "stateChangedAt",
      "title",
      "updatedAt",
    ]);
    await db.delete(project).where(eq(project.id, projectId));
    expect(
      await db
        .select()
        .from(testGapRelation)
        .where(eq(testGapRelation.gapId, created.id)),
    ).toEqual([]);
  });

  test("an archived Project is read-only and another account sees nothing", async () => {
    const access = createDatabaseTestGaps(requireDatabase());

    await expect(
      access.create(accountId, { ...gap, projectId: archivedProjectId }),
    ).rejects.toBeInstanceOf(TestGapProjectReadOnlyError);
    expect(await access.list(accountId, archivedProjectId)).toMatchObject({
      readOnly: true,
    });
    await expect(access.list(otherAccountId, projectId)).rejects.toBeInstanceOf(
      TestGapProjectNotFoundError,
    );
  });

  describe("planning", () => {
    const definition = {
      expectedBehavior: "The coupon applies once.",
      preconditions: "Signed-in customer.",
      purpose: "Check coupon stacking.",
      scope: "Mobile.",
      title: "Stack coupons",
    };

    async function stage() {
      const db = requireDatabase();
      const planned = createDatabasePlannedTests(db);
      const access = createDatabaseTestGaps(db);
      const scenario = await planned.create(accountId, {
        ...definition,
        projectId,
      });
      const handoff = await planned.createHandoff(accountId, {
        projectId,
        purpose: "Mobile pass",
        scenarios: [{ caseId: scenario.id, version: 1 }],
        title: "Mobile pass",
      });
      const filed = await access.create(accountId, {
        projectId,
        rationale: "Never tried on mobile.",
        title: "Mobile coupon stacking untested",
      });
      return { access, caseId: scenario.id, filed, handoff, planned };
    }

    test("a bind makes the Gap Planned and never more; an unbind returns it to Open", async () => {
      const { access, caseId, filed, handoff } = await stage();
      expect(filed.state).toBe("Open");

      const withCase = await access.bindCase(accountId, {
        caseId,
        gapId: filed.id,
        projectId,
        version: 1,
      });
      const withBoth = await access.bindHandoff(accountId, {
        gapId: filed.id,
        handoffId: handoff.id,
        projectId,
      });
      const again = await access.bindHandoff(accountId, {
        gapId: filed.id,
        handoffId: handoff.id,
        projectId,
      });

      expect(withCase).toMatchObject({
        caseBinds: [{ caseId, title: "Stack coupons", version: 1 }],
        state: "Planned",
      });
      expect(withBoth.state).toBe("Planned");
      expect(again.handoffBinds).toHaveLength(1);
      await access.unbindCase(accountId, {
        caseId,
        gapId: filed.id,
        projectId,
        version: 1,
      });
      const last = await access.unbindHandoff(accountId, {
        gapId: filed.id,
        handoffId: handoff.id,
        projectId,
      });
      expect(last).toMatchObject({
        caseBinds: [],
        handoffBinds: [],
        state: "Open",
      });
    });

    test("a Session Test and a Handoff moving on leave a Planned Gap Planned and show the Handoff state live", async () => {
      const { access, caseId, filed, handoff, planned } = await stage();
      await access.bindHandoff(accountId, {
        gapId: filed.id,
        handoffId: handoff.id,
        projectId,
      });
      const recorded = await planned.recordSessionTest(accountId, {
        binding: { caseId, version: 1 },
        projectId,
        title: "Stacked coupons on Android",
      });
      for (const [expectedState, to] of [
        ["Draft", "Ready to share"],
        ["Ready to share", "Shared"],
      ] as const) {
        await planned.transitionHandoff(accountId, {
          expectedState,
          handoffId: handoff.id,
          projectId,
          to,
        });
      }
      await planned.linkHandoffSessionTest(accountId, {
        handoffId: handoff.id,
        projectId,
        sessionTestId: recorded.id,
      });

      const [listed] = (await access.list(accountId, projectId)).gaps;
      expect(listed).toMatchObject({
        handoffBinds: [{ handoffState: "Shared" }],
        state: "Planned",
      });
    });

    test("refuses a version, Handoff or Gap of another Project", async () => {
      const db = requireDatabase();
      const { access, caseId, filed } = await stage();
      const sibling = createDatabasePlannedTests(db);
      const siblingCase = await sibling.create(accountId, {
        ...definition,
        projectId: siblingProjectId,
      });
      const siblingHandoff = await sibling.createHandoff(accountId, {
        projectId: siblingProjectId,
        purpose: "Other",
        scenarios: [{ caseId: siblingCase.id, version: 1 }],
        title: "Other",
      });

      await expect(
        access.bindCase(accountId, {
          caseId: siblingCase.id,
          gapId: filed.id,
          projectId,
          version: 1,
        }),
      ).rejects.toBeInstanceOf(TestGapCaseVersionNotFoundError);
      await expect(
        access.bindCase(accountId, {
          caseId,
          gapId: filed.id,
          projectId,
          version: 7,
        }),
      ).rejects.toBeInstanceOf(TestGapCaseVersionNotFoundError);
      await expect(
        access.bindHandoff(accountId, {
          gapId: filed.id,
          handoffId: siblingHandoff.id,
          projectId,
        }),
      ).rejects.toBeInstanceOf(TestGapHandoffNotFoundError);
      expect((await access.list(accountId, projectId)).gaps[0]?.state).toBe(
        "Open",
      );
      expect(await db.select().from(testGapCaseBind)).toEqual([]);
      expect(await db.select().from(testGapHandoffBind)).toEqual([]);
    });

    test("the bind names one exact version row that survives a later version", async () => {
      const db = requireDatabase();
      const { access, caseId, filed, planned } = await stage();
      await access.bindCase(accountId, {
        caseId,
        gapId: filed.id,
        projectId,
        version: 1,
      });

      await planned.createVersion(accountId, {
        ...definition,
        caseId,
        changeKind: "Meaningful change",
        expectedVersion: 1,
        projectId,
        scope: "Mobile and web.",
        title: "Stack coupons everywhere",
      });

      expect(
        (await access.list(accountId, projectId)).gaps[0]?.caseBinds,
      ).toEqual([{ caseId, title: "Stack coupons", version: 1 }]);
      expect(
        await db
          .select({ version: plannedTestCaseVersion.version })
          .from(plannedTestCaseVersion)
          .where(eq(plannedTestCaseVersion.caseId, caseId)),
      ).toHaveLength(2);
    });
  });
});
