// biome-ignore-all lint/performance/noAwaitInLoops: Each transition uses the previous committed revision.
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { usageLink, workRelation } from "@cantiara/db/schema/relation";
import { risk as riskTable } from "@cantiara/db/schema/risk";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createDatabaseUsageLinkMutationContracts } from "../../relations/server/usage-links-database";
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
  }, 30_000);
  test("invalid evidence ranges roll back the Assumption and its evidence", async () => {
    if (!db) {
      throw new Error("Database required");
    }
    const records = createDatabaseProjectSourceRecords(db);
    const documentId = crypto.randomUUID();
    await db.insert(document).values({
      id: documentId,
      projectId,
      title: "Short proof",
      body: "Proof",
      revision: 1,
    });
    const created = await records.create(accountId, {
      id: crypto.randomUUID(),
      projectId,
      sourceType: "Assumption",
      title: "Range demand",
      statement: "Demand exists.",
      rationale: null,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    if (!created) {
      throw new Error("Assumption required");
    }
    await expect(
      records.transition(accountId, {
        projectId,
        sourceId: created.id,
        sourceType: "Assumption",
        life: "Confirmed",
        baseRevision: created.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        documentEvidence: {
          documentId,
          documentRevision: 1,
          selectionStart: 0,
          selectionEnd: 100,
          selectedText: "Proof",
        },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await records.find(accountId, "Assumption", created.id)).toEqual(
      created,
    );
    expect(
      (await records.listAssumptions(accountId, projectId))?.evidence.filter(
        (entry) => entry.assumptionId === created.id,
      ),
    ).toEqual([]);
  });
  test("foreign Document links stay hidden while legitimate evidence survives moving and deleting its source", async () => {
    if (!db) {
      throw new Error("Database required");
    }
    const records = createDatabaseProjectSourceRecords(db);
    const [ownedProject] = await db
      .select()
      .from(project)
      .where(eq(project.id, projectId));
    if (!ownedProject) {
      throw new Error("Project required");
    }
    const otherProjectId = crypto.randomUUID();
    await db.insert(project).values({
      id: otherProjectId,
      workspaceId: ownedProject.workspaceId,
      name: "Other discovery",
      shortCode: `V${otherProjectId.slice(0, 6).toUpperCase()}`,
      starterConfiguration: "Blank Project",
    });
    const foreignId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    await db.insert(document).values([
      {
        id: foreignId,
        projectId: otherProjectId,
        title: "Other project secret",
        body: "Foreign",
        revision: 1,
      },
      {
        id: documentId,
        projectId,
        title: "Original interview",
        body: "Proof",
        revision: 1,
      },
    ]);
    const created = await records.create(accountId, {
      id: crypto.randomUUID(),
      projectId,
      sourceType: "Assumption",
      title: "Scoped demand",
      statement: "Demand exists.",
      rationale: null,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
    });
    if (!created) {
      throw new Error("Assumption required");
    }
    await db.insert(usageLink).values({
      id: crypto.randomUUID(),
      workspaceId: ownedProject.workspaceId,
      kind: "Pinned bind",
      sourceRecordType: "Document",
      sourceRecordId: foreignId,
      surfaceRecordType: "Assumption",
      surfaceRecordId: created.id,
      location: {
        documentVersion: { documentId: foreignId, revision: 1 },
        excerpt: "Foreign",
      },
      revision: 1,
    });
    expect(
      (await records.listAssumptions(accountId, projectId))?.evidence.filter(
        (entry) => entry.assumptionId === created.id,
      ),
    ).toEqual([]);
    await expect(
      records.transition(accountId, {
        projectId,
        sourceId: created.id,
        sourceType: "Assumption",
        life: "Confirmed",
        baseRevision: created.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        documentEvidence: {
          documentId: foreignId,
          documentRevision: 1,
          selectionStart: 0,
          selectionEnd: 7,
          selectedText: "Foreign",
        },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await records.transition(accountId, {
      projectId,
      sourceId: created.id,
      sourceType: "Assumption",
      life: "Confirmed",
      baseRevision: created.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      documentEvidence: {
        documentId,
        documentRevision: 1,
        selectionStart: 0,
        selectionEnd: 5,
        selectedText: "Proof",
      },
    });
    const [pin] = await db
      .select()
      .from(usageLink)
      .where(eq(usageLink.sourceRecordId, documentId));
    if (!pin) {
      throw new Error("Pin required");
    }
    await db
      .update(usageLink)
      .set({
        location: {
          documentVersion: { documentId, revision: 1 },
          start: 0,
          end: 5,
          excerpt: "Proof",
        },
      })
      .where(eq(usageLink.id, pin.id));
    await db.insert(mutationHistory).values({
      id: crypto.randomUUID(),
      targetId: documentId,
      revision: 2,
      actorType: "User",
      actorId: accountId,
      originKind: "human",
      payloadFingerprint: "legacy-document-update",
      previousValue: { document: { id: documentId, projectId, revision: 1 } },
      nextValue: {
        document: { id: documentId, projectId: otherProjectId, revision: 2 },
      },
      occurredAt: new Date(),
    });
    await db
      .update(document)
      .set({ projectId: otherProjectId })
      .where(eq(document.id, documentId));
    await db.delete(document).where(eq(document.id, foreignId));
    const moved = (
      await records.listAssumptions(accountId, projectId)
    )?.evidence.filter((entry) => entry.assumptionId === created.id);
    expect(moved).toEqual([
      expect.objectContaining({
        documentId,
        excerpt: "Proof",
        revision: 1,
        title: "Document unavailable",
      }),
    ]);
    await db.delete(document).where(eq(document.id, documentId));
    expect(
      (await records.listAssumptions(accountId, projectId))?.evidence.filter(
        (entry) => entry.assumptionId === created.id,
      ),
    ).toEqual(moved);
  });
  test("both uncertainty types validate generic evidence atomically and reject archived Projects", async () => {
    if (!db) {
      throw new Error("Database required");
    }
    const records = createDatabaseProjectSourceRecords(db);
    const documentId = crypto.randomUUID();
    await db.insert(document).values({
      id: documentId,
      projectId,
      title: "Atomic interview",
      body: "Proof",
      revision: 2,
    });
    const contract =
      createDatabaseUsageLinkMutationContracts(db).create(accountId);
    for (const sourceType of ["Assumption", "Open Question"] as const) {
      const created = await records.create(accountId, {
        id: crypto.randomUUID(),
        projectId,
        title: "Atomic evidence",
        ...(sourceType === "Assumption"
          ? { sourceType, statement: "Demand exists.", rationale: null }
          : { sourceType, question: "Is there demand?", context: null }),
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
      });
      if (!created) {
        throw new Error("Record required");
      }
      const payload = {
        kind: "Pinned bind" as const,
        source: { recordId: documentId, recordType: "Document" as const },
        surface: { recordId: created.id, recordType: sourceType },
        location: {
          documentVersion: { documentId, revision: 1 },
          start: 0,
          end: 5,
          excerpt: "Proof",
        },
      };
      const mutate = (nextPayload: typeof payload) => {
        const key = crypto.randomUUID();
        return contract.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision: 0,
            clientIdempotencyKey: key,
            kind: "human",
            payload: nextPayload,
            targetId: key,
          },
          () => ({
            usageLink: {
              ...nextPayload,
              id: crypto.randomUUID(),
              revision: 1,
              createdAt: new Date().toISOString(),
            },
          }),
        );
      };
      await expect(mutate(payload)).rejects.toMatchObject({ code: "CONFLICT" });
      const valid = {
        ...payload,
        location: {
          ...payload.location,
          documentVersion: { documentId, revision: 2 },
        },
      };
      const saved = await mutate(valid);
      expect(saved.nextValue.usageLink?.location).toMatchObject({ projectId });
      await db
        .update(project)
        .set({ archivedAt: new Date() })
        .where(eq(project.id, projectId));
      await expect(mutate(valid)).rejects.toMatchObject({ code: "CONFLICT" });
      await db
        .update(project)
        .set({ archivedAt: null })
        .where(eq(project.id, projectId));
    }
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
