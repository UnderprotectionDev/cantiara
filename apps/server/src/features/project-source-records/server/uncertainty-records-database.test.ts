// biome-ignore-all lint/performance/noAwaitInLoops: Each transition uses the previous committed revision.
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import { workRelation } from "@cantiara/db/schema/relation";
import { risk as riskTable } from "@cantiara/db/schema/risk";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";
import { createDatabaseProjectSourceRecords } from "./project-source-records-database";

const url = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("Uncertainty Records", () => {
  const db = url ? createDb({ DATABASE_URL: url }) : undefined;
  const accountId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  beforeAll(async () => {
    if (!db) {
      throw new Error("Database required");
    }
    const workspaceId = crypto.randomUUID();
    await db.insert(user).values({
      id: accountId,
      name: "Founder",
      email: `${accountId}@example.invalid`,
    });
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await db.insert(project).values({
      id: projectId,
      workspaceId,
      name: "Uncertainty",
      shortCode: `U${accountId.slice(0, 6).toUpperCase()}`,
      starterConfiguration: "Blank Project",
    });
  });
  afterAll(async () => {
    await db?.delete(user).where(eq(user.id, accountId));
    await db?.$client.end();
  });
  test("an Assumption moves between all distinct lives without writing or creating counterparts", async () => {
    if (!db) {
      throw new Error("Database required");
    }
    const records = createDatabaseProjectSourceRecords(db);
    const assumption = await records.create(accountId, {
      id: crypto.randomUUID(),
      projectId,
      sourceType: "Assumption",
      title: "Customers need export",
      statement: "Customers will pay for export.",
      rationale: "Customer interviews.",
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    if (assumption?.sourceType !== "Assumption") {
      throw new Error("Assumption required");
    }
    const question = await records.create(accountId, {
      id: crypto.randomUUID(),
      projectId,
      sourceType: "Open Question",
      title: "Which format?",
      question: "Which export format?",
      context: null,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    const decision = await records.create(accountId, {
      id: crypto.randomUUID(),
      projectId,
      sourceType: "Decision",
      title: "Export scope",
      decision: "Build CSV export.",
      rationale: null,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    const riskId = crypto.randomUUID();
    await db
      .insert(riskTable)
      .values({ id: riskId, projectId, title: "Export cost" });
    const risk = await records.find(accountId, "Risk", riskId);
    if (!(question && decision && risk)) {
      throw new Error("Counterparts required");
    }
    const lifecycle = createDatabaseWorkLifecycle(db);
    const work = await lifecycle.create(accountId, {
      projectId,
      type: "Task",
      title: "Implement export",
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    await db.insert(workRelation).values({
      id: crypto.randomUUID(),
      kind: "Related",
      sourceWorkId: work.id,
      targetRecordType: "Assumption",
      targetRecordId: assumption.id,
      targetProjectId: projectId,
      targetLabel: assumption.title,
    });
    const originalWork = await lifecycle.find(accountId, work.id);
    let current = assumption;
    for (const life of [
      "Open",
      "Confirmed",
      "Refuted",
      "No longer applicable",
    ] as const) {
      for (const next of [
        "Open",
        "Confirmed",
        "Refuted",
        "No longer applicable",
      ] as const) {
        if (current.life !== life) {
          const reset = await records.transition(accountId, {
            projectId,
            sourceId: current.id,
            sourceType: "Assumption",
            life,
            baseRevision: current.revision,
            clientIdempotencyKey: crypto.randomUUID(),
          });
          if (reset?.sourceType !== "Assumption") {
            throw new Error("Assumption required");
          }
          current = reset;
        }
        const command = {
          projectId,
          sourceId: current.id,
          sourceType: "Assumption" as const,
          life: next,
          baseRevision: current.revision,
          clientIdempotencyKey: crypto.randomUUID(),
        };
        if (next === life) {
          await expect(
            records.transition(accountId, command),
          ).rejects.toMatchObject({ code: "CONFLICT" });
        } else {
          const result = await records.transition(accountId, command);
          expect(result).toMatchObject({
            life: next,
            statement: assumption.statement,
            rationale: "Customer interviews.",
          });
          if (result?.sourceType !== "Assumption") {
            throw new Error("Assumption required");
          }
          current = result;
          await expect(records.transition(accountId, command)).resolves.toEqual(
            result,
          );
        }
      }
    }
    expect(await records.find(accountId, "Open Question", question.id)).toEqual(
      question,
    );
    expect(await records.find(accountId, "Decision", decision.id)).toEqual(
      decision,
    );
    expect(await records.find(accountId, "Risk", risk.id)).toEqual(risk);
    expect(await lifecycle.find(accountId, work.id)).toEqual(originalWork);
    expect(await records.list(accountId, projectId)).toHaveLength(4);
  });
  test("Confirmed pins exact evidence, preserves it through Refuted and No longer applicable, and rolls back stale evidence", async () => {
    if (!db) {
      throw new Error("Database required");
    }
    const records = createDatabaseProjectSourceRecords(db);
    const documentId = crypto.randomUUID();
    await db.insert(document).values({
      id: documentId,
      projectId,
      title: "Interview",
      body: "Proof of demand",
      revision: 2,
    });
    const created = await records.create(accountId, {
      id: crypto.randomUUID(),
      projectId,
      sourceType: "Assumption",
      title: "Demand",
      statement: "Export is needed.",
      rationale: null,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    if (created?.sourceType !== "Assumption") {
      throw new Error("Assumption required");
    }
    const evidence = {
      documentId,
      documentRevision: 2,
      selectionStart: 0,
      selectionEnd: 5,
      selectedText: "Proof",
    };
    const command = {
      projectId,
      sourceId: created.id,
      sourceType: "Assumption" as const,
      life: "Confirmed" as const,
      baseRevision: created.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      documentEvidence: evidence,
      rationale: "Direct observation.",
    };
    const confirmed = await records.transition(accountId, command);
    if (!confirmed) {
      throw new Error("Confirmed Assumption required");
    }
    expect(confirmed).toMatchObject({
      life: "Confirmed",
      rationale: "Direct observation.",
    });
    await expect(records.transition(accountId, command)).resolves.toEqual(
      confirmed,
    );
    await db
      .update(document)
      .set({ body: "Changed source", revision: 3 })
      .where(eq(document.id, documentId));
    await expect(
      records.transition(accountId, {
        ...command,
        life: "Refuted",
        baseRevision: confirmed.revision,
        clientIdempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await records.find(accountId, "Assumption", created.id)).toEqual(
      confirmed,
    );
    let current = confirmed;
    for (const life of ["Refuted", "No longer applicable"] as const) {
      const changed = await records.transition(accountId, {
        projectId,
        sourceId: created.id,
        sourceType: "Assumption",
        life,
        baseRevision: current.revision,
        clientIdempotencyKey: crypto.randomUUID(),
      });
      if (!changed) {
        throw new Error("Transition required");
      }
      current = changed;
      expect(current).toMatchObject({
        life,
        statement: "Export is needed.",
        rationale: "Direct observation.",
      });
    }
    const context = await records.listAssumptions(accountId, projectId);
    expect(
      context?.evidence.filter((entry) => entry.assumptionId === created.id),
    ).toEqual([
      expect.objectContaining({
        documentId,
        revision: 2,
        excerpt: "Proof",
        title: "Interview",
      }),
    ]);
    expect(await records.listAssumptions("other", projectId)).toBeNull();
    await db
      .update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, projectId));
    expect(await records.listAssumptions(accountId, projectId)).toMatchObject({
      readOnly: true,
    });
    expect(
      await records.transition(accountId, {
        projectId,
        sourceId: created.id,
        sourceType: "Assumption",
        life: "Open",
        baseRevision: current.revision,
        clientIdempotencyKey: crypto.randomUUID(),
      }),
    ).toBeNull();
  });
});
