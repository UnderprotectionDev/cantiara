// biome-ignore-all lint/performance/noAwaitInLoops: Each action observes the preceding persisted revision.

import { ProjectSourceRecordConflictError } from "@cantiara/api/project-source-records";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { focusPeriod } from "@cantiara/db/schema/focus-period";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
} from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { workRelation } from "@cantiara/db/schema/relation";
import { work as workTable } from "@cantiara/db/schema/work";
import { eq, sql } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";
import { createDatabaseProjectSourceRecords } from "./project-source-records-database";
import { createDatabaseRiskSignals } from "./risk-signals-database";

const url = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("Risks record and signal-production PostgreSQL seam", () => {
  const database = url ? createDb({ DATABASE_URL: url }) : undefined;
  const accountId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const riskId = crypto.randomUUID();
  beforeEach(async () => {
    if (!database) {
      throw new Error("Database required");
    }
    await database.insert(user).values({
      id: accountId,
      email: `${accountId}@example.invalid`,
      name: "Founder",
    });
    await database
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await database.insert(project).values({
      id: projectId,
      workspaceId,
      name: "Risks",
      shortCode: "RSK",
      starterConfiguration: "Blank Project",
    });
  });
  afterEach(async () => {
    if (!database) {
      return;
    }
    await database
      .delete(mutationStaging)
      .where(eq(mutationStaging.actorId, accountId));
    await database
      .delete(mutationReceipt)
      .where(eq(mutationReceipt.actorId, accountId));
    await database
      .delete(mutationHistory)
      .where(eq(mutationHistory.actorId, accountId));
    await database.delete(user).where(eq(user.id, accountId));
  });
  afterAll(async () => {
    await database?.$client.end();
  });
  test("creation enters Open once and replays without duplicate signals", async () => {
    if (!database) {
      throw new Error("Database required");
    }
    const records = createDatabaseProjectSourceRecords(database);
    const signals = createDatabaseRiskSignals(database);
    const input = {
      baseRevision: 0,
      clientIdempotencyKey: "create-risk",
      id: riskId,
      projectId,
      sourceType: "Risk" as const,
      title: "Provider delay",
      description: null,
      impact: "Delay",
      probability: "Likely",
      response: null,
    };
    const created = await records.create(accountId, input);
    expect(await signals.list(accountId, projectId)).toMatchObject([
      {
        signalType: "open-risk",
        sourceRiskId: riskId,
        sourceEvent: { type: "entered-open" },
        impact: "Delay",
        probability: "Likely",
      },
    ]);
    expect(await records.create(accountId, input)).toEqual(created);
    expect(await signals.list(accountId, projectId)).toHaveLength(1);
    expect(await signals.list("foreign-account", projectId)).toBeNull();
  });
  test("an explicit relation to an active Focus Period emits once without changing the source", async () => {
    if (!database) {
      throw new Error("Database required");
    }
    const records = createDatabaseProjectSourceRecords(database);
    const signals = createDatabaseRiskSignals(database);
    const created = await records.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "create-risk",
      id: riskId,
      projectId,
      sourceType: "Risk",
      title: "Provider delay",
      description: null,
      impact: "Delay",
      probability: "Likely",
      response: null,
    });
    const periodId = crypto.randomUUID();
    await database.insert(focusPeriod).values({
      id: periodId,
      workspaceId,
      purpose: "Release focus",
      startDate: "2026-10-01",
      endDate: "2026-10-14",
      status: "Active",
    });
    const command = {
      baseRevision: 0,
      clientIdempotencyKey: "link-period",
      riskId,
      projectId,
      targetType: "Focus Period" as const,
      targetId: periodId,
    };
    const relation = await signals.relate(accountId, command);
    expect(relation).toMatchObject({
      riskId,
      targetType: "Focus Period",
      targetId: periodId,
    });
    expect(await signals.list(accountId, projectId)).toMatchObject([
      { sourceEvent: { type: "entered-open" } },
      {
        sourceEvent: {
          type: "related-context",
          targetType: "Focus Period",
          targetId: periodId,
        },
        impact: "Delay",
        probability: "Likely",
      },
    ]);
    expect(await signals.relate(accountId, command)).toEqual(relation);
    expect(await signals.list(accountId, projectId)).toHaveLength(2);
    expect(await records.find(accountId, "Risk", riskId)).toEqual(created);
  });

  test("accepting, occurring and resolving preserve linked Work, release and Project; acceptance is not a publish gate", async () => {
    if (!database) {
      throw new Error("Database required");
    }
    const records = createDatabaseProjectSourceRecords(database);
    const signals = createDatabaseRiskSignals(database);
    const work = createDatabaseWorkLifecycle(database);
    let current = await records.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "create-risk",
      id: riskId,
      projectId,
      sourceType: "Risk",
      title: "Provider delay",
      description: null,
      impact: "Delay",
      probability: "Likely",
      response: null,
    });
    const releaseId = crypto.randomUUID();
    const release = await records.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "release",
      id: releaseId,
      projectId,
      sourceType: "Project Release",
      name: "First release",
      description: null,
      versionLabel: "1.0",
    });
    const relatedWork = await work.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "work",
      projectId,
      title: "Fallback",
      type: "Task",
    });
    await database.insert(workRelation).values({
      id: crypto.randomUUID(),
      kind: "Related",
      sourceWorkId: relatedWork.id,
      targetLabel: "Provider delay",
      targetProjectId: projectId,
      targetRecordId: riskId,
      targetRecordType: "Risk",
    });
    await signals.relate(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "link-release",
      projectId,
      riskId,
      targetType: "Project Release",
      targetId: releaseId,
    });
    const workBefore = await work.find(accountId, relatedWork.id);
    const projectBefore = await database
      .select()
      .from(project)
      .where(eq(project.id, projectId));
    const worksBefore = await database
      .select()
      .from(workTable)
      .where(eq(workTable.projectId, projectId));
    for (const life of [
      "Accepted",
      "Occurred",
      "Resolved",
      "Mitigating",
    ] as const) {
      if (!current) {
        throw new Error("Risk required");
      }
      current = await records.transition(accountId, {
        baseRevision: current.revision,
        clientIdempotencyKey: life,
        projectId,
        sourceId: riskId,
        sourceType: "Risk",
        life,
        rationale: "Known exposure",
      });
      expect(
        await records.find(accountId, "Project Release", releaseId),
      ).toEqual(release);
      expect(await work.find(accountId, relatedWork.id)).toEqual(workBefore);
      expect(
        await database.select().from(project).where(eq(project.id, projectId)),
      ).toEqual(projectBefore);
      expect(
        await database
          .select()
          .from(workTable)
          .where(eq(workTable.projectId, projectId)),
      ).toEqual(worksBefore);
      expect(await signals.list(accountId, projectId)).toHaveLength(1);
    }
    if (!current) {
      throw new Error("Risk required");
    }
    const reopen = {
      baseRevision: current.revision,
      clientIdempotencyKey: "reopen",
      projectId,
      sourceId: riskId,
      sourceType: "Risk" as const,
      life: "Open" as const,
    };
    current = await records.transition(accountId, reopen);
    expect(await records.transition(accountId, reopen)).toEqual(current);
    expect(await signals.list(accountId, projectId)).toHaveLength(2);
    if (!current) {
      throw new Error("Risk required");
    }
    await records.transition(accountId, {
      baseRevision: current.revision,
      clientIdempotencyKey: "accept-again",
      projectId,
      sourceId: riskId,
      sourceType: "Risk",
      life: "Accepted",
      rationale: "Ship despite exposure",
    });
    const preparing = await records.transition(accountId, {
      baseRevision: 1,
      clientIdempotencyKey: "prepare-release",
      projectId,
      sourceId: releaseId,
      sourceType: "Project Release",
      status: "Preparing",
    });
    if (!preparing) {
      throw new Error("Release required");
    }
    expect(
      await records.transition(accountId, {
        baseRevision: preparing.revision,
        clientIdempotencyKey: "publish-release",
        projectId,
        sourceId: releaseId,
        sourceType: "Project Release",
        status: "Published",
      }),
    ).toMatchObject({ status: "Published" });
    expect(await signals.list(accountId, projectId)).toHaveLength(2);
  });

  test.each(["Draft", "Preparing", "Published", "Cancelled"] as const)(
    "release relation checks current %s status, not time or Project presence",
    async (status) => {
      if (!database) {
        throw new Error("Database required");
      }
      const records = createDatabaseProjectSourceRecords(database);
      const signals = createDatabaseRiskSignals(database);
      const created = await records.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "create-risk",
        id: riskId,
        projectId,
        sourceType: "Risk",
        title: "High exposure",
        description: null,
        impact: "High",
        probability: "High",
        response: null,
      });
      const releaseId = crypto.randomUUID();
      let release = await records.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "release",
        id: releaseId,
        projectId,
        sourceType: "Project Release",
        name: "First release",
        description: null,
        versionLabel: null,
      });
      if (status !== "Draft") {
        release = await records.transition(accountId, {
          baseRevision: 1,
          clientIdempotencyKey: "prepare",
          projectId,
          sourceId: releaseId,
          sourceType: "Project Release",
          status: "Preparing",
        });
        if (status !== "Preparing") {
          release = await records.transition(accountId, {
            baseRevision: 2,
            clientIdempotencyKey: "status",
            projectId,
            sourceId: releaseId,
            sourceType: "Project Release",
            status,
          });
        }
      }
      expect(await signals.list(accountId, projectId)).toHaveLength(1);
      const command = {
        baseRevision: 0,
        clientIdempotencyKey: "link",
        projectId,
        riskId,
        targetType: "Project Release" as const,
        targetId: releaseId,
      };
      await signals.relate(accountId, command);
      const emitted = await signals.list(accountId, projectId);
      expect(emitted).toHaveLength(status === "Preparing" ? 2 : 1);
      if (status === "Preparing") {
        expect(emitted?.[1]).toMatchObject({
          sourceEvent: {
            type: "related-context",
            targetType: "Project Release",
            targetId: releaseId,
          },
          impact: "High",
          probability: "High",
        });
      }
      expect(await records.find(accountId, "Risk", riskId)).toEqual(created);
      expect(
        await records.find(accountId, "Project Release", releaseId),
      ).toEqual(release);
      await expect(
        signals.relate(accountId, {
          ...command,
          clientIdempotencyKey: "duplicate",
        }),
      ).rejects.toBeInstanceOf(ProjectSourceRecordConflictError);
      expect(await signals.list(accountId, projectId)).toEqual(emitted);
    },
  );

  test.each(["Planned", "Active", "Closed", "Canceled"] as const)(
    "Focus Period %s is evaluated only at relation creation",
    async (status) => {
      if (!database) {
        throw new Error("Database required");
      }
      const records = createDatabaseProjectSourceRecords(database);
      const signals = createDatabaseRiskSignals(database);
      await records.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "create-risk",
        id: riskId,
        projectId,
        sourceType: "Risk",
        title: "Delay",
        description: null,
        impact: null,
        probability: null,
        response: null,
      });
      const periodId = crypto.randomUUID();
      await database.insert(focusPeriod).values({
        id: periodId,
        workspaceId,
        purpose: "Focus",
        startDate: "2020-01-01",
        endDate: "2020-01-14",
        status,
      });
      const before = await database
        .select()
        .from(focusPeriod)
        .where(eq(focusPeriod.id, periodId));
      await signals.relate(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "link",
        projectId,
        riskId,
        targetType: "Focus Period",
        targetId: periodId,
      });
      expect(await signals.list(accountId, projectId)).toHaveLength(
        status === "Active" ? 2 : 1,
      );
      expect(
        await database
          .select()
          .from(focusPeriod)
          .where(eq(focusPeriod.id, periodId)),
      ).toEqual(before);
      if (status === "Planned") {
        await database
          .update(focusPeriod)
          .set({ status: "Active" })
          .where(eq(focusPeriod.id, periodId));
        expect(await signals.list(accountId, projectId)).toHaveLength(1);
      }
    },
  );

  test.each(["Mitigating", "Accepted", "Occurred", "Resolved"] as const)(
    "%s cannot emit on context links or field edits",
    async (life) => {
      if (!database) {
        throw new Error("Database required");
      }
      const records = createDatabaseProjectSourceRecords(database);
      const signals = createDatabaseRiskSignals(database);
      await records.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "create-risk",
        id: riskId,
        projectId,
        sourceType: "Risk",
        title: "Delay",
        description: null,
        impact: null,
        probability: null,
        response: null,
      });
      await records.transition(accountId, {
        baseRevision: 1,
        clientIdempotencyKey: "status",
        projectId,
        sourceId: riskId,
        sourceType: "Risk",
        life,
        rationale: "Known exposure",
      });
      const periodId = crypto.randomUUID();
      await database.insert(focusPeriod).values({
        id: periodId,
        workspaceId,
        purpose: "Focus",
        startDate: "2026-10-01",
        endDate: "2026-10-14",
        status: "Active",
      });
      await signals.relate(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "link",
        projectId,
        riskId,
        targetType: "Focus Period",
        targetId: periodId,
      });
      await records.update(accountId, {
        baseRevision: 2,
        clientIdempotencyKey: "edit",
        projectId,
        sourceId: riskId,
        sourceType: "Risk",
        title: "High exposure",
        description: null,
        impact: "High",
        probability: "High",
        response: null,
        rationale: "Known exposure",
      });
      expect(await signals.list(accountId, projectId)).toHaveLength(1);
    },
  );

  test("Open field edits and later context status changes do not emit; original event values remain intact", async () => {
    if (!database) {
      throw new Error("Database required");
    }
    const records = createDatabaseProjectSourceRecords(database);
    const signals = createDatabaseRiskSignals(database);
    await records.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "create-risk",
      id: riskId,
      projectId,
      sourceType: "Risk",
      title: "Delay",
      description: null,
      impact: null,
      probability: null,
      response: null,
    });
    const original = await signals.list(accountId, projectId);
    await records.update(accountId, {
      baseRevision: 1,
      clientIdempotencyKey: "edit",
      projectId,
      sourceId: riskId,
      sourceType: "Risk",
      title: "Delay",
      description: null,
      impact: "High",
      probability: "High",
      response: null,
      rationale: null,
    });
    expect(await signals.list(accountId, projectId)).toEqual(original);
    await expect(
      records.transition(accountId, {
        baseRevision: 2,
        clientIdempotencyKey: "same-life",
        projectId,
        sourceId: riskId,
        sourceType: "Risk",
        life: "Open",
      }),
    ).rejects.toBeInstanceOf(ProjectSourceRecordConflictError);
    expect(await signals.list(accountId, projectId)).toEqual(original);
  });

  test("missing, foreign, cross-Project release and archived endpoints cannot create a signal", async () => {
    if (!database) {
      throw new Error("Database required");
    }
    const records = createDatabaseProjectSourceRecords(database);
    const signals = createDatabaseRiskSignals(database);
    await records.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "create-risk",
      id: riskId,
      projectId,
      sourceType: "Risk",
      title: "Delay",
      description: null,
      impact: null,
      probability: null,
      response: null,
    });
    const otherProjectId = crypto.randomUUID();
    await database.insert(project).values({
      id: otherProjectId,
      workspaceId,
      name: "Other Project",
      shortCode: "OTH",
      starterConfiguration: "Blank Project",
    });
    const releaseId = crypto.randomUUID();
    await records.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "release",
      id: releaseId,
      projectId: otherProjectId,
      sourceType: "Project Release",
      name: "Other release",
      description: null,
      versionLabel: null,
    });
    const command = {
      baseRevision: 0,
      clientIdempotencyKey: "link",
      projectId,
      riskId,
      targetType: "Project Release" as const,
      targetId: releaseId,
    };
    expect(await signals.relate(accountId, command)).toBeNull();
    expect(await signals.relate("foreign-account", command)).toBeNull();
    expect(
      await signals.relate(accountId, { ...command, targetId: "missing" }),
    ).toBeNull();
    const periodId = crypto.randomUUID();
    await database.insert(focusPeriod).values({
      id: periodId,
      workspaceId,
      purpose: "Focus",
      startDate: "2026-10-01",
      endDate: "2026-10-14",
      status: "Active",
    });
    await expect(
      signals.relate(accountId, {
        ...command,
        targetType: "Focus Period",
        targetId: periodId,
        baseRevision: 1,
      }),
    ).rejects.toBeInstanceOf(ProjectSourceRecordConflictError);
    await database
      .update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, projectId));
    expect(
      await signals.relate(accountId, {
        ...command,
        targetType: "Focus Period",
        targetId: periodId,
      }),
    ).toBeNull();
    expect(await signals.list(accountId, projectId)).toHaveLength(1);
  });

  test("signal persistence failure rolls back the Risk or relation and the same command can retry", async () => {
    if (!database) {
      throw new Error("Database required");
    }
    const records = createDatabaseProjectSourceRecords(database);
    const signals = createDatabaseRiskSignals(database);
    const create = {
      baseRevision: 0,
      clientIdempotencyKey: "create-risk",
      id: riskId,
      projectId,
      sourceType: "Risk" as const,
      title: "Delay",
      description: null,
      impact: "Reject signal write",
      probability: null,
      response: null,
    };
    await database.execute(
      sql`CREATE FUNCTION reject_test_risk_signal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.impact = 'Reject signal write' THEN RAISE EXCEPTION 'Signal persistence unavailable'; END IF; RETURN NEW; END $$`,
    );
    await database.execute(
      sql`CREATE TRIGGER reject_test_risk_signal BEFORE INSERT ON risk_attention_signal FOR EACH ROW EXECUTE FUNCTION reject_test_risk_signal()`,
    );
    try {
      await expect(records.create(accountId, create)).rejects.toThrow();
      expect(await records.find(accountId, "Risk", riskId)).toBeNull();
      expect(await signals.list(accountId, projectId)).toEqual([]);
    } finally {
      await database.execute(
        sql`DROP TRIGGER reject_test_risk_signal ON risk_attention_signal`,
      );
      await database.execute(sql`DROP FUNCTION reject_test_risk_signal()`);
    }
    expect(await records.create(accountId, create)).toMatchObject({
      life: "Open",
      revision: 1,
    });
    const periodId = crypto.randomUUID();
    await database.insert(focusPeriod).values({
      id: periodId,
      workspaceId,
      purpose: "Focus",
      startDate: "2026-10-01",
      endDate: "2026-10-14",
      status: "Active",
    });
    const command = {
      baseRevision: 0,
      clientIdempotencyKey: "link",
      projectId,
      riskId,
      targetType: "Focus Period" as const,
      targetId: periodId,
    };
    await database.execute(
      sql`CREATE FUNCTION reject_test_risk_signal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Signal persistence unavailable'; END $$`,
    );
    await database.execute(
      sql`CREATE TRIGGER reject_test_risk_signal BEFORE INSERT ON risk_attention_signal FOR EACH ROW EXECUTE FUNCTION reject_test_risk_signal()`,
    );
    try {
      await expect(signals.relate(accountId, command)).rejects.toThrow();
      expect(await signals.list(accountId, projectId)).toHaveLength(1);
    } finally {
      await database.execute(
        sql`DROP TRIGGER reject_test_risk_signal ON risk_attention_signal`,
      );
      await database.execute(sql`DROP FUNCTION reject_test_risk_signal()`);
    }
    expect(await signals.relate(accountId, command)).toMatchObject({
      revision: 1,
    });
    expect(await signals.list(accountId, projectId)).toHaveLength(2);
  });
});
