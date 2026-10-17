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
import { workRelation } from "@cantiara/db/schema/relation";
import { researchSession } from "@cantiara/db/schema/research-session";
import { work } from "@cantiara/db/schema/work";
import { createRouterClient } from "@orpc/server";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
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

    test("sets the Evidence Role as a user choice on the relation, keeps Founder interpretation and history apart, and never derives a verdict", async () => {
      const api = client();
      const source = await createDocument("Founders want local exports. Done.");
      const selection = { documentId: source.id, projectId };
      const [riskId, secondId] = [crypto.randomUUID(), crypto.randomUUID()];
      await db?.insert(decision).values([
        { id: riskId, projectId, title: "Role target A", decision: "A" },
        { id: secondId, projectId, title: "Role target B", decision: "B" },
      ]);
      async function bind(recordId: string) {
        const plan = await api.previewDocumentEvidence({
          ...selection,
          versionRevision: source.revision,
          start: 0,
          end: 27,
          target: { type: "Decision", projectId, recordId },
        });
        return await api.confirmDocumentEvidence({
          ...selection,
          id: crypto.randomUUID(),
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
          plan,
        });
      }
      const first = await bind(riskId);
      const second = await bind(secondId);
      // A bind without a role is allowed and stays Unspecified.
      expect(first).toMatchObject({
        role: "Unspecified",
        interpretation: null,
      });

      const decisionsBefore = await db?.select().from(decision);
      const roleInput = {
        ...selection,
        id: first?.id ?? "",
        baseRevision: first?.revision ?? 0,
        clientIdempotencyKey: crypto.randomUUID(),
        role: "Contradicting" as const,
        interpretation: "  Customers asked for hosted sync  ",
      };
      const set = await api.setDocumentEvidenceRole(roleInput);
      expect(await api.setDocumentEvidenceRole(roleInput)).toEqual(set);
      expect(set).toMatchObject({
        revision: 2,
        role: "Contradicting",
        interpretation: "Customers asked for hosted sync",
        // The pinned source text is untouched by role and interpretation.
        pin: { excerpt: "Founders want local exports" },
      });
      // The role stays on this relation: the other relation and the Source are unchanged.
      const listed = await api.documentEvidenceBindings(selection);
      expect(listed?.find((item) => item.id === second?.id)).toMatchObject({
        role: "Unspecified",
        interpretation: null,
      });
      const [stored] =
        (await db
          ?.select({ revision: document.revision, body: document.body })
          .from(document)
          .where(eq(document.id, source.id))) ?? [];
      expect(stored).toEqual({
        revision: source.revision,
        body: "Founders want local exports. Done.",
      });
      // Contradicting spawns no Decision/Risk/Work state.
      expect(await db?.select().from(decision)).toEqual(decisionsBefore);

      // Editing keeps the previous values with actor and time.
      await api.setDocumentEvidenceRole({
        ...selection,
        id: first?.id ?? "",
        baseRevision: 2,
        clientIdempotencyKey: crypto.randomUUID(),
        role: "Inconclusive",
        interpretation: null,
      });
      const history = await api.documentEvidenceHistory({
        ...selection,
        id: first?.id ?? "",
      });
      expect(history).toMatchObject([
        {
          revision: 2,
          previousRole: "Unspecified",
          previousInterpretation: null,
          role: "Contradicting",
          interpretation: "Customers asked for hosted sync",
          actorId: accountId,
        },
        {
          revision: 3,
          previousRole: "Contradicting",
          previousInterpretation: "Customers asked for hosted sync",
          role: "Inconclusive",
          interpretation: null,
          actorId: accountId,
        },
      ]);

      // A new Source version does not reinterpret the role.
      await api.updateDocument({
        documentId: source.id,
        body: "Founders now want hosted exports. Done.",
        baseRevision: source.revision,
        clientIdempotencyKey: crypto.randomUUID(),
      });
      const [kept] =
        (await api.documentEvidenceBindings(selection))?.filter(
          (item) => item.id === first?.id,
        ) ?? [];
      expect(kept).toMatchObject({
        role: "Inconclusive",
        newerVersionExists: true,
      });
      // A stale base revision conflicts instead of overwriting.
      await expect(
        api.setDocumentEvidenceRole({
          ...selection,
          id: first?.id ?? "",
          baseRevision: 2,
          clientIdempotencyKey: crypto.randomUUID(),
          role: "Supporting",
          interpretation: null,
        }),
      ).rejects.toThrow();
      // Another Account can neither set nor read the role or history.
      const other = client(strangerId);
      expect(
        await other
          .setDocumentEvidenceRole({
            ...selection,
            id: first?.id ?? "",
            baseRevision: 3,
            clientIdempotencyKey: crypto.randomUUID(),
            role: "Supporting",
            interpretation: null,
          })
          .catch(() => null),
      ).toBeNull();
      expect(
        await other.documentEvidenceHistory({
          ...selection,
          id: first?.id ?? "",
        }),
      ).toBeNull();
    });

    test("withholds the role and interpretation of evidence whose source is gone", async () => {
      const api = client();
      const source = await createDocument("Founders want local exports. Done.");
      const selection = { documentId: source.id, projectId };
      const targetId = crypto.randomUUID();
      await db?.insert(decision).values({
        id: targetId,
        projectId,
        title: "Withheld target",
        decision: "W",
      });
      const plan = await api.previewDocumentEvidence({
        ...selection,
        versionRevision: source.revision,
        start: 0,
        end: 27,
        target: { type: "Decision", projectId, recordId: targetId },
      });
      const bound = await api.confirmDocumentEvidence({
        ...selection,
        id: crypto.randomUUID(),
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        plan,
      });
      await api.setDocumentEvidenceRole({
        ...selection,
        id: bound?.id ?? "",
        baseRevision: 1,
        clientIdempotencyKey: crypto.randomUUID(),
        role: "Supporting",
        interpretation: "Private note",
      });
      const target = {
        type: "Decision" as const,
        projectId,
        recordId: targetId,
      };
      expect((await api.documentEvidenceForTarget(target))?.[0]).toMatchObject({
        role: "Supporting",
        interpretation: "Private note",
      });
      await db?.delete(document).where(eq(document.id, source.id));
      expect(
        await api.documentEvidenceHistory({
          ...selection,
          id: bound?.id ?? "",
        }),
      ).toBeNull();
      expect((await api.documentEvidenceForTarget(target))?.[0]).toMatchObject({
        pin: null,
        role: null,
        interpretation: null,
        source: { brokenReason: "Permanently deleted" },
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

    test("Evidence Flow lists only explicit bindings in time order, filters by source type, writes nothing and withholds a gone source", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const api = client();
      const flowDecisionId = crypto.randomUUID();
      await db.insert(decision).values({
        id: flowDecisionId,
        projectId,
        title: "Flow target",
        decision: "Flow target",
      });
      const target = {
        type: "Decision" as const,
        projectId,
        recordId: flowDecisionId,
      };
      // A Document in the same project that nothing binds to the target is not evidence.
      await createDocument("Flow target unrelated.");
      const ids: string[] = [];
      for (const body of ["First finding.", "Second finding."]) {
        const source = await createDocument(body);
        const plan = await api.previewDocumentEvidence({
          documentId: source.id,
          projectId,
          versionRevision: source.revision,
          start: 0,
          end: 5,
          target,
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
        ids.push(id);
      }
      const before = await db.select().from(evidenceBinding);
      const flow = await api.evidenceFlow(target);
      expect(flow?.map((row) => row.id)).toEqual(ids);
      expect(flow?.[0]).toMatchObject({
        sourceType: "Document",
        role: "Unspecified",
        pin: { excerpt: "First" },
      });
      expect(
        await api.evidenceFlow({ ...target, sourceType: "Source" }),
      ).toEqual([]);
      expect(
        (await api.evidenceFlow({ ...target, sourceType: "Document" }))?.length,
      ).toBe(2);
      // Reading the flow writes no relation, source or target life.
      expect(await db.select().from(evidenceBinding)).toEqual(before);
      expect(
        await client(strangerId)
          .evidenceFlow(target)
          .catch(() => null),
      ).toBeNull();

      const firstSourceId = flow?.[0]?.source.recordId ?? "";
      await db.delete(document).where(eq(document.id, firstSourceId));
      const after = await api.evidenceFlow(target);
      expect(after?.[0]).toMatchObject({
        pin: null,
        role: null,
        source: {
          title: null,
          brokenReason: "Permanently deleted",
          canOpenSourceRecord: false,
        },
      });
      expect(JSON.stringify(after?.[0])).not.toContain("First");
    });

    test("Evidence Flow includes Research Session evidence under current Consent, names a missing component, and ignores Related relations", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const api = client();
      const workId = crypto.randomUUID();
      const otherWorkId = crypto.randomUUID();
      for (const [id, number] of [
        [workId, 9001],
        [otherWorkId, 9002],
      ] as const) {
        await db.insert(work).values({
          id,
          projectId,
          key: `E-${number}`,
          number,
          title: "Flow work",
          type: "Task",
        });
      }
      // A general Related relation is not evidence.
      await db.insert(workRelation).values({
        id: crypto.randomUUID(),
        kind: "Related",
        sourceWorkId: otherWorkId,
        targetProjectId: projectId,
        targetRecordId: workId,
        targetLabel: "Flow work",
      });
      const target = { type: "Work" as const, projectId, recordId: workId };
      expect(await api.evidenceFlow(target)).toEqual([]);

      const sessionId = crypto.randomUUID();
      const session = (consent: string, ids: string[]) => ({
        id: sessionId,
        projectId,
        sourceType: "Research Session",
        revision: 1,
        title: "Interview 4",
        purpose: "Pricing",
        questionGuide: null,
        status: "Completed",
        scheduledAt: null,
        durationMinutes: null,
        channel: null,
        facilitator: null,
        scopeNote: null,
        participantContactId: null,
        consent,
        consentNote: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        participantConsentAtLink: "Allowed",
        consentRecordedBy: accountId,
        consentRecordedAt: "2026-01-01T00:00:00.000Z",
        content: ids.map((id) => ({
          consentAtCapture: "Allowed",
          content: {
            id,
            kind: "Observation",
            text: "Pricing confused them.",
            containsPersonalInformation: false,
            relationIds: [],
          },
        })),
      });
      await db.insert(researchSession).values({
        id: sessionId,
        projectId,
        revision: 1,
        data: session("Allowed", ["note-1"]),
      });
      await db.insert(evidenceBinding).values({
        id: crypto.randomUUID(),
        workspaceId,
        sourceProjectId: projectId,
        sourceRecordId: sessionId,
        targetProjectId: projectId,
        targetRecordId: workId,
        targetRecordType: "Work",
        pin: {
          source: {
            recordType: "Research Session",
            recordId: sessionId,
            projectId,
            revision: 1,
            componentId: "note-1",
          },
          start: 0,
          end: 7,
          excerpt: "Pricing",
          before: "",
          after: " confused them.",
        },
        actorId: accountId,
      });
      const open = await api.evidenceFlow(target);
      expect(open).toHaveLength(1);
      expect(open?.[0]).toMatchObject({
        sourceType: "Research Session",
        elementMissing: false,
        pin: { excerpt: "Pricing" },
        source: { title: "Interview 4", canOpenSourceRecord: true },
      });
      expect(
        await api.evidenceFlow({ ...target, sourceType: "Document" }),
      ).toEqual([]);

      // Revoked Consent closes the text without hiding that the bind exists.
      await db
        .update(researchSession)
        .set({ data: session("Not allowed", ["note-1"]) })
        .where(eq(researchSession.id, sessionId));
      const revoked = await api.evidenceFlow(target);
      expect(revoked?.[0]).toMatchObject({
        pin: null,
        role: null,
        source: { title: null, brokenReason: "No access" },
      });
      expect(JSON.stringify(revoked)).not.toContain("Pricing confused");

      // Revoked Consent also closes a removed component: no title or open reveal.
      await db
        .update(researchSession)
        .set({ data: session("Not allowed", ["note-2"]) })
        .where(eq(researchSession.id, sessionId));
      const revokedAndRemoved = await api.evidenceFlow(target);
      expect(revokedAndRemoved?.[0]).toMatchObject({
        elementMissing: false,
        pin: null,
        role: null,
        source: {
          title: null,
          brokenReason: "No access",
          canOpenSourceRecord: false,
        },
      });
      expect(JSON.stringify(revokedAndRemoved)).not.toContain("Interview 4");

      // A removed component never retargets silently.
      await db
        .update(researchSession)
        .set({ data: session("Allowed", ["note-2"]) })
        .where(eq(researchSession.id, sessionId));
      expect((await api.evidenceFlow(target))?.[0]).toMatchObject({
        elementMissing: true,
        pin: null,
        role: null,
      });
    });

    test("Evidence Flow treats a Research Session outside the pinned Project as permanently deleted", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const api = client();
      const otherProjectId = crypto.randomUUID();
      await db.insert(project).values({
        id: otherProjectId,
        workspaceId,
        name: "Other evidence project",
        shortCode: `O${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      });
      const workId = crypto.randomUUID();
      await db.insert(work).values({
        id: workId,
        projectId,
        key: "E-9003",
        number: 9003,
        title: "Moved session target",
        type: "Task",
      });
      const movedSessionId = crypto.randomUUID();
      await db.insert(researchSession).values({
        id: movedSessionId,
        projectId: otherProjectId,
        revision: 1,
        data: {
          id: movedSessionId,
          projectId: otherProjectId,
          sourceType: "Research Session",
          revision: 1,
          title: "Moved interview",
          purpose: "Pricing",
          questionGuide: null,
          status: "Completed",
          scheduledAt: null,
          durationMinutes: null,
          channel: null,
          facilitator: null,
          scopeNote: null,
          participantContactId: null,
          consent: "Allowed",
          consentNote: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          participantConsentAtLink: "Allowed",
          consentRecordedBy: accountId,
          consentRecordedAt: "2026-01-01T00:00:00.000Z",
          content: [],
        },
      });
      await db.insert(evidenceBinding).values({
        id: crypto.randomUUID(),
        workspaceId,
        sourceProjectId: projectId,
        sourceRecordId: movedSessionId,
        targetProjectId: projectId,
        targetRecordId: workId,
        targetRecordType: "Work",
        pin: {
          source: {
            recordType: "Research Session",
            recordId: movedSessionId,
            projectId,
            revision: 1,
            componentId: null,
          },
          start: 0,
          end: 5,
          excerpt: "Moved",
          before: "",
          after: " interview",
        },
        actorId: accountId,
      });
      const flow = await api.evidenceFlow({
        type: "Work",
        projectId,
        recordId: workId,
      });
      expect(flow?.[0]).toMatchObject({
        pin: null,
        source: {
          title: null,
          brokenReason: "Permanently deleted",
          canOpenSourceRecord: false,
        },
      });
      expect(JSON.stringify(flow)).not.toContain("Moved interview");
    });

    test("Evidence Flow lists explicit evidence on an Assumption target", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const api = client();
      const assumptionId = crypto.randomUUID();
      await db.insert(assumption).values({
        id: assumptionId,
        projectId,
        title: "Offline trust",
        statement: "Founders trust offline exports.",
      });
      const target = {
        type: "Assumption" as const,
        projectId,
        recordId: assumptionId,
      };
      const source = await createDocument("Offline exports are trusted.");
      const plan = await api.previewDocumentEvidence({
        documentId: source.id,
        projectId,
        versionRevision: source.revision,
        start: 0,
        end: 7,
        target,
      });
      const bindingId = crypto.randomUUID();
      await api.confirmDocumentEvidence({
        documentId: source.id,
        projectId,
        id: bindingId,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        plan,
      });
      expect(await api.evidenceFlow(target)).toMatchObject([
        {
          id: bindingId,
          sourceType: "Document",
          pin: { excerpt: "Offline" },
        },
      ]);
    });

    test("Evidence Flow is offered only on Work, Decision and Assumption", async () => {
      await expect(
        client().evidenceFlow({
          type: "Risk",
          projectId,
          recordId: crypto.randomUUID(),
        } as never),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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

    test("serializes an Evidence Role write behind a concurrent lifecycle write on the target Project", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const api = client();
      const source = await createDocument("Founders want local exports. Done.");
      const selection = { documentId: source.id, projectId };
      const lifecycleProjectId = crypto.randomUUID();
      const targetId = crypto.randomUUID();
      await db.insert(project).values({
        id: lifecycleProjectId,
        workspaceId,
        name: "Lifecycle target",
        shortCode: `L${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      });
      await db.insert(decision).values({
        id: targetId,
        projectId: lifecycleProjectId,
        title: "Cross-Project target",
        decision: "Archive me",
      });
      const plan = await api.previewDocumentEvidence({
        ...selection,
        versionRevision: source.revision,
        start: 0,
        end: 27,
        target: {
          type: "Decision",
          projectId: lifecycleProjectId,
          recordId: targetId,
        },
      });
      const bound = await api.confirmDocumentEvidence({
        ...selection,
        id: crypto.randomUUID(),
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        plan,
      });
      const bindingId = bound?.id ?? "";

      // Hold the target Project's row lock in an archive transaction until the role write is queued behind it.
      let release: () => void = () => undefined;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      let markLocked: () => void = () => undefined;
      const locked = new Promise<void>((resolve) => {
        markLocked = resolve;
      });
      const lifecycle = db.transaction(async (tx) => {
        await tx
          .update(project)
          .set({ archivedAt: new Date() })
          .where(eq(project.id, lifecycleProjectId));
        markLocked();
        await released;
      });
      try {
        await locked;
        const outcome = api
          .setDocumentEvidenceRole({
            ...selection,
            id: bindingId,
            baseRevision: bound?.revision ?? 1,
            clientIdempotencyKey: crypto.randomUUID(),
            role: "Supporting",
            interpretation: null,
          })
          .then(
            () => "written",
            (error: unknown) => error,
          );
        // The write must wait on the Project lock rather than read the target before the archive commits.
        await vi.waitFor(
          async () => {
            const waiting = await db?.execute(sql`
              select count(*)::int as count
              from pg_stat_activity
              where datname = current_database() and wait_event_type = 'Lock'
            `);
            expect(Number(waiting?.rows[0]?.count)).toBeGreaterThan(0);
          },
          { timeout: 3000 },
        );
        release();
        await lifecycle;
        expect(await outcome).toMatchObject({ code: "CONFLICT" });
      } finally {
        release();
        await lifecycle.catch(() => undefined);
      }
      const [stored] = await db
        .select({ role: evidenceBinding.role })
        .from(evidenceBinding)
        .where(eq(evidenceBinding.id, bindingId));
      expect(stored?.role).toBe("Unspecified");
    }, 15_000);
  },
);
