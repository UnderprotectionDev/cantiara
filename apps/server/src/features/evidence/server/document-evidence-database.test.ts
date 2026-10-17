// biome-ignore-all lint/performance/noAwaitInLoops: Two fixture accounts are inserted in order.
import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { evidenceBinding, recordOrigin } from "@cantiara/db/schema/evidence";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  createDatabaseDocumentMutationContracts,
  createDatabaseDocuments,
} from "../../documents/server/documents-database";
import { createDatabaseDocumentEvidence } from "./document-evidence-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
(databaseUrl ? describe : describe.skip)(
  "Evidence seam: Document version-pinned text ranges",
  () => {
    const db = databaseUrl
      ? createDb({ DATABASE_URL: databaseUrl })
      : undefined;
    const accountId = `evidence-${crypto.randomUUID()}`;
    const strangerId = `stranger-${crypto.randomUUID()}`;
    const workspaceId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const decisionId = crypto.randomUUID();

    function client(principal = accountId) {
      if (!db) {
        throw new Error("Database required");
      }
      const context = {
        accountAccess: {
          listSessions: async () => [],
          revokeOtherSessions: async () => undefined,
          revokeSession: async () => undefined,
        },
        auth: null,
        db,
        documentEvidence: createDatabaseDocumentEvidence(db),
        documentMutationContracts: createDatabaseDocumentMutationContracts(db),
        documents: createDatabaseDocuments(db),
        githubAvailability: { getStatus: () => "available" },
        session: {
          session: { id: "session-1" },
          user: { id: principal },
        } as Context["session"],
      } as unknown as Context;
      return createRouterClient(appRouter, { context });
    }

    beforeAll(async () => {
      if (!db) {
        throw new Error("Database required");
      }
      for (const id of [accountId, strangerId]) {
        await db
          .insert(user)
          .values({ id, name: "Founder", email: `${id}@example.invalid` });
      }
      await db
        .insert(workspace)
        .values({ id: workspaceId, ownerAccountId: accountId });
      await db.insert(project).values({
        id: projectId,
        workspaceId,
        name: "Evidence journey",
        shortCode: `E${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      });
      await db.insert(decision).values({
        id: decisionId,
        projectId,
        title: "Keep exports local",
        decision: "Keep exports local",
      });
    });
    afterAll(async () => {
      await db?.delete(user).where(eq(user.id, accountId));
      await db?.delete(user).where(eq(user.id, strangerId));
      await db?.$client.end();
    });

    async function createDocument(body: string) {
      return await client().createDocument({
        projectId,
        title: "Interview notes",
        body,
        type: "General",
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
      });
    }

    test("binds an exact range to an existing record, keeps the pin on a new version, and rebinds only through an explicit preview", async () => {
      const api = client();
      const source = await createDocument("Founders want local exports. Done.");
      const selection = { documentId: source.id, projectId };
      const plan = await api.previewDocumentEvidence({
        ...selection,
        versionRevision: source.revision,
        start: 0,
        end: 27,
        target: { type: "Decision", projectId, recordId: decisionId },
      });
      expect(plan).toMatchObject({
        mode: "bind",
        targetTitle: "Keep exports local",
        pin: {
          source: { recordType: "Document", revision: source.revision },
          excerpt: "Founders want local exports",
          before: "",
          after: ". Done.",
        },
      });
      // The preview writes nothing and leaves the source in place.
      expect(await api.documentEvidenceBindings(selection)).toEqual([]);

      const input = {
        ...selection,
        id: crypto.randomUUID(),
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        plan,
      };
      const bound = await api.confirmDocumentEvidence(input);
      expect(await api.confirmDocumentEvidence(input)).toEqual(bound);
      expect(bound).toMatchObject({
        role: "Unspecified",
        origin: false,
        newerVersionExists: false,
      });

      const edited = await api.updateDocument({
        documentId: source.id,
        body: "Founders now want hosted exports. Done.",
        baseRevision: source.revision,
        clientIdempotencyKey: crypto.randomUUID(),
      });
      const [older] = (await api.documentEvidenceBindings(selection)) ?? [];
      expect(older).toMatchObject({
        newerVersionExists: true,
        currentRevision: edited.revision,
        pin: {
          source: { revision: source.revision },
          excerpt: "Founders want local exports",
        },
      });
      const [forTarget] =
        (await api.documentEvidenceForTarget({
          type: "Decision",
          projectId,
          recordId: decisionId,
        })) ?? [];
      expect(forTarget).toMatchObject({
        newerVersionExists: true,
        pin: { excerpt: "Founders want local exports" },
        source: { title: "Interview notes", canOpenSourceRecord: true },
      });

      const rebind = await api.previewDocumentEvidence({
        ...selection,
        bindingId: input.id,
        versionRevision: edited.revision,
        start: 0,
        end: 32,
      });
      expect(rebind).toMatchObject({
        mode: "rebind",
        bindingRevision: 1,
        pin: { excerpt: "Founders now want hosted exports" },
      });
      // The stored pin is untouched until the explicit confirmation.
      const [stillOld] = (await api.documentEvidenceBindings(selection)) ?? [];
      expect(stillOld?.pin.excerpt).toBe("Founders want local exports");
      const rebound = await api.confirmDocumentEvidence({
        ...selection,
        id: input.id,
        baseRevision: 1,
        clientIdempotencyKey: crypto.randomUUID(),
        plan: rebind,
      });
      // A rebind keeps the original bind identity; only the pin and revision move.
      expect(rebound).toMatchObject({
        revision: 2,
        origin: false,
        newerVersionExists: false,
        createdAt: bound.createdAt,
        actorId: bound.actorId,
      });
      const [moved] = (await api.documentEvidenceBindings(selection)) ?? [];
      expect(moved).toMatchObject({
        revision: 2,
        newerVersionExists: false,
        pin: { source: { revision: edited.revision } },
      });
    });

    test("converts selected text into exactly one new record with an Origin Location and no silent duplicates", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const api = client();
      const source = await createDocument("Customers trust offline mode.");
      const selection = { documentId: source.id, projectId };
      const plan = await api.previewDocumentEvidence({
        ...selection,
        versionRevision: source.revision,
        start: 0,
        end: 28,
        newRecord: { type: "Assumption", projectId, title: "Offline trust" },
      });
      expect(plan).toMatchObject({
        mode: "create",
        fields: {
          title: "Offline trust",
          statement: "Customers trust offline mode",
        },
      });
      expect(
        await db
          .select()
          .from(assumption)
          .where(eq(assumption.projectId, projectId)),
      ).toHaveLength(0);

      const input = {
        ...selection,
        id: crypto.randomUUID(),
        recordId: crypto.randomUUID(),
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        plan,
      };
      const created = await api.confirmDocumentEvidence(input);
      expect(await api.confirmDocumentEvidence(input)).toEqual(created);
      expect(created).toMatchObject({
        origin: true,
        target: { type: "Assumption", recordId: input.recordId },
      });
      const rows = await db
        .select()
        .from(assumption)
        .where(eq(assumption.projectId, projectId));
      expect(rows).toMatchObject([
        { id: input.recordId, statement: "Customers trust offline mode" },
      ]);
      const [origin] = await db
        .select()
        .from(recordOrigin)
        .where(eq(recordOrigin.evidenceBindingId, input.id));
      expect(origin).toMatchObject({
        sourceRecordId: source.id,
        targetRecordId: input.recordId,
        location: { recordType: "Document", revision: source.revision },
      });

      const workPlan = await api.previewDocumentEvidence({
        ...selection,
        versionRevision: source.revision,
        start: 0,
        end: 9,
        newRecord: {
          type: "Work",
          projectId,
          title: "Check customers",
          workType: "Task",
        },
      });
      const workInput = {
        ...selection,
        id: crypto.randomUUID(),
        recordId: crypto.randomUUID(),
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        plan: workPlan,
      };
      await api.confirmDocumentEvidence(workInput);
      await api.confirmDocumentEvidence(workInput);
      expect(
        await db.select().from(work).where(eq(work.id, workInput.recordId)),
      ).toMatchObject([
        { description: "Customers", originOwnerRecordId: source.id },
      ]);
    });

    test("refuses a forged plan, an out-of-range selection and another Account", async () => {
      const api = client();
      const source = await createDocument("Short note.");
      const selection = { documentId: source.id, projectId };
      const plan = await api.previewDocumentEvidence({
        ...selection,
        versionRevision: source.revision,
        start: 0,
        end: 5,
        target: { type: "Decision", projectId, recordId: decisionId },
      });
      await expect(
        api.confirmDocumentEvidence({
          ...selection,
          id: crypto.randomUUID(),
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
          plan: { ...plan, pin: { ...plan.pin, excerpt: "Forge" } },
        }),
      ).rejects.toThrow();
      await expect(
        api.previewDocumentEvidence({
          ...selection,
          versionRevision: source.revision,
          start: 0,
          end: 500,
          target: { type: "Decision", projectId, recordId: decisionId },
        }),
      ).rejects.toThrow();
      await expect(
        client(strangerId).previewDocumentEvidence({
          ...selection,
          versionRevision: source.revision,
          start: 0,
          end: 5,
          target: { type: "Decision", projectId, recordId: decisionId },
        }),
      ).rejects.toThrow();
      expect(
        await db
          ?.select()
          .from(evidenceBinding)
          .where(eq(evidenceBinding.sourceRecordId, source.id)),
      ).toHaveLength(0);
    });

    test("keeps the historical bind but closes content access when the source Document is gone", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const api = client();
      const source = await createDocument("Sensitive finding.");
      const plan = await api.previewDocumentEvidence({
        documentId: source.id,
        projectId,
        versionRevision: source.revision,
        start: 0,
        end: 17,
        target: { type: "Decision", projectId, recordId: decisionId },
      });
      const id = crypto.randomUUID();
      await api.confirmDocumentEvidence({
        documentId: source.id,
        projectId,
        id,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        plan,
      });
      await db.delete(document).where(eq(document.id, source.id));
      const rows = await api.documentEvidenceForTarget({
        type: "Decision",
        projectId,
        recordId: decisionId,
      });
      const row = rows?.find((item) => item.id === id);
      expect(row).toMatchObject({
        pin: null,
        source: {
          title: null,
          brokenReason: "Permanently deleted",
          canOpenSourceRecord: false,
        },
      });
      expect(JSON.stringify(row)).not.toContain("Sensitive finding");
    });

    test("keeps an archived Project's pin readable but marks its source Archived", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const api = client();
      const archivedProjectId = crypto.randomUUID();
      await db.insert(project).values({
        id: archivedProjectId,
        workspaceId,
        name: "Archived source",
        shortCode: `A${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      });
      const source = await api.createDocument({
        projectId: archivedProjectId,
        title: "Archived notes",
        body: "Retained finding.",
        type: "General",
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
      });
      const plan = await api.previewDocumentEvidence({
        documentId: source.id,
        projectId: archivedProjectId,
        versionRevision: source.revision,
        start: 0,
        end: 17,
        target: { type: "Decision", projectId, recordId: decisionId },
      });
      const id = crypto.randomUUID();
      await api.confirmDocumentEvidence({
        documentId: source.id,
        projectId: archivedProjectId,
        id,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        plan,
      });
      await db
        .update(project)
        .set({ archivedAt: new Date() })
        .where(eq(project.id, archivedProjectId));
      const rows = await api.documentEvidenceForTarget({
        type: "Decision",
        projectId,
        recordId: decisionId,
      });
      const row = rows?.find((item) => item.id === id);
      expect(row).toMatchObject({
        pin: { excerpt: "Retained finding." },
        source: {
          title: "Archived notes",
          brokenReason: "Archived",
          canOpenSourceRecord: true,
        },
      });
    });

    test("reports an out-of-range preview as CONFLICT, not a server failure", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const source = await createDocument("Short note.");
      await expect(
        client().previewDocumentEvidence({
          documentId: source.id,
          projectId,
          versionRevision: source.revision,
          start: 0,
          end: 999,
          target: { type: "Decision", projectId, recordId: decisionId },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
  },
);
