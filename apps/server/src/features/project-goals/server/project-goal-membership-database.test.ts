// biome-ignore-all lint/performance/noAwaitInLoops: Membership commands deliberately verify sequential revisions and retries.
import { createDb } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { project } from "@cantiara/db/schema/project";
import { projectGoal } from "@cantiara/db/schema/project-goal";
import { projectGoalRelation } from "@cantiara/db/schema/project-goal-relation";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { workRelation } from "@cantiara/db/schema/relation";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";
import { createDatabaseProjectGoals } from "./project-goals-database";

const url = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("Project Goals membership PostgreSQL seam", () => {
  const db = url ? createDb({ DATABASE_URL: url }) : undefined;
  const accountId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const goalId = crypto.randomUUID();
  const workId = crypto.randomUUID();
  const milestoneId = crypto.randomUUID();
  const releaseId = crypto.randomUUID();
  const decisionId = crypto.randomUUID();
  const assumptionId = crypto.randomUUID();
  const riskId = crypto.randomUUID();
  const questionId = crypto.randomUUID();
  const targets: string[] = [];
  function access() {
    if (!db) {
      throw new Error("Test database required");
    }
    return createDatabaseProjectGoals(db);
  }
  function command(
    memberType = "Work",
    memberId: string = workId,
    kind = "Contributes to Goal",
  ) {
    return {
      projectId,
      goalId,
      memberId,
      memberType,
      kind,
      attached: true,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    } as Parameters<
      NonNullable<ReturnType<typeof access>["membership"]>["setRelation"]
    >[1];
  }
  beforeEach(async () => {
    if (!db) {
      throw new Error("Test database required");
    }
    await db.insert(user).values({
      id: accountId,
      email: `${accountId}@example.invalid`,
      name: "Founder",
    });
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await db.insert(project).values({
      id: projectId,
      workspaceId,
      name: "Membership",
      shortCode: `G${accountId.slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Blank Project",
    });
    await db.insert(projectGoal).values({
      id: goalId,
      projectId,
      title: "Useful release",
      description: "Keep context",
      revision: 1,
    });
    await db.insert(work).values({
      id: workId,
      projectId,
      key: "GOAL-1",
      number: 1,
      title: "Find the problem",
      type: "Research",
      status: "In Progress",
      roadmapHorizon: "Next",
      targetDate: "2026-11-01",
    });
    await db.insert(projectMilestone).values({
      id: milestoneId,
      projectId,
      title: "First feedback",
      status: "Reached",
    });
    await db.insert(projectRelease).values({
      id: releaseId,
      projectId,
      name: "First release",
      status: "Draft",
    });
    await db
      .insert(risk)
      .values({ id: riskId, projectId, title: "Insufficient feedback" });
    await db.insert(decision).values({
      id: decisionId,
      projectId,
      title: "Keep the first release small",
      decision: "Ship a narrow release",
    });
    await db.insert(assumption).values({
      id: assumptionId,
      projectId,
      title: "Founders need context",
      statement: "Context improves return to work",
    });
    await db.insert(openQuestion).values({
      id: questionId,
      projectId,
      title: "Which founders?",
      question: "Who needs context?",
    });
  });
  afterEach(async () => {
    if (!db) {
      return;
    }
    await db
      .delete(mutationStaging)
      .where(eq(mutationStaging.actorId, accountId));
    await db
      .delete(mutationReceipt)
      .where(eq(mutationReceipt.actorId, accountId));
    await db
      .delete(mutationHistory)
      .where(eq(mutationHistory.actorId, accountId));
    if (targets.length) {
      await db
        .delete(mutationTarget)
        .where(inArray(mutationTarget.id, targets));
    }
    targets.length = 0;
    await db.delete(user).where(eq(user.id, accountId));
  });
  afterAll(async () => {
    await db?.$client.end();
  });
  test("attaches typed contributors, retries once, and preserves member and Goal values", async () => {
    const goals = access();
    const before = db
      ? await createDatabaseWorkLifecycle(db).find(accountId, workId)
      : null;
    const goal = await goals.find(accountId, { projectId, id: goalId });
    const input = command();
    const member = await goals.membership?.setRelation(accountId, input);
    expect(member).toMatchObject({
      kind: "Contributes to Goal",
      attached: true,
      revision: 1,
      source: { title: "Find the problem" },
    });
    if (member) {
      targets.push(member.id);
    }
    expect(await goals.membership?.setRelation(accountId, input)).toEqual(
      member,
    );
    for (const [type, id] of [
      ["Milestone", milestoneId],
      ["Project Release", releaseId],
    ]) {
      const next = await goals.membership?.setRelation(
        accountId,
        command(type, id),
      );
      if (next) {
        targets.push(next.id);
      }
      expect(next?.attached).toBe(true);
    }
    const detail = await goals.membership?.detail(accountId, {
      projectId,
      id: goalId,
    });
    expect(detail?.relations.filter((r) => r.attached)).toHaveLength(3);
    expect(detail?.statusMix).toEqual([
      { recordType: "Research", status: "In Progress", count: 1 },
      { recordType: "Milestone", status: "Reached", count: 1 },
    ]);
    expect(detail).not.toHaveProperty("progress");
    expect(detail).not.toHaveProperty("health");
    await goals.membership?.setRelation(accountId, {
      ...input,
      attached: false,
      baseRevision: 1,
      clientIdempotencyKey: "detach",
    });
    expect(
      db ? await createDatabaseWorkLifecycle(db).find(accountId, workId) : null,
    ).toEqual(before);
    expect(await goals.find(accountId, { projectId, id: goalId })).toEqual(
      goal,
    );
    await expect(
      goals.membership?.setRelation(accountId, {
        ...input,
        baseRevision: 0,
        clientIdempotencyKey: "stale",
      }),
    ).rejects.toThrow();
  });
  test("Related never contributes; open uncertainty follows current source state", async () => {
    const goals = access();
    for (const [type, id] of [
      ["Work", workId],
      ["Risk", riskId],
      ["Open Question", questionId],
    ]) {
      const member = await goals.membership?.setRelation(
        accountId,
        command(type, id, "Related"),
      );
      if (member) {
        targets.push(member.id);
      }
    }
    const detail = await goals.membership?.detail(accountId, {
      projectId,
      id: goalId,
    });
    expect(detail?.statusMix).toEqual([]);
    expect(detail?.openQuestionsAndRisks.map((r) => r.title)).toEqual([
      "Insufficient feedback",
      "Which founders?",
    ]);
    expect(
      detail?.openQuestionsAndRisks.every((r) =>
        r.openPath?.startsWith(`/projects/${projectId}#source-`),
      ),
    ).toBe(true);
    await db?.update(risk).set({ life: "Resolved" }).where(eq(risk.id, riskId));
    await db
      ?.update(openQuestion)
      .set({ life: "Answered" })
      .where(eq(openQuestion.id, questionId));
    expect(
      (await goals.membership?.detail(accountId, { projectId, id: goalId }))
        ?.openQuestionsAndRisks,
    ).toEqual([]);
  });
  test("allows source-linked Related Decisions and Assumptions without counting contribution", async () => {
    const goals = access();
    for (const [type, id] of [
      ["Decision", decisionId],
      ["Assumption", assumptionId],
    ]) {
      const member = await goals.membership?.setRelation(
        accountId,
        command(type, id, "Related"),
      );
      expect(member).toMatchObject({
        attached: true,
        kind: "Related",
        source: { recordType: type, recordId: id, unavailable: false },
      });
      if (member) {
        targets.push(member.id);
      }
      expect(member?.source.openPath).toContain("#source-");
    }
    const detail = await goals.membership?.detail(accountId, {
      projectId,
      id: goalId,
    });
    expect(detail?.candidates.map((source) => source.recordType)).toContain(
      "Decision",
    );
    expect(detail?.statusMix).toEqual([]);
    expect(detail?.openQuestionsAndRisks).toEqual([]);
    await expect(
      goals.membership?.setRelation(accountId, command("Decision", decisionId)),
    ).rejects.toThrow();
  });
  test("retains historical membership after member or Goal deletion and isolates ownership and archive", async () => {
    const goals = access();
    const input = command();
    const member = await goals.membership?.setRelation(accountId, input);
    if (member) {
      targets.push(member.id);
    }
    await db?.delete(work).where(eq(work.id, workId));
    const detail = await goals.membership?.detail(accountId, {
      projectId,
      id: goalId,
    });
    expect(detail?.relations[0]).toMatchObject({
      id: member?.id,
      attached: true,
      source: { title: null, status: null, openPath: null, unavailable: true },
    });
    expect(detail?.statusMix).toEqual([]);
    expect(
      await goals.membership?.detail("other-account", {
        projectId,
        id: goalId,
      }),
    ).toBeNull();
    expect(
      await goals.membership?.setRelation(
        "other-account",
        command("Milestone", milestoneId),
      ),
    ).toBeNull();
    await db
      ?.update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, projectId));
    expect(
      await goals.membership?.setRelation(
        accountId,
        command("Milestone", milestoneId),
      ),
    ).toBeNull();
    expect(
      (await goals.membership?.detail(accountId, { projectId, id: goalId }))
        ?.readOnly,
    ).toBe(true);
    await db?.delete(projectGoal).where(eq(projectGoal.id, goalId));
    expect(
      await goals.membership?.detail(accountId, { projectId, id: goalId }),
    ).toBeNull();
  });
  test("rejects forbidden and foreign-project endpoints at the membership seam", async () => {
    for (const type of [
      "Decision",
      "Test",
      "Experiment/Validation",
      "User Research Session",
      "Evidence",
      "Feature",
    ]) {
      await expect(
        access().membership?.setRelation(accountId, command(type)),
      ).rejects.toThrow();
    }
    expect(
      await access().membership?.setRelation(
        accountId,
        command("Work", "missing"),
      ),
    ).toBeNull();
  });
  test("keeps many-to-many pairs and deduplicates live sources while reading current status", async () => {
    const goals = access();
    const secondGoalId = crypto.randomUUID();
    await db?.insert(projectGoal).values({
      id: secondGoalId,
      projectId,
      title: "Second outcome",
      description: "Independent goal",
      revision: 1,
    });
    const first = await goals.membership?.setRelation(accountId, command());
    const second = await goals.membership?.setRelation(accountId, {
      ...command(),
      goalId: secondGoalId,
    });
    if (first) {
      targets.push(first.id);
    }
    if (second) {
      targets.push(second.id);
    }
    expect(first?.id).not.toBe(second?.id);
    await db?.insert(workRelation).values({
      id: crypto.randomUUID(),
      kind: "Related",
      sourceWorkId: workId,
      targetLabel: "Insufficient feedback",
      targetProjectId: projectId,
      targetRecordType: "Risk",
      targetRecordId: riskId,
    });
    const related = await goals.membership?.setRelation(
      accountId,
      command("Risk", riskId, "Related"),
    );
    if (related) {
      targets.push(related.id);
    }
    expect(
      (await goals.membership?.detail(accountId, { projectId, id: goalId }))
        ?.openQuestionsAndRisks,
    ).toHaveLength(1);
    await db
      ?.update(work)
      .set({ status: "Blocked" })
      .where(eq(work.id, workId));
    expect(
      (await goals.membership?.detail(accountId, { projectId, id: goalId }))
        ?.statusMix,
    ).toEqual([{ recordType: "Research", status: "Blocked", count: 1 }]);
    expect(
      (
        await goals.membership?.detail(accountId, {
          projectId,
          id: secondGoalId,
        })
      )?.statusMix,
    ).toEqual([{ recordType: "Research", status: "Blocked", count: 1 }]);
    await goals.membership?.setRelation(accountId, {
      ...command(),
      attached: false,
      baseRevision: 1,
      clientIdempotencyKey: "detach-first",
    });
    expect(
      (
        await goals.membership?.detail(accountId, {
          projectId,
          id: secondGoalId,
        })
      )?.relations[0]?.attached,
    ).toBe(true);
    await db?.delete(projectGoal).where(eq(projectGoal.id, secondGoalId));
    const historical = await db
      ?.select()
      .from(projectGoalRelation)
      .where(eq(projectGoalRelation.id, second?.id ?? ""));
    expect(historical?.[0]).toMatchObject({
      goalId: secondGoalId,
      memberId: workId,
      removedAt: null,
    });
  });
  test("rejects an existing source in another Project and excludes trashed Work", async () => {
    const otherProjectId = crypto.randomUUID();
    const otherWorkId = crypto.randomUUID();
    await db?.insert(project).values({
      id: otherProjectId,
      workspaceId,
      name: "Other Project",
      shortCode: "OTHER",
      starterConfiguration: "Blank Project",
    });
    await db?.insert(work).values({
      id: otherWorkId,
      projectId: otherProjectId,
      key: "OTHER-1",
      number: 1,
      title: "Other Work",
      type: "Task",
    });
    expect(
      await access().membership?.setRelation(
        accountId,
        command("Work", otherWorkId),
      ),
    ).toBeNull();
    const member = await access().membership?.setRelation(accountId, command());
    if (member) {
      targets.push(member.id);
    }
    await db
      ?.update(work)
      .set({ trashedAt: new Date() })
      .where(eq(work.id, workId));
    const detail = await access().membership?.detail(accountId, {
      projectId,
      id: goalId,
    });
    expect(detail?.statusMix).toEqual([]);
    expect(detail?.relations[0]?.source).toMatchObject({
      unavailable: true,
      title: null,
      status: null,
    });
    expect(
      detail?.candidates.some((source) => source.recordId === workId),
    ).toBe(false);
  });
});
