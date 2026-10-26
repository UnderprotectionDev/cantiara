import {
  ProductionIncidentConflictError,
  ProductionIncidentFollowUpStaleError,
} from "@cantiara/api/production-incidents";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import {
  githubExternalRecord,
  githubInstallation,
  githubRepositoryLink,
} from "@cantiara/db/schema/github-integration";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import {
  productionIncident,
  productionIncidentFollowUp,
  productionIncidentLink,
} from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createProductionIncidents } from "../../../../production-incidents-wiring";

const url = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("Production Incidents PostgreSQL seam", () => {
  const db = url ? createDb({ DATABASE_URL: url }) : undefined;
  const accountId = crypto.randomUUID();
  const otherAccountId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const otherWorkspaceId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const otherProjectId = crypto.randomUUID();
  const strangerProjectId = crypto.randomUUID();
  const incidentId = crypto.randomUUID();
  const bugId = crypto.randomUUID();
  const taskId = crypto.randomUUID();
  const otherBugId = crypto.randomUUID();
  const pullId = crypto.randomUUID();
  const issueId = crypto.randomUUID();
  const otherPullId = crypto.randomUUID();
  const releaseId = crypto.randomUUID();
  const otherReleaseId = crypto.randomUUID();
  const riskId = crypto.randomUUID();
  const otherRiskId = crypto.randomUUID();
  const decisionId = crypto.randomUUID();
  const otherDecisionId = crypto.randomUUID();
  const targets: string[] = [];

  function database() {
    if (!db) {
      throw new Error("Test database required");
    }
    return db;
  }
  function incidents() {
    return createProductionIncidents(database());
  }
  function envelope() {
    return { baseRevision: 0, clientIdempotencyKey: crypto.randomUUID() };
  }
  function bind(
    targetType: "Bug" | "GitHub PR" | "Project Release" | "Risk" | "Decision",
    targetId: string,
    extra: Partial<{ attached: boolean; incidentId: string }> = {},
  ) {
    return {
      ...envelope(),
      attached: true,
      incidentId,
      projectId,
      targetId,
      targetType,
      ...extra,
    };
  }
  async function counts() {
    const [works, risks, decisions, releases] = await Promise.all([
      database()
        .select({ id: work.id })
        .from(work)
        .where(eq(work.projectId, projectId)),
      database()
        .select({ id: risk.id })
        .from(risk)
        .where(eq(risk.projectId, projectId)),
      database()
        .select({ id: decision.id })
        .from(decision)
        .where(eq(decision.projectId, projectId)),
      database()
        .select({ id: projectRelease.id })
        .from(projectRelease)
        .where(eq(projectRelease.projectId, projectId)),
    ]);
    return [works, risks, decisions, releases].map((rows) => rows.length);
  }

  beforeEach(async () => {
    const d = database();
    await d.insert(user).values([
      { email: `${accountId}@example.invalid`, id: accountId, name: "Founder" },
      {
        email: `${otherAccountId}@example.invalid`,
        id: otherAccountId,
        name: "Stranger",
      },
    ]);
    await d.insert(workspace).values([
      { id: workspaceId, ownerAccountId: accountId },
      { id: otherWorkspaceId, ownerAccountId: otherAccountId },
    ]);
    await d.insert(project).values([
      {
        id: projectId,
        name: "tidekit",
        shortCode: `I${accountId.slice(0, 8).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
      },
      {
        id: otherProjectId,
        name: "second",
        shortCode: `J${accountId.slice(0, 8).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
      },
      {
        id: strangerProjectId,
        name: "stranger",
        shortCode: `K${otherAccountId.slice(0, 8).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId: otherWorkspaceId,
      },
    ]);
    await d.insert(productionIncident).values({
      id: incidentId,
      occurredAt: new Date("2026-10-19T08:00:00.000Z"),
      projectId,
      title: "Checkout outage",
    });
    await d.insert(work).values([
      {
        id: bugId,
        key: "TK-1",
        number: 1,
        projectId,
        status: "In Progress",
        title: "Checkout 500s",
        type: "Bug",
      },
      {
        id: taskId,
        key: "TK-2",
        number: 2,
        projectId,
        status: "Not Started",
        title: "Write runbook",
        type: "Task",
      },
      {
        id: otherBugId,
        key: "SE-1",
        number: 1,
        projectId: otherProjectId,
        status: "Not Started",
        title: "Other Project Bug",
        type: "Bug",
      },
    ]);
    await d.insert(projectRelease).values([
      { id: releaseId, name: "tidekit 1.1", projectId, status: "Preparing" },
      { id: otherReleaseId, name: "second 1.0", projectId: otherProjectId },
    ]);
    await d.insert(risk).values([
      { id: riskId, life: "Open", projectId, title: "Data loss" },
      { id: otherRiskId, projectId: otherProjectId, title: "Other risk" },
    ]);
    await d.insert(decision).values([
      {
        decision: "Use a queue.",
        id: decisionId,
        life: "Valid",
        projectId,
        title: "Use queue",
      },
      {
        decision: "Other.",
        id: otherDecisionId,
        projectId: otherProjectId,
        title: "Other decision",
      },
    ]);
    const installationId = crypto.randomUUID();
    const otherInstallationId = crypto.randomUUID();
    await d.insert(githubInstallation).values([
      {
        accountLogin: "acme",
        connectedByAccountId: accountId,
        id: installationId,
        installationId: Math.floor(Math.random() * 1e9),
        projectId,
      },
      {
        accountLogin: "acme",
        connectedByAccountId: accountId,
        id: otherInstallationId,
        installationId: Math.floor(Math.random() * 1e9),
        projectId: otherProjectId,
      },
    ]);
    const repositoryLinkId = crypto.randomUUID();
    const otherRepositoryLinkId = crypto.randomUUID();
    await d.insert(githubRepositoryLink).values([
      {
        htmlUrl: "https://github.com/acme/tidekit",
        id: repositoryLinkId,
        installationRowId: installationId,
        name: "tidekit",
        owner: "acme",
        projectId,
        repositoryId: Math.floor(Math.random() * 1e9),
      },
      {
        htmlUrl: "https://github.com/acme/second",
        id: otherRepositoryLinkId,
        installationRowId: otherInstallationId,
        name: "second",
        owner: "acme",
        projectId: otherProjectId,
        repositoryId: Math.floor(Math.random() * 1e9),
      },
    ]);
    const record = (
      id: string,
      kind: "Issue" | "Pull request",
      number: number,
      owner: { linkId: string; projectId: string },
    ) => ({
      githubId: Math.floor(Math.random() * 1e9),
      htmlUrl: `https://github.com/acme/tidekit/pull/${number}`,
      id,
      kind,
      linkId: owner.linkId,
      number,
      projectId: owner.projectId,
      sourceState: kind === "Pull request" ? "merged" : "open",
      sourceUpdatedAt: new Date("2026-10-19T09:00:00.000Z"),
      title: kind === "Pull request" ? "Fix checkout" : "Checkout broken",
    });
    await d.insert(githubExternalRecord).values([
      record(pullId, "Pull request", 42, {
        linkId: repositoryLinkId,
        projectId,
      }),
      record(issueId, "Issue", 41, { linkId: repositoryLinkId, projectId }),
      record(otherPullId, "Pull request", 7, {
        linkId: otherRepositoryLinkId,
        projectId: otherProjectId,
      }),
    ]);
  });

  afterEach(async () => {
    if (!db) {
      return;
    }
    const actors = [accountId, otherAccountId];
    await db
      .delete(mutationStaging)
      .where(inArray(mutationStaging.actorId, actors));
    await db
      .delete(mutationReceipt)
      .where(inArray(mutationReceipt.actorId, actors));
    await db
      .delete(mutationHistory)
      .where(inArray(mutationHistory.actorId, actors));
    if (targets.length) {
      await db
        .delete(mutationTarget)
        .where(inArray(mutationTarget.id, targets));
    }
    targets.length = 0;
    await db.delete(user).where(inArray(user.id, [accountId, otherAccountId]));
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  test("binds a Bug, GitHub PR, Project Release, Risk and Decision without writing any of them", async () => {
    const seam = incidents();
    const before = await counts();
    const added = await Promise.all(
      (
        [
          ["Bug", bugId],
          ["GitHub PR", pullId],
          ["Project Release", releaseId],
          ["Risk", riskId],
          ["Decision", decisionId],
        ] as const
      ).map(([type, id]) => seam.setLink(accountId, bind(type, id))),
    );
    for (const link of added) {
      expect(link).toMatchObject({ attached: true, revision: 1 });
      if (link) {
        targets.push(link.id);
      }
    }
    expect(added).toHaveLength(5);
    expect(await counts()).toEqual(before);

    const detail = await seam.detail(accountId, { incidentId, projectId });
    expect(
      detail?.links
        .map((link) => [link.target.type, link.target.status])
        .sort(),
    ).toEqual([
      ["Bug", "In Progress"],
      ["Decision", "Valid"],
      ["GitHub PR", "merged"],
      ["Project Release", "Preparing"],
      ["Risk", "Open"],
    ]);
    expect(detail?.incident.status).toBe("Open");
    // The other direction is never written, and no source status changed.
    const [bug] = await database()
      .select()
      .from(work)
      .where(eq(work.id, bugId));
    expect(bug).toMatchObject({ revision: 0, status: "In Progress" });
    const [release] = await database()
      .select()
      .from(projectRelease)
      .where(eq(projectRelease.id, releaseId));
    expect(release).toMatchObject({ revision: 0, status: "Preparing" });
    const [riskRow] = await database()
      .select()
      .from(risk)
      .where(eq(risk.id, riskId));
    expect(riskRow).toMatchObject({ life: "Open", revision: 0 });
    const [decisionRow] = await database()
      .select()
      .from(decision)
      .where(eq(decision.id, decisionId));
    expect(decisionRow).toMatchObject({ life: "Valid", revision: 0 });
  });

  test("an identical repeated add reuses its row; unbind keeps the row and a re-add re-attaches it", async () => {
    const seam = incidents();
    const command = bind("Bug", bugId);
    const first = await seam.setLink(accountId, command);
    expect(first).toMatchObject({ revision: 1 });
    if (!first) {
      throw new Error("Bug was not bound");
    }
    targets.push(first.id);
    expect(await seam.setLink(accountId, command)).toEqual(first);
    const removed = await seam.setLink(accountId, {
      ...bind("Bug", bugId, { attached: false }),
      baseRevision: 1,
    });
    expect(removed).toMatchObject({
      attached: false,
      id: first.id,
      revision: 2,
    });
    const rows = await database()
      .select()
      .from(productionIncidentLink)
      .where(eq(productionIncidentLink.incidentId, incidentId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.removedAt).not.toBeNull();

    const readded = await seam.setLink(accountId, {
      ...bind("Bug", bugId),
      baseRevision: 2,
    });
    expect(readded).toMatchObject({
      attached: true,
      id: first.id,
      revision: 3,
    });
    await expect(
      seam.setLink(accountId, {
        ...bind("Bug", bugId, { attached: false }),
        baseRevision: 0,
      }),
    ).rejects.toBeInstanceOf(ProductionIncidentConflictError);
  });

  test("rejects a non-Bug Work, an Issue, cross-Project records, foreign incidents and other accounts", async () => {
    const seam = incidents();
    expect(await seam.setLink(accountId, bind("Bug", taskId))).toBeNull();
    expect(
      await seam.setLink(accountId, bind("GitHub PR", issueId)),
    ).toBeNull();
    expect(await seam.setLink(accountId, bind("Bug", otherBugId))).toBeNull();
    expect(
      await seam.setLink(accountId, bind("GitHub PR", otherPullId)),
    ).toBeNull();
    expect(
      await seam.setLink(accountId, bind("Project Release", otherReleaseId)),
    ).toBeNull();
    expect(await seam.setLink(accountId, bind("Risk", otherRiskId))).toBeNull();
    expect(
      await seam.setLink(accountId, bind("Decision", otherDecisionId)),
    ).toBeNull();
    // A target id does not pass as another type.
    expect(await seam.setLink(accountId, bind("Risk", bugId))).toBeNull();
    // Another account and a foreign Project or incident id.
    expect(await seam.setLink(otherAccountId, bind("Bug", bugId))).toBeNull();
    expect(
      await seam.setLink(accountId, {
        ...bind("Bug", bugId),
        projectId: otherProjectId,
      }),
    ).toBeNull();
    expect(
      await seam.detail(otherAccountId, { incidentId, projectId }),
    ).toBeNull();
    expect(
      await seam.detail(accountId, {
        incidentId,
        projectId: otherProjectId,
      }),
    ).toBeNull();
    expect(await seam.overview(otherAccountId, projectId)).toBeNull();
    expect(
      await database()
        .select({ id: productionIncidentLink.id })
        .from(productionIncidentLink)
        .where(eq(productionIncidentLink.incidentId, incidentId)),
    ).toEqual([]);
    // The database refuses a cross-Project Work key even without the adapter.
    await expect(
      database().insert(productionIncidentLink).values({
        id: crypto.randomUUID(),
        incidentId,
        projectId,
        targetType: "Bug",
        workId: otherBugId,
      }),
    ).rejects.toThrow();
  });

  test("changing the incident status keeps the links, and the links never move the status", async () => {
    const seam = incidents();
    const link = await seam.setLink(accountId, bind("Risk", riskId));
    if (link) {
      targets.push(link.id);
    }
    // The explicit status change is the Project source record path; the seam
    // only reads it back with the links intact.
    await database()
      .update(productionIncident)
      .set({ status: "Watching" })
      .where(eq(productionIncident.id, incidentId));
    const detail = await seam.detail(accountId, { incidentId, projectId });
    expect(detail?.incident.status).toBe("Watching");
    expect(detail?.links.filter((row) => row.attached)).toHaveLength(1);
    const [riskRow] = await database()
      .select()
      .from(risk)
      .where(eq(risk.id, riskId));
    expect(riskRow?.life).toBe("Open");
  });

  describe("follow-up work", () => {
    const choice = {
      incidentId,
      projectId,
      title: "Add a checkout canary",
      workType: "Task" as const,
    };
    function commitOf(fingerprint: string, workId = crypto.randomUUID()) {
      return {
        ...envelope(),
        ...choice,
        previewFingerprint: fingerprint,
        workId,
      };
    }
    async function workCount() {
      return (
        await database()
          .select({ id: work.id })
          .from(work)
          .where(eq(work.projectId, projectId))
      ).length;
    }

    test("the preview writes nothing and shows the Work and the Origin relation", async () => {
      const seam = incidents();
      const before = await counts();
      const preview = await seam.previewFollowUp(accountId, choice);
      expect(preview?.plan.work).toMatchObject({
        status: "Not Started",
        title: "Add a checkout canary",
        type: "Task",
      });
      expect(preview?.plan.relations).toMatchObject([
        { from: { id: incidentId }, kind: "Origin" },
      ]);
      expect(await counts()).toEqual(before);
      expect(
        await database().select().from(productionIncidentFollowUp),
      ).toEqual([]);
    });

    test("a commit without the matching preview is rejected and writes nothing", async () => {
      const seam = incidents();
      const before = await counts();
      await expect(
        seam.createFollowUp(accountId, commitOf("not-the-preview")),
      ).rejects.toBeInstanceOf(ProductionIncidentFollowUpStaleError);
      // A preview of another choice does not authorize this one.
      const other = await seam.previewFollowUp(accountId, {
        ...choice,
        workType: "Research",
      });
      await expect(
        seam.createFollowUp(accountId, commitOf(other?.fingerprint ?? "")),
      ).rejects.toBeInstanceOf(ProductionIncidentFollowUpStaleError);
      expect(await counts()).toEqual(before);
    });

    test("an approved commit creates exactly one Work with the incident as Origin and leaves the incident alone", async () => {
      const seam = incidents();
      const records = await database()
        .select()
        .from(productionIncident)
        .where(eq(productionIncident.id, incidentId));
      const before = await counts();
      const preview = await seam.previewFollowUp(accountId, choice);
      if (!preview) {
        throw new Error("Preview required");
      }
      const command = commitOf(preview.fingerprint);
      const created = await seam.createFollowUp(accountId, command);
      targets.push(command.workId);
      expect(created).toMatchObject({
        id: command.workId,
        work: {
          status: "Not Started",
          title: "Add a checkout canary",
          type: "Task",
        },
      });
      const [workRow] = await database()
        .select()
        .from(work)
        .where(eq(work.id, command.workId));
      expect(workRow).toMatchObject({
        originOwnerRecordId: incidentId,
        projectId,
      });
      // Only the one Work: no Bug, Risk, Decision or Release appears.
      const [works, risks, decisions, releases] = await counts();
      const [workBefore = 0, ...rest] = before;
      expect([works, risks, decisions, releases]).toEqual([
        workBefore + 1,
        ...rest,
      ]);
      const [incidentRow] = await database()
        .select()
        .from(productionIncident)
        .where(eq(productionIncident.id, incidentId));
      expect(incidentRow).toEqual(records[0]);
      expect(incidentRow?.status).toBe("Open");
      const detail = await seam.detail(accountId, { incidentId, projectId });
      expect(detail?.followUps.map((row) => row.work.id)).toEqual([
        command.workId,
      ]);
      // A retry with the same key returns the same result without a second Work.
      expect(await seam.createFollowUp(accountId, command)).toEqual(created);
      expect(await workCount()).toBe(workBefore + 1);
    });

    test("an incident that changed after the preview makes the commit stale", async () => {
      const seam = incidents();
      const preview = await seam.previewFollowUp(accountId, choice);
      await database()
        .update(productionIncident)
        .set({ revision: 1, status: "Watching" })
        .where(eq(productionIncident.id, incidentId));
      const before = await workCount();
      await expect(
        seam.createFollowUp(accountId, commitOf(preview?.fingerprint ?? "")),
      ).rejects.toBeInstanceOf(ProductionIncidentFollowUpStaleError);
      expect(await workCount()).toBe(before);
    });

    test("a status-only change after the preview makes the commit stale", async () => {
      const seam = incidents();
      const preview = await seam.previewFollowUp(accountId, choice);
      await database()
        .update(productionIncident)
        .set({ status: "Resolved" })
        .where(eq(productionIncident.id, incidentId));
      const before = await workCount();
      await expect(
        seam.createFollowUp(accountId, commitOf(preview?.fingerprint ?? "")),
      ).rejects.toBeInstanceOf(ProductionIncidentFollowUpStaleError);
      expect(await workCount()).toBe(before);
    });

    test("a Task follow-up creates no Bug", async () => {
      const seam = incidents();
      const bugsIn = async () =>
        (
          await database()
            .select({ id: work.id })
            .from(work)
            .where(and(eq(work.projectId, projectId), eq(work.type, "Bug")))
        ).length;
      const before = await bugsIn();
      const preview = await seam.previewFollowUp(accountId, choice);
      const command = commitOf(preview?.fingerprint ?? "");
      await seam.createFollowUp(accountId, command);
      targets.push(command.workId);
      expect(await bugsIn()).toBe(before);
    });

    test("a Work id that already names a Work of another Project is a conflict, not a failure", async () => {
      const seam = incidents();
      const preview = await seam.previewFollowUp(accountId, choice);
      const before = await workCount();
      await expect(
        seam.createFollowUp(
          accountId,
          commitOf(preview?.fingerprint ?? "", otherBugId),
        ),
      ).rejects.toBeInstanceOf(ProductionIncidentConflictError);
      expect(await workCount()).toBe(before);
    });

    test("a vanished incident leaves the follow-up Work readable and the incident unavailable", async () => {
      const seam = incidents();
      const preview = await seam.previewFollowUp(accountId, choice);
      const command = commitOf(preview?.fingerprint ?? "");
      await seam.createFollowUp(accountId, command);
      targets.push(command.workId);
      await database()
        .delete(productionIncident)
        .where(eq(productionIncident.id, incidentId));
      // Incidents have no Trash; the pointer has no foreign key, so the Work
      // keeps its Origin id and the incident side answers as unavailable.
      const [workRow] = await database()
        .select()
        .from(work)
        .where(eq(work.id, command.workId));
      expect(workRow?.originOwnerRecordId).toBe(incidentId);
      expect(
        await seam.detail(accountId, { incidentId, projectId }),
      ).toBeNull();
      expect(await seam.previewFollowUp(accountId, choice)).toBeNull();
    });

    test("another account, a foreign incident or an archived Project gets no preview or Work", async () => {
      const seam = incidents();
      const preview = await seam.previewFollowUp(accountId, choice);
      expect(await seam.previewFollowUp(otherAccountId, choice)).toBeNull();
      expect(
        await seam.previewFollowUp(accountId, {
          ...choice,
          projectId: otherProjectId,
        }),
      ).toBeNull();
      expect(
        await seam.createFollowUp(
          otherAccountId,
          commitOf(preview?.fingerprint ?? ""),
        ),
      ).toBeNull();
      await database()
        .update(project)
        .set({ archivedAt: new Date() })
        .where(eq(project.id, projectId));
      expect(await seam.previewFollowUp(accountId, choice)).toBeNull();
    });
  });

  test("an archived Project stays readable but takes no link", async () => {
    const seam = incidents();
    await database()
      .update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, projectId));
    expect(await seam.setLink(accountId, bind("Bug", bugId))).toBeNull();
    const detail = await seam.detail(accountId, { incidentId, projectId });
    expect(detail).toMatchObject({ candidates: [], readOnly: true });
  });
});
