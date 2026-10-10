import {
  decisionChain,
  decisionSnapshotPreview,
} from "@cantiara/api/decision-chain";
import { ProjectSourceRecordConflictError } from "@cantiara/api/project-source-records";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
} from "@cantiara/db/schema/external-surface";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { usageLink, workRelation } from "@cantiara/db/schema/relation";
import { risk } from "@cantiara/db/schema/risk";
import { work as workTable } from "@cantiara/db/schema/work";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseRelations } from "../../relations/server/relations";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";
import { createDatabaseProjectSourceRecords } from "./project-source-records-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase(
  "Project source record lifecycle PostgreSQL integration",
  () => {
    const database = databaseUrl
      ? createDb({ DATABASE_URL: databaseUrl })
      : undefined;
    const accountId = `project-source-records-${crypto.randomUUID()}`;
    const workspaceId = `workspace-${crypto.randomUUID()}`;
    const projectId = `project-${crypto.randomUUID()}`;
    const sourceIds = [
      `decision-${crypto.randomUUID()}`,
      `milestone-${crypto.randomUUID()}`,
      `abandoned-milestone-${crypto.randomUUID()}`,
      `release-${crypto.randomUUID()}`,
      `incident-${crypto.randomUUID()}`,
    ] as const;

    beforeEach(async () => {
      if (!database) {
        throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
      }
      await database.insert(user).values({
        email: `${accountId}@example.invalid`,
        id: accountId,
        name: "Founder",
      });
      await database.insert(workspace).values({
        id: workspaceId,
        ownerAccountId: accountId,
      });
      await database.insert(project).values({
        id: projectId,
        name: "Source Records",
        shortCode: `SR-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
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
      await database
        .delete(mutationTarget)
        .where(
          inArray(mutationTarget.id, [
            ...sourceIds,
            `decision-supersession:${projectId}`,
          ]),
        );
      await database.delete(user).where(eq(user.id, accountId));
    });

    afterAll(async () => {
      await database?.$client.end();
    });

    test("Risks persists founder text, explicit status matrix, rationale and isolated counterparts", async () => {
      if (!database) {
        throw new Error("Database required");
      }
      const records = createDatabaseProjectSourceRecords(database);
      const input = {
        baseRevision: 0,
        clientIdempotencyKey: "risk-create",
        id: sourceIds[0],
        projectId,
        sourceType: "Risk" as const,
        title: "Provider delay",
        description: "Approval may slip",
        impact: "Delayed release",
        probability: "Unknown",
        response: "Prepare a fallback",
      };
      const created = await records.create(accountId, input);
      expect(created).toMatchObject({
        id: input.id,
        title: input.title,
        description: input.description,
        impact: input.impact,
        probability: input.probability,
        response: input.response,
        life: "Open",
        revision: 1,
        rationale: null,
      });
      expect(await records.create(accountId, input)).toEqual(created);
      const release = await records.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "risk-release",
        id: sourceIds[3],
        projectId,
        sourceType: "Project Release",
        name: "First release",
        description: null,
        versionLabel: "1.0",
      });
      const work = createDatabaseWorkLifecycle(database);
      const relatedWork = await work.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "risk-work",
        projectId,
        title: "Prepare fallback",
        type: "Task",
      });
      await database.insert(workRelation).values({
        id: crypto.randomUUID(),
        kind: "Related",
        sourceWorkId: relatedWork.id,
        targetLabel: "Provider delay",
        targetProjectId: projectId,
        targetRecordId: sourceIds[0],
        targetRecordType: "Risk",
      });
      const workBefore = await work.find(accountId, relatedWork.id);
      const projectBefore = await database
        .select()
        .from(project)
        .where(eq(project.id, projectId));
      let current = created;
      for (const from of [
        "Open",
        "Mitigating",
        "Occurred",
        "Resolved",
        "Accepted",
      ] as const) {
        if (current?.sourceType !== "Risk") {
          throw new Error("Risk required");
        }
        if (current.life !== from) {
          // biome-ignore lint/performance/noAwaitInLoops: Each transition uses the preceding revision.
          current = await records.transition(accountId, {
            baseRevision: current.revision,
            clientIdempotencyKey: `from-${from}`,
            projectId,
            sourceId: sourceIds[0],
            sourceType: "Risk",
            life: from,
            rationale: "Known exposure is tolerable.",
          });
        }
        for (const life of [
          "Open",
          "Mitigating",
          "Occurred",
          "Resolved",
          "Accepted",
        ] as const) {
          if (current?.sourceType !== "Risk") {
            throw new Error("Risk required");
          }
          if (current.life !== from) {
            // biome-ignore lint/performance/noAwaitInLoops: Reset source status to cover every pair independently.
            current = await records.transition(accountId, {
              baseRevision: current.revision,
              clientIdempotencyKey: `reset-${from}-${life}`,
              projectId,
              sourceId: sourceIds[0],
              sourceType: "Risk",
              life: from,
              rationale: "Known exposure is tolerable.",
            });
          }
          if (current?.sourceType !== "Risk") {
            throw new Error("Risk required");
          }
          const command = {
            baseRevision: current.revision,
            clientIdempotencyKey: `matrix-${from}-${life}`,
            projectId,
            sourceId: sourceIds[0],
            sourceType: "Risk" as const,
            life,
            rationale: "Known exposure is tolerable.",
          };
          if (life === current.life) {
            await expect(
              records.transition(accountId, command),
            ).rejects.toBeInstanceOf(ProjectSourceRecordConflictError);
          } else {
            current = await records.transition(accountId, command);
            expect(current).toMatchObject({
              sourceType: "Risk",
              life,
              impact: "Delayed release",
              probability: "Unknown",
              response: "Prepare a fallback",
            });
            expect(await records.transition(accountId, command)).toEqual(
              current,
            );
            expect(await records.find(accountId, "Risk", sourceIds[0])).toEqual(
              current,
            );
          }
        }
      }
      if (current?.sourceType !== "Risk") {
        throw new Error("Risk required");
      }
      const listed = await records.listRisks(accountId, projectId);
      expect(listed).toMatchObject({ readOnly: false, records: [current] });
      await expect(
        records.update(accountId, {
          baseRevision: current.revision,
          clientIdempotencyKey: "clear-accepted-rationale",
          projectId,
          sourceId: sourceIds[0],
          sourceType: "Risk",
          title: "Provider delay",
          description: "Approval may slip",
          impact: "Delayed release",
          probability: "Unknown",
          response: "Prepare a fallback",
          rationale: null,
        }),
      ).rejects.toBeInstanceOf(ProjectSourceRecordConflictError);
      expect(current).toMatchObject({
        life: "Accepted",
        rationale: "Known exposure is tolerable.",
      });
      expect(current).not.toHaveProperty("priorityScore");
      expect(
        await records.find(accountId, "Production Incident", sourceIds[0]),
      ).toBeNull();
      expect(
        await records.find(accountId, "Project Release", sourceIds[3]),
      ).toEqual(release);
      expect(await work.find(accountId, relatedWork.id)).toEqual(workBefore);
      expect(
        await database.select().from(project).where(eq(project.id, projectId)),
      ).toEqual(projectBefore);
      expect(
        await records.find("other-account", "Risk", sourceIds[0]),
      ).toBeNull();
    });

    test("Risks edits preserve life and reject stale, foreign and archived writes", async () => {
      if (!database) {
        throw new Error("Database required");
      }
      const records = createDatabaseProjectSourceRecords(database);
      const created = await records.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "create-risk",
        id: sourceIds[0],
        projectId,
        sourceType: "Risk",
        title: "Provider delay",
        description: null,
        impact: null,
        probability: null,
        response: null,
      });
      if (created?.sourceType !== "Risk") {
        throw new Error("Risk required");
      }
      const update = {
        baseRevision: created.revision,
        clientIdempotencyKey: "edit-risk",
        projectId,
        sourceId: created.id,
        sourceType: "Risk" as const,
        title: "Provider approval delay",
        description: "Changed circumstances",
        impact: "High",
        probability: "Likely",
        response: "Use fallback",
        rationale: null,
      };
      const updated = await records.update(accountId, update);
      expect(updated).toMatchObject({
        life: "Open",
        title: update.title,
        probability: "Likely",
        revision: 2,
      });
      expect(await records.find(accountId, "Risk", created.id)).toEqual(
        updated,
      );
      const transition = {
        baseRevision: 2,
        clientIdempotencyKey: "resolve-risk",
        projectId,
        sourceId: created.id,
        sourceType: "Risk" as const,
        life: "Resolved" as const,
      };
      await expect(
        records.transition(accountId, { ...transition, baseRevision: 1 }),
      ).rejects.toBeInstanceOf(ProjectSourceRecordConflictError);
      expect(await records.transition("other-account", transition)).toBeNull();
      expect(await records.listRisks("other-account", projectId)).toBeNull();
      await database
        .update(project)
        .set({ archivedAt: new Date() })
        .where(eq(project.id, projectId));
      expect(await records.listRisks(accountId, projectId)).toMatchObject({
        readOnly: true,
        records: [updated],
      });
      expect(await records.transition(accountId, transition)).toBeNull();
      expect(await records.find(accountId, "Risk", created.id)).toEqual(
        updated,
      );
    });

    test("keeps generations and approved Decision snapshots stable while superseded content is read-only", async () => {
      if (!database) {
        throw new Error("Database required");
      }
      const records = await decisionsFixture();
      const beforeGraph = await records.supersession.read(accountId, projectId);
      if (!beforeGraph) {
        throw new Error("Graph required");
      }
      const approved = decisionSnapshotPreview(beforeGraph, {
        decisionIds: [sourceIds[0]],
      });
      const surfaceId = `surface-${crypto.randomUUID()}`;
      await database
        .insert(externalSurface)
        .values({ id: surfaceId, workspaceId, projectId });
      await database.insert(externalSurfaceSnapshotRevision).values({
        id: `snapshot-${crypto.randomUUID()}`,
        surfaceId,
        revision: 1,
        snapshot: approved,
      });
      for (const [predecessorId, successorId] of [
        [sourceIds[0], sourceIds[1]],
        [sourceIds[1], sourceIds[2]],
      ] as const) {
        // biome-ignore lint/performance/noAwaitInLoops: Each transition depends on the preceding committed generation.
        const preview = await records.supersession.preview(accountId, {
          projectId,
          successorId,
          predecessorIds: [predecessorId],
          operation: "supersede",
          rationale: "Constraints changed",
        });
        if (!preview) {
          throw new Error("Preview required");
        }
        await records.supersession.commit(accountId, {
          ...preview.command,
          clientIdempotencyKey: `replace-${predecessorId}`,
        });
      }
      const graph = await records.supersession.read(accountId, projectId);
      if (!graph) {
        throw new Error("Graph required");
      }
      expect(
        decisionChain(graph, sourceIds[0])?.records.map((record) => record.id),
      ).toEqual(sourceIds.slice(0, 3));
      expect(decisionChain(graph, sourceIds[0])?.current?.id).toBe(
        sourceIds[2],
      );
      expect(
        await records.supersession.history(accountId, projectId),
      ).toHaveLength(2);
      expect(
        decisionSnapshotPreview(graph).map((item) =>
          item.kind === "Decision" ? item.record.id : "relation",
        ),
      ).toEqual([sourceIds[2]]);
      const historical = await records.find(
        accountId,
        "Decision",
        sourceIds[0],
      );
      if (historical?.sourceType !== "Decision") {
        throw new Error("Decision required");
      }
      await expect(
        records.update(accountId, {
          projectId,
          sourceId: historical.id,
          sourceType: "Decision",
          title: "Rewrite history",
          decision: "Different choice",
          rationale: null,
          baseRevision: historical.revision,
          clientIdempotencyKey: "rewrite-old",
        }),
      ).rejects.toBeInstanceOf(ProjectSourceRecordConflictError);
      expect(await records.find(accountId, "Decision", sourceIds[0])).toEqual(
        historical,
      );
      expect(
        (
          await database
            .select()
            .from(externalSurfaceSnapshotRevision)
            .where(eq(externalSurfaceSnapshotRevision.surfaceId, surfaceId))
        ).map((row) => row.snapshot),
      ).toEqual([approved]);
    });

    test("previews and atomically supersedes several Decisions with an idempotent receipt", async () => {
      if (!database) {
        throw new Error("Database required");
      }
      const records = createDatabaseProjectSourceRecords(database);
      for (const [index, id] of sourceIds.slice(0, 3).entries()) {
        // biome-ignore lint/performance/noAwaitInLoops: Fixture writes use the same Project serialization boundary.
        await records.create(accountId, {
          id,
          projectId,
          sourceType: "Decision",
          title: `Choice ${index}`,
          decision: `Choose ${index}`,
          rationale: `Because ${index}`,
          baseRevision: 0,
          clientIdempotencyKey: `create-${index}`,
        });
      }
      const preview = await records.supersession.preview(accountId, {
        projectId,
        successorId: sourceIds[2],
        predecessorIds: [sourceIds[0], sourceIds[1]],
        operation: "supersede",
        rationale: "Constraints changed.",
      });
      expect(preview?.changes.map((change) => change.after)).toEqual([
        "Superseded",
        "Superseded",
      ]);
      expect(
        await records.find(accountId, "Decision", sourceIds[0]),
      ).toMatchObject({ life: "Valid" });
      if (!preview) {
        throw new Error("Preview required");
      }
      const command = { ...preview.command, clientIdempotencyKey: "replace" };
      const receipt = await records.supersession.commit(accountId, command);
      expect(await records.supersession.commit(accountId, command)).toEqual(
        receipt,
      );
      expect(
        await records.find(accountId, "Decision", sourceIds[0]),
      ).toMatchObject({ life: "Superseded" });
      expect(
        await records.find(accountId, "Decision", sourceIds[1]),
      ).toMatchObject({ life: "Superseded" });
      expect(
        await records.find(accountId, "Decision", sourceIds[2]),
      ).toMatchObject({ life: "Valid" });
      expect(
        (await records.supersession.read(accountId, projectId))?.relations,
      ).toHaveLength(2);
      if (!database) {
        throw new Error("Database required");
      }
      await database
        .update(project)
        .set({ archivedAt: new Date() })
        .where(eq(project.id, projectId));
      expect(await records.supersession.commit(accountId, command)).toEqual(
        receipt,
      );
    });

    async function decisionsFixture() {
      if (!database) {
        throw new Error("Database required");
      }
      const records = createDatabaseProjectSourceRecords(database);
      await Promise.all(
        sourceIds.slice(0, 3).map((id, index) =>
          records.create(accountId, {
            id,
            projectId,
            sourceType: "Decision",
            title: `Choice ${index}`,
            decision: `Choose ${index}`,
            rationale: `Because ${index}`,
            baseRevision: 0,
            clientIdempotencyKey: `fixture-${index}`,
          }),
        ),
      );
      return records;
    }
    const replacement = () => ({
      projectId,
      successorId: sourceIds[1],
      predecessorIds: [sourceIds[0]],
      operation: "supersede" as const,
      rationale: "A full replacement.",
    });

    test("rejects self-links, cycles, forks and unavailable selections without partial writes", async () => {
      const records = await decisionsFixture();
      await expect(
        records.supersession.preview(accountId, {
          ...replacement(),
          predecessorIds: [sourceIds[1]],
        }),
      ).rejects.toThrow();
      await expect(
        records.supersession.preview(accountId, {
          ...replacement(),
          predecessorIds: [sourceIds[0], "unavailable"],
        }),
      ).rejects.toThrow();
      expect(
        await records.find(accountId, "Decision", sourceIds[0]),
      ).toMatchObject({ life: "Valid", revision: 1 });
      const preview = await records.supersession.preview(
        accountId,
        replacement(),
      );
      if (!preview) {
        throw new Error("Preview required");
      }
      await records.supersession.commit(accountId, {
        ...preview.command,
        clientIdempotencyKey: "replace",
      });
      await expect(
        records.supersession.preview(accountId, {
          ...replacement(),
          successorId: sourceIds[2],
        }),
      ).rejects.toThrow();
      await expect(
        records.supersession.preview(accountId, {
          ...replacement(),
          successorId: sourceIds[0],
          predecessorIds: [sourceIds[1]],
        }),
      ).rejects.toThrow();
      expect(
        (await records.supersession.read(accountId, projectId))?.relations,
      ).toHaveLength(1);
    });

    test("allows exactly one racing successor and rejects changed retry content", async () => {
      const records = await decisionsFixture();
      const a = await records.supersession.preview(accountId, replacement());
      const b = await records.supersession.preview(accountId, {
        ...replacement(),
        successorId: sourceIds[2],
      });
      if (!(a && b)) {
        throw new Error("Preview required");
      }
      const results = await Promise.allSettled([
        records.supersession.commit(accountId, {
          ...a.command,
          clientIdempotencyKey: "race-a",
        }),
        records.supersession.commit(accountId, {
          ...b.command,
          clientIdempotencyKey: "race-b",
        }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      const winning =
        results[0].status === "fulfilled"
          ? { ...a.command, clientIdempotencyKey: "race-a" }
          : { ...b.command, clientIdempotencyKey: "race-b" };
      await expect(
        records.supersession.commit(accountId, {
          ...winning,
          rationale: "Changed payload",
        }),
      ).rejects.toThrow();
      expect(
        (await records.supersession.read(accountId, projectId))?.relations,
      ).toHaveLength(1);
    });

    test("rejects a stale content preview, other Accounts and archived Project writes", async () => {
      if (!database) {
        throw new Error("Database required");
      }
      const records = await decisionsFixture();
      const preview = await records.supersession.preview(
        accountId,
        replacement(),
      );
      if (!preview) {
        throw new Error("Preview required");
      }
      await records.update(accountId, {
        sourceType: "Decision",
        sourceId: sourceIds[0],
        projectId,
        title: "Changed choice",
        decision: "Choose 0",
        rationale: null,
        baseRevision: 1,
        clientIdempotencyKey: "edit",
      });
      await expect(
        records.supersession.commit(accountId, {
          ...preview.command,
          clientIdempotencyKey: "stale",
        }),
      ).rejects.toThrow();
      expect(
        await records.supersession.read(`${accountId}-other`, projectId),
      ).toBeNull();
      expect(
        await records.supersession.commit(`${accountId}-other`, {
          ...preview.command,
          clientIdempotencyKey: "other",
        }),
      ).toBeNull();
      await database
        .update(project)
        .set({ archivedAt: new Date() })
        .where(eq(project.id, projectId));
      expect(
        (await records.supersession.read(accountId, projectId))?.readOnly,
      ).toBe(true);
      expect(
        await records.supersession.preview(accountId, replacement()),
      ).toBeNull();
      expect(
        await records.supersession.commit(accountId, {
          ...preview.command,
          clientIdempotencyKey: "archive",
        }),
      ).toBeNull();
    });

    test("removing a previewed relation restores only its predecessor and preserves the successor and earlier chain", async () => {
      const records = await decisionsFixture();
      const a = await records.supersession.preview(accountId, replacement());
      if (!a) {
        throw new Error("Preview required");
      }
      await records.supersession.commit(accountId, {
        ...a.command,
        clientIdempotencyKey: "a",
      });
      const b = await records.supersession.preview(accountId, {
        ...replacement(),
        predecessorIds: [sourceIds[1]],
        successorId: sourceIds[2],
      });
      if (!b) {
        throw new Error("Preview required");
      }
      await records.supersession.commit(accountId, {
        ...b.command,
        clientIdempotencyKey: "b",
      });
      const remove = await records.supersession.preview(accountId, {
        ...replacement(),
        predecessorIds: [sourceIds[1]],
        successorId: sourceIds[2],
        operation: "remove",
        rationale: "Replacement no longer applies.",
      });
      if (!remove) {
        throw new Error("Preview required");
      }
      expect(
        await records.find(accountId, "Decision", sourceIds[1]),
      ).toMatchObject({ life: "Superseded" });
      const command = { ...remove.command, clientIdempotencyKey: "remove" };
      const receipt = await records.supersession.commit(accountId, command);
      expect(await records.supersession.commit(accountId, command)).toEqual(
        receipt,
      );
      expect(await records.supersession.history(accountId, projectId)).toEqual([
        expect.objectContaining({ operation: "supersede", actorId: accountId }),
        expect.objectContaining({ operation: "supersede", actorId: accountId }),
        expect.objectContaining({
          operation: "remove",
          rationale: "Replacement no longer applies.",
          actorId: accountId,
          predecessorIds: [sourceIds[1]],
          successorId: sourceIds[2],
          occurredAt: receipt?.committedAt,
        }),
      ]);
      expect(
        await records.supersession.history(`${accountId}-other`, projectId),
      ).toBeNull();
      expect(
        await records.find(accountId, "Decision", sourceIds[0]),
      ).toMatchObject({ life: "Superseded" });
      expect(
        await records.find(accountId, "Decision", sourceIds[1]),
      ).toMatchObject({ life: "Valid" });
      expect(
        await records.find(accountId, "Decision", sourceIds[2]),
      ).toMatchObject({ life: "Valid", revision: 1 });
      expect(
        (await records.supersession.read(accountId, projectId))?.relations,
      ).toHaveLength(1);
    });

    test("preview includes cross-Project Work evidence and rejects confirmation after that evidence changes", async () => {
      if (!database) {
        throw new Error("Database required");
      }
      const records = await decisionsFixture();
      const evidenceProjectId = `${projectId}-evidence`;
      await database.insert(project).values({
        id: evidenceProjectId,
        name: "Evidence Project",
        shortCode: `EV-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
      });
      const lifecycle = createDatabaseWorkLifecycle(database);
      const evidenceWork = await lifecycle.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "cross-project-evidence",
        projectId: evidenceProjectId,
        title: "Validate earlier choice",
        type: "Task",
      });
      await database.insert(workRelation).values({
        id: crypto.randomUUID(),
        kind: "Evidence",
        sourceWorkId: evidenceWork.id,
        targetLabel: "Choice 0",
        targetProjectId: projectId,
        targetRecordId: sourceIds[0],
        targetRecordType: "Decision",
      });
      const preview = await records.supersession.preview(
        accountId,
        replacement(),
      );
      expect(preview?.graph.evidence).toEqual([
        expect.objectContaining({
          title: "Validate earlier choice",
          decisionId: sourceIds[0],
        }),
      ]);
      if (!preview) {
        throw new Error("Preview required");
      }
      await database
        .update(workRelation)
        .set({ targetLabel: "Updated evidence label", revision: 1 })
        .where(eq(workRelation.sourceWorkId, evidenceWork.id));
      await expect(
        records.supersession.commit(accountId, {
          ...preview.command,
          clientIdempotencyKey: "changed-evidence-edge",
        }),
      ).rejects.toThrow();
      const refreshed = await records.supersession.preview(
        accountId,
        replacement(),
      );
      if (!refreshed) {
        throw new Error("Preview required");
      }
      await database
        .update(workRelation)
        .set({ deletedAt: new Date(), revision: 2 })
        .where(eq(workRelation.sourceWorkId, evidenceWork.id));
      await expect(
        records.supersession.commit(accountId, {
          ...refreshed.command,
          clientIdempotencyKey: "stale-cross-project-evidence",
        }),
      ).rejects.toThrow();
      expect(
        (await records.supersession.read(accountId, projectId))?.relations,
      ).toEqual([]);
    });

    test.each(["Work", "Evidence relation"])(
      "requires a fresh preview while cross-Project %s evidence is being updated",
      async (changing) => {
        if (!database) {
          throw new Error("Database required");
        }
        const records = await decisionsFixture();
        const evidenceProjectId = `${projectId}-evidence`;
        await database.insert(project).values({
          id: evidenceProjectId,
          name: "Evidence Project",
          shortCode: `EV-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
          starterConfiguration: "Blank Project",
          workspaceId,
        });
        const lifecycle = createDatabaseWorkLifecycle(database);
        const evidenceWork = await lifecycle.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: "concurrent-evidence",
          projectId: evidenceProjectId,
          title: "Earlier evidence",
          type: "Task",
        });
        await database.insert(workRelation).values({
          id: crypto.randomUUID(),
          kind: "Evidence",
          sourceWorkId: evidenceWork.id,
          targetLabel: "Choice 0",
          targetProjectId: projectId,
          targetRecordId: sourceIds[0],
          targetRecordType: "Decision",
        });
        const preview = await records.supersession.preview(
          accountId,
          replacement(),
        );
        if (!preview) {
          throw new Error("Preview required");
        }
        const evidenceLocked = Promise.withResolvers<void>();
        const releaseEvidence = Promise.withResolvers<void>();
        // Counterpart fixture holds the source Project/Work write boundary until confirmation finishes.
        const writer = database.transaction(async (transaction) => {
          try {
            await transaction
              .select()
              .from(project)
              .where(eq(project.id, evidenceProjectId))
              .for("update");
            if (changing === "Work") {
              await transaction
                .update(workTable)
                .set({
                  title: "Changed evidence",
                  revision: evidenceWork.revision + 1,
                })
                .where(eq(workTable.id, evidenceWork.id));
            } else {
              await transaction
                .update(workRelation)
                .set({ targetLabel: "Changed evidence label", revision: 1 })
                .where(eq(workRelation.sourceWorkId, evidenceWork.id));
            }
            evidenceLocked.resolve();
            await releaseEvidence.promise;
          } catch (error) {
            evidenceLocked.reject(error);
            throw error;
          }
        });
        try {
          await evidenceLocked.promise;
          await expect(
            records.supersession.commit(accountId, {
              ...preview.command,
              clientIdempotencyKey: "concurrent-confirmation",
            }),
          ).rejects.toBeInstanceOf(ProjectSourceRecordConflictError);
        } finally {
          releaseEvidence.resolve();
          await writer;
        }
        expect(
          (await records.supersession.read(accountId, projectId))?.relations,
        ).toEqual([]);
        expect(
          await records.find(accountId, "Decision", sourceIds[0]),
        ).toMatchObject({ life: "Valid" });
        expect(
          await records.supersession.history(accountId, projectId),
        ).toEqual([]);
        await expect(
          records.supersession.commit(accountId, {
            ...preview.command,
            clientIdempotencyKey: "concurrent-confirmation",
          }),
        ).rejects.toBeInstanceOf(ProjectSourceRecordConflictError);
        const refreshed = await records.supersession.preview(
          accountId,
          replacement(),
        );
        expect(refreshed?.graph.evidence).toEqual([
          expect.objectContaining({
            title:
              changing === "Work" ? "Changed evidence" : "Earlier evidence",
          }),
        ]);
        if (!refreshed) {
          throw new Error("Preview required");
        }
        expect(
          await records.supersession.commit(accountId, {
            ...refreshed.command,
            clientIdempotencyKey: "refreshed-confirmation",
          }),
        ).not.toBeNull();
      },
    );

    test.each(["Document", "Evidence link", "Unrelated evidence link"])(
      "confirms only against stable Document evidence while %s is being updated",
      async (changing) => {
        if (!database) {
          throw new Error("Database required");
        }
        const records = await decisionsFixture();
        const documentId = `evidence-${crypto.randomUUID()}`;
        const linkId = `evidence-link-${crypto.randomUUID()}`;
        const unrelated = changing === "Unrelated evidence link";
        if (unrelated) {
          const otherProjectId = `${projectId}-other`;
          await database.insert(project).values({
            id: otherProjectId,
            name: "Other Project",
            shortCode: `OT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
            starterConfiguration: "Blank Project",
            workspaceId,
          });
          await records.create(accountId, {
            id: sourceIds[3],
            projectId: otherProjectId,
            sourceType: "Decision",
            title: "Other choice",
            decision: "Independent choice",
            rationale: null,
            baseRevision: 0,
            clientIdempotencyKey: "other-choice",
          });
        }
        // Document evidence is a counterpart fixture; this seam owns confirmation.
        await database.insert(document).values({
          id: documentId,
          workspaceId,
          title: "Decision evidence",
          body: "Evidence excerpt",
          revision: 1,
        });
        await database.insert(usageLink).values({
          id: linkId,
          workspaceId,
          sourceRecordType: "Document",
          sourceRecordId: documentId,
          surfaceRecordType: "Decision",
          surfaceRecordId: unrelated ? sourceIds[3] : sourceIds[0],
          kind: "Pinned bind",
          location: { documentVersion: 1, excerpt: "Evidence excerpt" },
        });
        const preview = await records.supersession.preview(
          accountId,
          replacement(),
        );
        if (!preview) {
          throw new Error("Preview required");
        }
        expect(preview.graph.evidence).toHaveLength(unrelated ? 0 : 1);
        const evidenceLocked = Promise.withResolvers<void>();
        const releaseEvidence = Promise.withResolvers<void>();
        const writer = database.transaction(async (transaction) => {
          try {
            if (changing === "Document") {
              await transaction
                .update(document)
                .set({ title: "Changed evidence", revision: 2 })
                .where(eq(document.id, documentId));
            } else {
              await transaction
                .delete(usageLink)
                .where(eq(usageLink.id, linkId));
            }
            evidenceLocked.resolve();
            await releaseEvidence.promise;
          } catch (error) {
            evidenceLocked.reject(error);
            throw error;
          }
        });
        const command = {
          ...preview.command,
          clientIdempotencyKey: "document-confirmation",
        };
        try {
          await evidenceLocked.promise;
          if (unrelated) {
            expect(
              await records.supersession.commit(accountId, command),
            ).not.toBeNull();
          } else {
            await expect(
              records.supersession.commit(accountId, command),
            ).rejects.toBeInstanceOf(ProjectSourceRecordConflictError);
          }
        } finally {
          releaseEvidence.resolve();
          await writer;
        }
        if (unrelated) {
          expect(
            (await records.supersession.read(accountId, projectId))?.relations,
          ).toHaveLength(1);
          return;
        }
        expect(
          await records.find(accountId, "Decision", sourceIds[0]),
        ).toMatchObject({ life: "Valid" });
        expect(
          (await records.supersession.read(accountId, projectId))?.relations,
        ).toEqual([]);
        expect(
          await records.supersession.history(accountId, projectId),
        ).toEqual([]);
        await expect(
          records.supersession.commit(accountId, command),
        ).rejects.toBeInstanceOf(ProjectSourceRecordConflictError);
        const refreshed = await records.supersession.preview(
          accountId,
          replacement(),
        );
        if (!refreshed) {
          throw new Error("Preview required");
        }
        expect(
          await records.supersession.commit(accountId, {
            ...refreshed.command,
            clientIdempotencyKey: "fresh-document-confirmation",
          }),
        ).not.toBeNull();
      },
    );

    test("supersession retains evidence and relations and never writes related Work, Risk, Assumption or Project Release", async () => {
      if (!database) {
        throw new Error("Database required");
      }
      const records = await decisionsFixture();
      const lifecycle = createDatabaseWorkLifecycle(database);
      const relatedWork = await lifecycle.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "related-work",
        projectId,
        title: "Implement scope",
        type: "Task",
      });
      await database.insert(workRelation).values({
        id: crypto.randomUUID(),
        kind: "Evidence",
        sourceWorkId: relatedWork.id,
        targetLabel: "Choice 0",
        targetProjectId: projectId,
        targetRecordId: sourceIds[0],
        targetRecordType: "Decision",
      });
      // Risk is a non-writing counterpart fixture; its create behavior belongs to its owning spec.
      await database.insert(risk).values({
        id: sourceIds[3],
        projectId,
        title: "Capacity",
        revision: 1,
      });
      const relatedRisk = await records.find(accountId, "Risk", sourceIds[3]);
      const relatedAssumption = await records.create(accountId, {
        id: sourceIds[4],
        projectId,
        sourceType: "Assumption",
        title: "Demand",
        statement: "Demand stays stable",
        rationale: null,
        baseRevision: 0,
        clientIdempotencyKey: "assumption",
      });
      const relatedRelease = await records.create(accountId, {
        id: `${projectId}-release`,
        projectId,
        sourceType: "Project Release",
        name: "Beta",
        description: null,
        versionLabel: null,
        baseRevision: 0,
        clientIdempotencyKey: "release",
      });
      const relations = createDatabaseRelations(database);
      const beforeRelations = await relations.list(accountId, {
        recordType: "Work",
        recordId: relatedWork.id,
      });
      const beforeWork = await lifecycle.find(accountId, relatedWork.id);
      const preview = await records.supersession.preview(
        accountId,
        replacement(),
      );
      if (!preview) {
        throw new Error("Preview required");
      }
      expect(preview.graph.evidence).toEqual([
        expect.objectContaining({
          decisionId: sourceIds[0],
          title: "Implement scope",
        }),
      ]);
      expect(
        (await records.supersession.read(accountId, projectId))?.relations,
      ).toEqual([]);
      await records.supersession.commit(accountId, {
        ...preview.command,
        clientIdempotencyKey: "replace",
      });
      expect(await lifecycle.find(accountId, relatedWork.id)).toEqual(
        beforeWork,
      );
      expect(
        await relations.list(accountId, {
          recordType: "Work",
          recordId: relatedWork.id,
        }),
      ).toEqual(beforeRelations);
      expect(await records.find(accountId, "Risk", sourceIds[3])).toEqual(
        relatedRisk,
      );
      expect(await records.find(accountId, "Assumption", sourceIds[4])).toEqual(
        relatedAssumption,
      );
      expect(
        await records.find(
          accountId,
          "Project Release",
          `${projectId}-release`,
        ),
      ).toEqual(relatedRelease);
      const after = await records.supersession.read(accountId, projectId);
      expect(after?.evidence).toEqual(preview.graph.evidence);
      expect(
        after?.evidence.some((item) => item.decisionId === sourceIds[1]),
      ).toBe(false);
    });

    test("withdraws a Decision with a dated rationale without replacing its original rationale", async () => {
      if (!database) {
        throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
      }
      const records = createDatabaseProjectSourceRecords(database);
      const created = await records.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "decision-create",
        decision: "Ship a focused first release.",
        id: sourceIds[0],
        projectId,
        rationale: "Keep the initial scope inspectable.",
        sourceType: "Decision",
        title: "First release scope",
      });
      if (!created) {
        throw new Error("Decision creation failed");
      }
      const input = {
        baseRevision: created.revision,
        clientIdempotencyKey: "decision-withdraw",
        life: "Withdrawn" as const,
        projectId,
        sourceId: created.id,
        sourceType: "Decision" as const,
        rationale: "The release constraint no longer applies.",
      };
      const withdrawn = await records.transition(accountId, input);
      expect(withdrawn).toMatchObject({
        life: "Withdrawn",
        rationale: "Keep the initial scope inspectable.",
        withdrawalRationale: "The release constraint no longer applies.",
        withdrawnAt: expect.any(String),
        revision: 2,
      });
      await expect(
        records.find(accountId, "Decision", created.id),
      ).resolves.toEqual(withdrawn);
      await expect(records.transition(accountId, input)).resolves.toEqual(
        withdrawn,
      );
      await expect(
        records.transition(accountId, {
          ...input,
          clientIdempotencyKey: "stale-withdraw",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        records.find(`${accountId}-other`, "Decision", created.id),
      ).resolves.toBeNull();
    });

    test("Decisions listing respects Account ownership and archived Project writes", async () => {
      if (!database) {
        throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
      }
      const records = createDatabaseProjectSourceRecords(database);
      await expect(
        records.listDecisions(accountId, projectId),
      ).resolves.toEqual({ records: [], readOnly: false });
      await expect(
        records.listDecisions(`${accountId}-other`, projectId),
      ).resolves.toBeNull();
      await database
        .update(project)
        .set({ archivedAt: new Date() })
        .where(eq(project.id, projectId));
      await expect(
        records.listDecisions(accountId, projectId),
      ).resolves.toEqual({ records: [], readOnly: true });
      await expect(
        records.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: "archived-decision",
          id: sourceIds[0],
          projectId,
          sourceType: "Decision",
          title: "Release scope",
          decision: "Ship.",
          rationale: null,
        }),
      ).resolves.toBeNull();
    });

    test("closing related Work leaves its Decision Valid with the original rationale", async () => {
      if (!database) {
        throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
      }
      const records = createDatabaseProjectSourceRecords(database);
      const created = await records.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "decision-create",
        id: sourceIds[0],
        projectId,
        sourceType: "Decision",
        title: "Release scope",
        decision: "Ship a focused first release.",
        rationale: "Keep the initial scope inspectable.",
      });
      if (created?.sourceType !== "Decision") {
        throw new Error("Decision creation failed");
      }
      const lifecycle = createDatabaseWorkLifecycle(database);
      const work = await lifecycle.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "decision-work-create",
        projectId,
        title: "Ship the release",
        type: "Task",
      });
      // The Relations counterpart has no Decision create flow yet; seed its existing typed link.
      await database.insert(workRelation).values({
        id: crypto.randomUUID(),
        kind: "Related",
        sourceWorkId: work.id,
        targetLabel: created.title,
        targetProjectId: projectId,
        targetRecordId: created.id,
        targetRecordType: "Decision",
      });
      await lifecycle.close(
        accountId,
        {
          baseRevision: work.revision,
          clientIdempotencyKey: "decision-work-close",
          workId: work.id,
          closureResult: "Completed",
          reason: null,
        },
        { kind: "Visible user" },
      );
      await expect(
        records.find(accountId, "Decision", created.id),
      ).resolves.toEqual(created);
    });

    test("records source creation and explicit lifecycle transitions in mutation history", async () => {
      if (!database) {
        throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
      }
      const records = createDatabaseProjectSourceRecords(database);
      const [
        decisionId,
        milestoneId,
        abandonedMilestoneId,
        releaseId,
        incidentId,
      ] = sourceIds;
      const [
        decisionRecord,
        milestoneRecord,
        releaseRecord,
        incidentRecord,
        abandonedMilestone,
      ] = await Promise.all([
        records.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: "decision-create",
          decision: "Ship a focused first release.",
          id: decisionId,
          projectId,
          rationale: "Keep the initial scope inspectable.",
          sourceType: "Decision",
          title: "First release scope",
        }),
        records.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: "milestone-create",
          description: "A small invited beta.",
          id: milestoneId,
          projectId,
          sourceType: "Milestone",
          targetDate: "2026-10-01",
          title: "Private beta",
        }),
        records.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: "release-create",
          description: null,
          id: releaseId,
          name: "First release",
          projectId,
          sourceType: "Project Release",
          versionLabel: "1.0.0",
        }),
        records.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: "incident-create",
          detectedHow: "Support reports.",
          id: incidentId,
          impact: "Requests were delayed.",
          learning: null,
          occurredAt: "2026-09-27T10:00:00.000Z",
          projectId,
          resolution: null,
          rootCause: null,
          sourceType: "Production Incident",
          title: "Queue delay",
        }),
        records.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: "milestone-abandon-create",
          description: null,
          id: abandonedMilestoneId,
          projectId,
          sourceType: "Milestone",
          targetDate: null,
          title: "Deferred launch",
        }),
      ]);

      expect(decisionRecord).toMatchObject({ life: "Valid", revision: 1 });
      expect(milestoneRecord).toMatchObject({ status: "Planned", revision: 1 });
      expect(releaseRecord).toMatchObject({ status: "Draft", revision: 1 });
      expect(incidentRecord).toMatchObject({ status: "Open", revision: 1 });
      expect(abandonedMilestone).toMatchObject({
        status: "Planned",
        revision: 1,
      });
      if (
        !(
          decisionRecord &&
          milestoneRecord &&
          releaseRecord &&
          incidentRecord &&
          abandonedMilestone
        )
      ) {
        throw new Error("Project source record creation failed");
      }

      const updatedDecision = await records.update(accountId, {
        baseRevision: decisionRecord.revision,
        clientIdempotencyKey: "decision-update",
        decision: "Ship a focused first release.",
        projectId,
        rationale: "The current scope is small enough to verify.",
        sourceId: decisionId,
        sourceType: "Decision",
        title: "First release scope clarified",
      });
      if (!updatedDecision) {
        throw new Error("Decision update failed");
      }
      await records.transition(accountId, {
        baseRevision: updatedDecision.revision,
        clientIdempotencyKey: "decision-withdraw",
        life: "Withdrawn",
        projectId,
        sourceId: decisionId,
        sourceType: "Decision",
      });
      await records.transition(accountId, {
        baseRevision: milestoneRecord.revision,
        clientIdempotencyKey: "milestone-reached",
        projectId,
        sourceId: milestoneId,
        sourceType: "Milestone",
        status: "Reached",
      });
      await records.transition(accountId, {
        baseRevision: abandonedMilestone.revision,
        clientIdempotencyKey: "milestone-abandon",
        projectId,
        sourceId: abandonedMilestoneId,
        sourceType: "Milestone",
        status: "Abandoned",
      });
      const preparingRelease = await records.transition(accountId, {
        baseRevision: releaseRecord.revision,
        clientIdempotencyKey: "release-preparing",
        projectId,
        sourceId: releaseId,
        sourceType: "Project Release",
        status: "Preparing",
      });
      if (!preparingRelease) {
        throw new Error("Project Release transition failed");
      }
      await records.transition(accountId, {
        baseRevision: preparingRelease.revision,
        clientIdempotencyKey: "release-published",
        projectId,
        sourceId: releaseId,
        sourceType: "Project Release",
        status: "Published",
      });
      const watchingIncident = await records.transition(accountId, {
        baseRevision: incidentRecord.revision,
        clientIdempotencyKey: "incident-watching",
        projectId,
        sourceId: incidentId,
        sourceType: "Production Incident",
        status: "Watching",
      });
      if (!watchingIncident) {
        throw new Error("Production Incident transition failed");
      }
      await records.transition(accountId, {
        baseRevision: watchingIncident.revision,
        clientIdempotencyKey: "incident-resolved",
        projectId,
        sourceId: incidentId,
        sourceType: "Production Incident",
        status: "Resolved",
      });

      const listed = await records.list(accountId, projectId);
      const history = await database
        .select()
        .from(mutationHistory)
        .where(eq(mutationHistory.actorId, accountId));
      expect(listed?.map(({ sourceType }) => sourceType).sort()).toEqual([
        "Decision",
        "Milestone",
        "Milestone",
        "Production Incident",
        "Project Release",
      ]);
      expect(
        history
          .filter(({ targetId }) => new Set<string>(sourceIds).has(targetId))
          .map(({ nextValue }) => nextValue),
      ).toHaveLength(13);
      await expect(
        records.find(accountId, "Project Release", releaseId),
      ).resolves.toMatchObject({ status: "Published", versionLabel: "1.0.0" });
      await expect(
        records.find(`${accountId}-other`, "Project Release", releaseId),
      ).resolves.toBeNull();
      await expect(
        records.list(`${accountId}-other`, projectId),
      ).resolves.toBeNull();
      await expect(
        records.transition(accountId, {
          baseRevision: 3,
          clientIdempotencyKey: "release-cancel-after-publish",
          projectId,
          sourceId: releaseId,
          sourceType: "Project Release",
          status: "Cancelled",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
  },
);
