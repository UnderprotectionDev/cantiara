// biome-ignore-all lint/performance/noAwaitInLoops: Each case is asserted in sequence against one store.
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import {
  projectReleaseChecklistItem,
  projectReleaseSignalClose,
} from "@cantiara/db/schema/release-evidence";
import { risk, riskContextRelation } from "@cantiara/db/schema/risk";
import { testAssessment } from "@cantiara/db/schema/test-assessment";
import { testGap, testGapRelation } from "@cantiara/db/schema/test-gap";
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
  ReleaseEvidenceProjectNotFoundError,
  ReleaseEvidenceProjectReadOnlyError,
  ReleaseEvidenceReleaseNotFoundError,
} from "../release-evidence";
import { createDatabaseReleaseEvidence } from "../release-evidence-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Release Evidence Pack PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const suffix = crypto.randomUUID().slice(0, 8);
  const accountId = `evidence-${suffix}`;
  const otherAccountId = `evidence-other-${suffix}`;
  const workspaceId = `workspace-${suffix}`;
  const otherWorkspaceId = `workspace-other-${suffix}`;
  const projectId = `project-${suffix}`;
  const archivedProjectId = `project-archived-${suffix}`;
  const releaseId = `release-${suffix}`;
  const archivedReleaseId = `release-archived-${suffix}`;

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
  }

  const target = () => ({ projectId, releaseId });

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
        name: "Evidence",
        shortCode: `EVD-${suffix.toUpperCase()}`,
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
    ]);
    await db.insert(projectRelease).values([
      { id: releaseId, name: "tidekit 1.0", projectId, status: "Preparing" },
      {
        id: archivedReleaseId,
        name: "Archived release",
        projectId: archivedProjectId,
      },
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

  test("reads related Risks, open Test Gaps and the latest assessment, and names the unread owners", async () => {
    const db = requireDatabase();
    await db.insert(risk).values([
      { id: `risk-open-${suffix}`, projectId, title: "Data loss" },
      {
        id: `risk-done-${suffix}`,
        life: "Resolved",
        projectId,
        title: "Old risk",
      },
    ]);
    await db.insert(riskContextRelation).values([
      {
        id: `rel-a-${suffix}`,
        projectReleaseId: releaseId,
        riskId: `risk-open-${suffix}`,
      },
      {
        id: `rel-b-${suffix}`,
        projectReleaseId: releaseId,
        riskId: `risk-done-${suffix}`,
      },
    ]);
    await db.insert(testGap).values([
      {
        id: `gap-open-${suffix}`,
        projectId,
        rationale: "Never tried",
        title: "Upgrade path",
      },
      {
        id: `gap-met-${suffix}`,
        projectId,
        rationale: "Done",
        state: "Not needed",
        title: "Closed gap",
      },
    ]);
    await db.insert(testGapRelation).values([
      {
        gapId: `gap-open-${suffix}`,
        id: `gr-a-${suffix}`,
        position: 0,
        targetId: releaseId,
        targetType: "Project Release",
      },
      {
        gapId: `gap-met-${suffix}`,
        id: `gr-b-${suffix}`,
        position: 0,
        targetId: releaseId,
        targetType: "Project Release",
      },
    ]);
    await db.insert(testAssessment).values({
      assessorAccountId: accountId,
      contextId: releaseId,
      contextKind: "Project Release",
      decision: "Undecided",
      id: `assessment-${suffix}`,
      projectId,
    });

    const pack = await createDatabaseReleaseEvidence(db).pack(
      accountId,
      target(),
    );
    const reasons = pack.attention.map((row) => row.reason);
    expect(reasons).toContain("open-risk");
    expect(reasons).toContain("open-test-gap");
    expect(
      pack.attention.filter((row) => row.reason === "open-risk"),
    ).toHaveLength(1);
    expect(
      pack.attention.filter((row) => row.reason === "open-test-gap"),
    ).toHaveLength(1);
    const unavailable = pack.attention
      .filter((row) => row.reason === "source-unavailable")
      .map((row) => row.section);
    expect(unavailable).toContain("Scope");
    expect(unavailable).toContain("Publish diff");
    const tests = pack.sections.find((section) => section.section === "Tests");
    expect(
      tests?.rows.some((row) => row.source.recordType === "Test Assessment"),
    ).toBe(true);
    expect(pack.release.status).toBe("Preparing");
  });

  test("keeps the checklist per release and never touches the release row", async () => {
    const db = requireDatabase();
    const access = createDatabaseReleaseEvidence(db);
    const item = await access.addChecklistItem(accountId, {
      ...target(),
      text: "Tag the repo",
    });
    await access.setChecklistItem(accountId, {
      ...target(),
      checked: true,
      itemId: item.id,
    });
    const pack = await access.pack(accountId, target());
    expect(pack.checklist).toEqual([{ ...item, checked: true }]);
    const [release] = await db
      .select()
      .from(projectRelease)
      .where(eq(projectRelease.id, releaseId));
    expect(release?.status).toBe("Preparing");
    expect(release?.revision).toBe(0);
    await access.removeChecklistItem(accountId, {
      ...target(),
      itemId: item.id,
    });
    expect(
      await db
        .select()
        .from(projectReleaseChecklistItem)
        .where(eq(projectReleaseChecklistItem.releaseId, releaseId)),
    ).toEqual([]);
  });

  test("closes the open-scope signal once and idempotently", async () => {
    const db = requireDatabase();
    const access = createDatabaseReleaseEvidence(db);
    await access.closeOpenScopeSignal(accountId, target());
    await access.closeOpenScopeSignal(accountId, target());
    const rows = await db
      .select()
      .from(projectReleaseSignalClose)
      .where(eq(projectReleaseSignalClose.releaseId, releaseId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.signalId).toBe(`published-release-open-scope:${releaseId}`);
  });

  test("refuses another account, an unknown release and a write in an archived Project", async () => {
    const access = createDatabaseReleaseEvidence(requireDatabase());
    await expect(access.pack(otherAccountId, target())).rejects.toBeInstanceOf(
      ReleaseEvidenceProjectNotFoundError,
    );
    await expect(
      access.pack(accountId, { projectId, releaseId: "nope" }),
    ).rejects.toBeInstanceOf(ReleaseEvidenceReleaseNotFoundError);
    await expect(
      access.addChecklistItem(accountId, {
        projectId: archivedProjectId,
        releaseId: archivedReleaseId,
        text: "x",
      }),
    ).rejects.toBeInstanceOf(ReleaseEvidenceProjectReadOnlyError);
    expect(
      (
        await access.pack(accountId, {
          projectId: archivedProjectId,
          releaseId: archivedReleaseId,
        })
      ).readOnly,
    ).toBe(true);
  });
});
