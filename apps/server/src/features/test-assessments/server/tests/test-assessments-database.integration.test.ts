// biome-ignore-all lint/performance/noAwaitInLoops: Each case is asserted in sequence against one store.
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { testHandoff } from "@cantiara/db/schema/planned-test";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import {
  testAssessment,
  testAssessmentSource,
} from "@cantiara/db/schema/test-assessment";
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
  TestAssessmentContextUnavailableError,
  TestAssessmentProjectNotFoundError,
  TestAssessmentProjectReadOnlyError,
  TestAssessmentSourceUnavailableError,
} from "../test-assessments";
import { createDatabaseTestAssessments } from "../test-assessments-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Test Assessments PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const suffix = crypto.randomUUID().slice(0, 8);
  const accountId = `assessments-${suffix}`;
  const otherAccountId = `assessments-other-${suffix}`;
  const workspaceId = `workspace-${suffix}`;
  const otherWorkspaceId = `workspace-other-${suffix}`;
  const projectId = `project-${suffix}`;
  const archivedProjectId = `project-archived-${suffix}`;
  const otherProjectId = `project-other-${suffix}`;
  const ids = {
    feature: `feature-${suffix}`,
    followUp: `follow-up-${suffix}`,
    handoff: `handoff-${suffix}`,
    otherFeature: `other-feature-${suffix}`,
    release: `release-${suffix}`,
    task: `task-${suffix}`,
  };

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
  }

  const input = () => ({
    context: { kind: "Project Release" as const, targetId: ids.release },
    decision: "Acceptable" as const,
    followUpWorkIds: [ids.followUp],
    gapIds: ["gap-1"],
    knownLimits: "Wallet payments were not tried.",
    projectId,
    sessionIds: ["session-1", "session-2"],
  });

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
        id: otherProjectId,
        name: "Other",
        shortCode: `OTH-${suffix.toUpperCase()}`,
        workspaceId: otherWorkspaceId,
      },
    ]);
    await db.insert(work).values([
      {
        id: ids.feature,
        key: `TST-${suffix.toUpperCase()}-1`,
        number: 1,
        projectId,
        title: "Saved cards",
        type: "Feature",
      },
      {
        id: ids.task,
        key: `TST-${suffix.toUpperCase()}-2`,
        number: 2,
        projectId,
        title: "Build checkout",
        type: "Task",
      },
      {
        id: ids.followUp,
        key: `TST-${suffix.toUpperCase()}-3`,
        number: 3,
        projectId,
        title: "Try wallet payments",
        type: "Task",
      },
      {
        id: ids.otherFeature,
        key: `OTH-${suffix.toUpperCase()}-1`,
        number: 1,
        projectId: otherProjectId,
        title: "Other feature",
        type: "Feature",
      },
    ]);
    await db
      .insert(projectRelease)
      .values({ id: ids.release, name: "v1.2", projectId });
    await db.insert(testHandoff).values({
      id: ids.handoff,
      projectId,
      purpose: "Check cards",
      title: "Card handoff",
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

  test("saves a snapshot with exact ids and reads it back with a live context label", async () => {
    const access = createDatabaseTestAssessments(requireDatabase());
    const saved = await access.record(accountId, input());

    expect(saved).toMatchObject({
      assessorAccountId: accountId,
      context: { kind: "Project Release", label: "v1.2" },
      decision: "Acceptable",
      followUpWorkIds: [ids.followUp],
      gapIds: ["gap-1"],
      sessionIds: ["session-1", "session-2"],
    });
    const { assessments } = await access.list(accountId, projectId);
    expect(assessments).toEqual([saved]);

    for (const [kind, targetId, label] of [
      ["Feature", ids.feature, "Saved cards"],
      ["Handoff", ids.handoff, "Card handoff"],
    ] as const) {
      const other = await access.record(accountId, {
        ...input(),
        context: { kind, targetId },
      });
      expect(other.context.label).toBe(label);
    }
  });

  test("the snapshot bytes survive its context being renamed or removed", async () => {
    const db = requireDatabase();
    const access = createDatabaseTestAssessments(db);
    const saved = await access.record(accountId, input());
    await db
      .update(projectRelease)
      .set({ name: "v1.2 renamed" })
      .where(eq(projectRelease.id, ids.release));

    const renamed = await access.list(accountId, projectId);
    expect(renamed.assessments[0]).toMatchObject({
      assessedAt: saved.assessedAt,
      context: { label: "v1.2 renamed" },
      decision: "Acceptable",
      sessionIds: saved.sessionIds,
    });
    await db.delete(projectRelease).where(eq(projectRelease.id, ids.release));
    const gone = await access.list(accountId, projectId);
    expect(gone.assessments[0]).toMatchObject({
      context: { label: null, targetId: ids.release },
      decision: "Acceptable",
      sessionIds: saved.sessionIds,
    });
  });

  test("a second snapshot leaves the first one's decision and cited ids as saved", async () => {
    const db = requireDatabase();
    const access = createDatabaseTestAssessments(db);
    const saved = await access.record(accountId, input());
    await access.record(accountId, { ...input(), decision: "Undecided" });
    const rows = await db
      .select()
      .from(testAssessment)
      .where(eq(testAssessment.id, saved.id));
    expect(rows[0]?.decision).toBe("Acceptable");
    const sources = await db
      .select()
      .from(testAssessmentSource)
      .where(eq(testAssessmentSource.assessmentId, saved.id));
    expect(sources).toHaveLength(4);
    expect(access).not.toHaveProperty("update");
  });

  test("refuses unavailable contexts, follow-up Work and unowned or archived Projects", async () => {
    const access = createDatabaseTestAssessments(requireDatabase());
    await expect(
      access.record(accountId, {
        ...input(),
        context: { kind: "Feature", targetId: ids.otherFeature },
      }),
    ).rejects.toBeInstanceOf(TestAssessmentContextUnavailableError);
    await expect(
      access.record(accountId, {
        ...input(),
        context: { kind: "Feature", targetId: ids.task },
      }),
    ).rejects.toBeInstanceOf(TestAssessmentContextUnavailableError);
    await expect(
      access.record(accountId, {
        ...input(),
        followUpWorkIds: [ids.otherFeature],
      }),
    ).rejects.toBeInstanceOf(TestAssessmentSourceUnavailableError);
    await expect(
      access.record(accountId, { ...input(), projectId: archivedProjectId }),
    ).rejects.toBeInstanceOf(TestAssessmentProjectReadOnlyError);
    await expect(access.record(otherAccountId, input())).rejects.toBeInstanceOf(
      TestAssessmentProjectNotFoundError,
    );
    const { assessments } = await access.list(accountId, projectId);
    expect(assessments).toEqual([]);
  });

  test("trashed and archived Works are unavailable contexts and cited ids", async () => {
    const db = requireDatabase();
    const access = createDatabaseTestAssessments(db);
    const featureSnapshot = await access.record(accountId, {
      ...input(),
      context: { kind: "Feature", targetId: ids.feature },
    });
    await db
      .update(work)
      .set({ trashedAt: new Date() })
      .where(eq(work.id, ids.feature));
    await db
      .update(work)
      .set({ archivedAt: new Date() })
      .where(eq(work.id, ids.followUp));

    // The saved snapshot keeps its bytes; only the live label drops out.
    const { assessments } = await access.list(accountId, projectId);
    expect(assessments[0]?.id).toBe(featureSnapshot.id);
    expect(assessments[0]?.sessionIds).toEqual(featureSnapshot.sessionIds);
    expect(assessments[0]?.context).toMatchObject({
      label: null,
      targetId: ids.feature,
    });

    await expect(
      access.record(accountId, {
        ...input(),
        context: { kind: "Feature", targetId: ids.feature },
      }),
    ).rejects.toBeInstanceOf(TestAssessmentContextUnavailableError);
    await expect(
      access.record(accountId, { ...input(), followUpWorkIds: [ids.followUp] }),
    ).rejects.toBeInstanceOf(TestAssessmentSourceUnavailableError);
    await expect(
      access.contextTargets(accountId, { kind: "Feature", projectId }),
    ).resolves.toEqual([]);

    // Restoring the records makes them available again.
    await db
      .update(work)
      .set({ archivedAt: null, trashedAt: null })
      .where(eq(work.id, ids.feature));
    await db
      .update(work)
      .set({ archivedAt: null, trashedAt: null })
      .where(eq(work.id, ids.followUp));
    await expect(
      access.contextTargets(accountId, { kind: "Feature", projectId }),
    ).resolves.toEqual([
      { id: ids.feature, kind: "Feature", label: "Saved cards" },
    ]);
    await expect(
      access.record(accountId, { ...input(), followUpWorkIds: [ids.followUp] }),
    ).resolves.toMatchObject({ decision: "Acceptable" });
  });

  test("recording leaves the Project Release and an Assessment-free Release untouched", async () => {
    const db = requireDatabase();
    const access = createDatabaseTestAssessments(db);
    const [before] = await db
      .select()
      .from(projectRelease)
      .where(eq(projectRelease.id, ids.release));
    await access.record(accountId, input());
    const [after] = await db
      .select()
      .from(projectRelease)
      .where(eq(projectRelease.id, ids.release));
    expect(after).toEqual(before);
    await expect(
      access.contextTargets(accountId, { kind: "Project Release", projectId }),
    ).resolves.toEqual([
      { id: ids.release, kind: "Project Release", label: "v1.2" },
    ]);
  });
});
