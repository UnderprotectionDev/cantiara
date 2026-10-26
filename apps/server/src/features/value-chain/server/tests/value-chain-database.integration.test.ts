// biome-ignore-all lint/performance/noAwaitInLoops: Fixture rows are inserted one at a time.
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import {
  plannedTestCase,
  plannedTestCaseRelation,
  plannedTestCaseVersion,
} from "@cantiara/db/schema/planned-test";
import { project } from "@cantiara/db/schema/project";
import { projectGoal } from "@cantiara/db/schema/project-goal";
import { projectGoalRelation } from "@cantiara/db/schema/project-goal-relation";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { projectReleaseScope } from "@cantiara/db/schema/project-release-planning";
import { workRelation } from "@cantiara/db/schema/relation";
import { work } from "@cantiara/db/schema/work";
import { count, eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseValueChain } from "../value-chain-database";

const url = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("Value Chain PostgreSQL seam", () => {
  const db = url ? createDb({ DATABASE_URL: url }) : undefined;
  const accountId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const goalId = crypto.randomUUID();
  const contributingWork = crypto.randomUUID();
  const strayWork = crypto.randomUUID();
  const decisionId = crypto.randomUUID();
  const relatedDecision = crypto.randomUUID();
  const releaseId = crypto.randomUUID();
  const trashedWork = crypto.randomUUID();
  function chain(id = goalId) {
    if (!db) {
      throw new Error("Test database required");
    }
    return createDatabaseValueChain(db).chain(accountId, {
      goalId: id,
      projectId,
    });
  }
  function goalRelation(
    memberType: string,
    memberId: string,
    kind = "Contributes to Goal",
  ) {
    return {
      goalId,
      id: crypto.randomUUID(),
      kind,
      memberId,
      memberType,
      projectId,
    };
  }
  beforeEach(async () => {
    if (!db) {
      throw new Error("Test database required");
    }
    await db.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await db.insert(project).values({
      id: projectId,
      name: "Chain",
      shortCode: `V${accountId.slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await db.insert(projectGoal).values({
      description: "Reach founders",
      id: goalId,
      projectId,
      revision: 1,
      title: "Reach founders",
    });
    for (const [index, [id, title]] of [
      [contributingWork, "Contributing"],
      [strayWork, "Stray"],
      [trashedWork, "Secret trashed"],
    ].entries()) {
      await db.insert(work).values({
        id: id as string,
        key: `VC-${index + 1}`,
        number: index + 1,
        projectId,
        title: title as string,
        trashedAt: id === trashedWork ? new Date() : null,
        type: "Feature",
      });
    }
    await db.insert(decision).values([
      { decision: "x", id: decisionId, projectId, title: "Small release" },
      { decision: "y", id: relatedDecision, projectId, title: "Loose Karar" },
    ]);
    await db
      .insert(projectRelease)
      .values({ id: releaseId, name: "v1", projectId });
    await db
      .insert(projectGoalRelation)
      .values([
        goalRelation("Work", contributingWork),
        goalRelation("Work", trashedWork),
        goalRelation("Decision", relatedDecision, "Related"),
      ]);
    await db.insert(workRelation).values({
      id: crypto.randomUUID(),
      kind: "Related",
      sourceWorkId: contributingWork,
      targetLabel: "Small release",
      targetProjectId: projectId,
      targetRecordId: decisionId,
      targetRecordType: "Decision",
    });
    await db.insert(projectReleaseScope).values([
      {
        id: crypto.randomUUID(),
        projectId,
        releaseId,
        workId: contributingWork,
      },
      { id: crypto.randomUUID(), projectId, releaseId, workId: strayWork },
    ]);
  });
  afterEach(async () => {
    await db?.delete(user).where(eq(user.id, accountId));
  });
  afterAll(async () => {
    await db?.$client.end();
  });

  test("derives the chain from explicit relations only", async () => {
    const result = await chain();
    const branch = result?.branches.find((b) => b.id === contributingWork);
    expect(branch?.children.map((c) => `${c.type}:${c.id}`).sort()).toEqual(
      [`Decision:${decisionId}`, `Project Release:${releaseId}`].sort(),
    );
    expect(result?.branches.map((b) => b.id)).not.toContain(strayWork);
  });

  test("lists related but not contributing records under Not linked to goal", async () => {
    const ids = (await chain())?.notLinked.map((item) => item.id);
    expect(ids).toContain(relatedDecision);
    expect(ids).toContain(strayWork);
    expect(ids).not.toContain(decisionId);
  });

  test("keeps a trashed end visible without leaking its title", async () => {
    const result = await chain();
    const branch = result?.branches.find((b) => b.id === trashedWork);
    expect(branch).toMatchObject({ title: null, unavailable: "In Trash" });
    expect(JSON.stringify(result)).not.toContain("Secret trashed");
  });

  test("returns null for a Goal that never existed and for a foreign account", async () => {
    expect(await chain(crypto.randomUUID())).toBeNull();
    if (db) {
      expect(
        await createDatabaseValueChain(db).chain(crypto.randomUUID(), {
          goalId,
          projectId,
        }),
      ).toBeNull();
    }
  });

  async function addPlannedTest(targetId: string, title: string) {
    if (!db) {
      throw new Error("Test database required");
    }
    const caseId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    await db.insert(plannedTestCase).values({ id: caseId, projectId });
    await db.insert(plannedTestCaseVersion).values({
      caseId,
      changeKind: "Initial version",
      expectedBehavior: "x",
      id: versionId,
      preconditions: "x",
      purpose: "x",
      scope: "x",
      title,
      version: 1,
    });
    await db.insert(plannedTestCaseRelation).values({
      id: crypto.randomUUID(),
      position: 0,
      targetId,
      targetType: "Work",
      versionId,
    });
    return caseId;
  }

  test("a Related link never counts as a contribution", async () => {
    const result = await chain();
    const everyId = JSON.stringify(result?.branches);
    expect(everyId).not.toContain(relatedDecision);
    const related = result?.notLinked.find((i) => i.id === relatedDecision);
    expect(related?.relation.label).toBe("Related");
  });

  test("a Karar cannot be stored as a contribution to the Goal", async () => {
    await expect(
      db
        ?.insert(projectGoalRelation)
        .values(goalRelation("Decision", decisionId)) ?? Promise.resolve(),
    ).rejects.toThrow();
  });

  test("a test appears only under the Work it targets, never under the Goal or a stray Work", async () => {
    const onChain = await addPlannedTest(contributingWork, "Chain test");
    const onStray = await addPlannedTest(strayWork, "Stray test");
    const result = await chain();
    expect(result?.branches.map((b) => b.type)).not.toContain("Test");
    const branch = result?.branches.find((b) => b.id === contributingWork);
    expect(branch?.children.map((c) => c.id)).toContain(onChain);
    expect(JSON.stringify(result)).not.toContain(onStray);
  });

  test("reading the chain writes no relation, record or status", async () => {
    if (!db) {
      throw new Error("Test database required");
    }
    const tables = [projectGoalRelation, workRelation, work, projectGoal];
    const before = await Promise.all(
      tables.map(async (table) => {
        const [row] = await db.select({ n: count() }).from(table);
        return row?.n;
      }),
    );
    await chain();
    const after = await Promise.all(
      tables.map(async (table) => {
        const [row] = await db.select({ n: count() }).from(table);
        return row?.n;
      }),
    );
    expect(after).toEqual(before);
    const [goal] = await db
      .select()
      .from(projectGoal)
      .where(eq(projectGoal.id, goalId));
    expect(goal?.revision).toBe(1);
  });
});
