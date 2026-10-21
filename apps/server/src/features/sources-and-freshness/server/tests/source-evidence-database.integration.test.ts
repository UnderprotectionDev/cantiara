// biome-ignore-all lint/performance/noAwaitInLoops: The three-use journey intentionally commits each bind separately.
import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { evidenceBinding } from "@cantiara/db/schema/evidence";
import { feedback } from "@cantiara/db/schema/feedback";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createDatabaseSourceEvidence } from "../source-evidence-database";
import { createDatabaseSourceRecheck } from "../source-recheck-database";
import { createDatabaseSourcesAndFreshness } from "../sources-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
(databaseUrl ? describe : describe.skip)(
  "Sources and Freshness per-use decisions",
  () => {
    const db = databaseUrl
      ? createDb({ DATABASE_URL: databaseUrl })
      : undefined;
    const accountId = crypto.randomUUID();
    const workspaceId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const targets = (["Work", "Decision", "Feedback"] as const).map((type) => ({
      type,
      recordId: crypto.randomUUID(),
      projectId,
    }));
    const [workTarget, decisionTarget, feedbackTarget] = targets;
    if (!(workTarget && decisionTarget && feedbackTarget)) {
      throw new Error("Targets required");
    }
    beforeAll(async () => {
      if (!db) {
        throw new Error("Database required");
      }
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
        name: "Freshness journey",
        shortCode: `F${accountId.slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      });
      await db.insert(work).values({
        id: workTarget.recordId,
        projectId,
        key: "FRESH-1",
        number: 1,
        title: "Journey Work",
        type: "Task",
      });
      await db.insert(decision).values({
        id: decisionTarget.recordId,
        projectId,
        title: "Journey Decision",
        decision: "Retain original evidence",
      });
      await db.insert(feedback).values({
        id: feedbackTarget.recordId,
        projectId,
        title: "Journey Feedback",
        originalMessage: "Customer finding",
        occurredAt: new Date(),
      });
    });
    afterAll(async () => {
      await db?.delete(user).where(eq(user.id, accountId));
      await db?.$client.end();
    });
    test("three uses keep their exact pins until each explicit review, and close one grouped signal only after the last review", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const sources = createDatabaseSourcesAndFreshness(db);
      const evidence = createDatabaseSourceEvidence(db);
      const sourceId = crypto.randomUUID();
      const selection = { sourceId, projectId };
      await sources.create(accountId, {
        id: sourceId,
        projectId,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        url: "https://example.org/research",
        title: "Research",
        accessedAt: "2026-10-01T09:00:00Z",
        capturedContent: "Original finding.\nRetained context.",
      });
      const ids: string[] = [];
      for (const target of targets) {
        const plan = await evidence.preview(accountId, {
          ...selection,
          target,
          versionRevision: 1,
          expectedSourceRevision: 1,
          start: 0,
          end: 17,
        });
        expect(plan?.pin.excerpt).toBe("Original finding.");
        if (!plan) {
          throw new Error("Preview required");
        }
        const input = {
          ...selection,
          id: crypto.randomUUID(),
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
          plan,
        };
        const bound = await evidence.bind(accountId, input);
        expect(await evidence.bind(accountId, input)).toEqual(bound);
        ids.push(input.id);
      }
      expect((await evidence.list(accountId, selection))?.signal).toBeNull();
      const rechecks = createDatabaseSourceRecheck(db, async (url) => ({
        kind: "preview",
        url,
        domain: "example.org",
        title: "Research",
        accessedAt: "2026-10-10T09:00:00Z",
        capturedContent: "Revised finding.\nRetained context.",
        image: null,
        player: null,
        error: null,
        fetchResult: {
          finalUrl: url,
          httpStatus: 200,
          contentType: "text/plain",
        },
      }));
      const check = await rechecks.recheck(accountId, {
        ...selection,
        id: crypto.randomUUID(),
        expectedSourceRevision: 1,
      });
      if (!check) {
        throw new Error("Source Check required");
      }
      expect((await evidence.list(accountId, selection))?.signal).toBeNull();
      await rechecks.decide(accountId, {
        ...selection,
        checkId: check.id,
        baseRevision: 1,
        clientIdempotencyKey: crypto.randomUUID(),
        expectedSourceRevision: 1,
        decision: "Save as new Source version",
      });
      const approved = await evidence.list(accountId, selection);
      expect(approved?.uses).toHaveLength(3);
      expect(
        approved?.uses.every(
          (use) =>
            use.pin.source.revision === 1 &&
            use.pin.excerpt === "Original finding." &&
            use.accessedAt === "2026-10-01T09:00:00.000Z" &&
            use.newerVersionExists,
        ),
      ).toBe(true);
      expect(approved?.signal).toMatchObject({
        type: "source-version-in-use",
        sourceId,
        useIds: ids,
      });
      const [firstId, secondId, lastId] = ids;
      if (!(firstId && secondId && lastId)) {
        throw new Error("Three binds required");
      }
      const keep = {
        ...selection,
        bindingId: firstId,
        baseRevision: 1,
        expectedSourceRevision: 2,
        clientIdempotencyKey: crypto.randomUUID(),
        decision: "Reviewed; keep current version" as const,
      };
      await evidence.review(accountId, keep);
      expect(await evidence.review(accountId, keep)).toMatchObject({
        pin: { source: { revision: 1 } },
        reviewedSourceRevision: 2,
      });
      const partial = await evidence.list(accountId, selection);
      expect(partial?.signal?.useIds).toEqual(ids.slice(1));
      const plan = await evidence.preview(accountId, {
        ...selection,
        bindingId: secondId,
        versionRevision: 2,
        expectedSourceRevision: 2,
        start: 0,
        end: 16,
      });
      if (!plan) {
        throw new Error("Preview required");
      }
      const rebind = {
        ...selection,
        bindingId: secondId,
        baseRevision: 1,
        expectedSourceRevision: 2,
        clientIdempotencyKey: crypto.randomUUID(),
        decision: "Rebind to new version" as const,
        plan,
      };
      await evidence.review(accountId, rebind);
      expect(await evidence.review(accountId, rebind)).toMatchObject({
        pin: {
          source: { revision: 2 },
          start: 0,
          end: 16,
          excerpt: "Revised finding.",
        },
      });
      expect(
        (await evidence.list(accountId, selection))?.signal?.useIds,
      ).toEqual([lastId]);
      await evidence.review(accountId, {
        ...keep,
        bindingId: lastId,
        clientIdempotencyKey: crypto.randomUUID(),
      });
      const reopened = await createDatabaseSourceEvidence(db).list(
        accountId,
        selection,
      );
      expect(reopened?.signal).toBeNull();
      expect(reopened?.uses.map((use) => use.pin.source.revision)).toEqual([
        1, 2, 1,
      ]);
      expect((await sources.find(accountId, selection))?.versions).toHaveLength(
        2,
      );
      // Target lifecycle is a separate counterpart: neither approval nor review writes it.
      expect(
        (
          await db.select().from(work).where(eq(work.id, workTarget.recordId))
        )[0],
      ).toMatchObject({ status: "Not Started", revision: 0 });
      expect(
        (
          await db
            .select()
            .from(decision)
            .where(eq(decision.id, decisionTarget.recordId))
        )[0],
      ).toMatchObject({ life: "Valid", revision: 0 });
      expect(
        (
          await db
            .select()
            .from(feedback)
            .where(eq(feedback.id, feedbackTarget.recordId))
        )[0],
      ).toMatchObject({ status: "New", revision: 0 });
    });
    test("authenticated previews reject forged and stale pins, serialize concurrent decisions and become read-only on archive", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const sources = createDatabaseSourcesAndFreshness(db);
      const evidence = createDatabaseSourceEvidence(db);
      const context = {
        db,
        sourceEvidence: evidence,
        session: { session: { id: "freshness" }, user: { id: accountId } },
      } as Context;
      const client = createRouterClient(appRouter, { context });
      const anonymous = createRouterClient(appRouter, {
        context: { ...context, session: null },
      });
      const selection = { sourceId: crypto.randomUUID(), projectId };
      await sources.create(accountId, {
        id: selection.sourceId,
        projectId,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        url: "https://example.org/pins",
        title: "Pins",
        accessedAt: "2026-10-01T09:00:00Z",
        capturedContent: "Exact finding.",
      });
      await expect(
        anonymous.sourceEvidenceUses(selection),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(await evidence.list("other-account", selection)).toBeNull();
      const previewInput = {
        ...selection,
        target: workTarget,
        versionRevision: 1,
        expectedSourceRevision: 1,
        start: 0,
        end: 14,
      };
      expect(await evidence.preview("other-account", previewInput)).toBeNull();
      const plan = await client.previewSourceEvidence(previewInput);
      if (!plan) {
        throw new Error("Preview required");
      }
      const command = {
        ...selection,
        id: crypto.randomUUID(),
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        plan,
      };
      await expect(
        client.bindSourceEvidence({
          ...command,
          plan: { ...plan, pin: { ...plan.pin, before: "forged context" } },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await client.sourceEvidenceUses(selection))?.uses).toEqual([]);
      const bound = await client.bindSourceEvidence(command);
      if (!bound) {
        throw new Error("Bind required");
      }
      await expect(
        client.bindSourceEvidence({
          ...command,
          plan: { ...plan, pin: { ...plan.pin, after: "changed payload" } },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await sources.saveVersion(accountId, {
        ...selection,
        baseRevision: 1,
        clientIdempotencyKey: crypto.randomUUID(),
        url: "https://example.org/pins",
        title: "Pins 2",
        accessedAt: "2026-10-10T09:00:00Z",
        capturedContent: "New finding.",
      });
      await expect(
        client.bindSourceEvidence({
          ...command,
          id: crypto.randomUUID(),
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const newPlan = await client.previewSourceEvidence({
        ...selection,
        bindingId: bound.id,
        expectedSourceRevision: 2,
        versionRevision: 2,
        start: 0,
        end: 12,
      });
      if (!newPlan) {
        throw new Error("Preview required");
      }
      const review = {
        ...selection,
        bindingId: bound.id,
        baseRevision: 1,
        expectedSourceRevision: 2,
        clientIdempotencyKey: crypto.randomUUID(),
        decision: "Reviewed; keep current version" as const,
      };
      const outcomes = await Promise.allSettled([
        client.reviewSourceEvidence(review),
        client.reviewSourceEvidence({
          ...review,
          clientIdempotencyKey: crypto.randomUUID(),
          decision: "Rebind to new version",
          plan: newPlan,
        }),
      ]);
      expect(
        outcomes.filter((outcome) => outcome.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        outcomes.filter((outcome) => outcome.status === "rejected"),
      ).toHaveLength(1);
      expect((await client.sourceEvidenceUses(selection))?.signal).toBeNull();
      await sources.saveVersion(accountId, {
        ...selection,
        baseRevision: 2,
        clientIdempotencyKey: crypto.randomUUID(),
        url: "https://example.org/pins",
        title: "Pins 3",
        accessedAt: "2026-10-11T09:00:00Z",
        capturedContent: "Third finding.",
      });
      expect(
        (await client.sourceEvidenceUses(selection))?.signal?.useIds,
      ).toEqual([bound.id]);
      await expect(
        client.reviewSourceEvidence({
          ...review,
          baseRevision: 2,
          clientIdempotencyKey: crypto.randomUUID(),
          decision: "Rebind to new version",
          plan: { ...newPlan, bindingRevision: 2 },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await db
        .update(project)
        .set({ archivedAt: new Date() })
        .where(eq(project.id, projectId));
      const archived = await client.sourceEvidenceUses(selection);
      expect(archived?.uses[0]).toMatchObject({
        readOnly: true,
        reviewedBy: accountId,
      });
      expect(archived?.signal).toBeNull();
      await expect(
        client.reviewSourceEvidence({
          ...review,
          baseRevision: 2,
          expectedSourceRevision: 3,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await db
        .update(project)
        .set({ archivedAt: null })
        .where(eq(project.id, projectId));
    });
    test("a deleted target Project preserves the pin history and excludes its unavailable use from review and signals", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const targetProjectId = crypto.randomUUID();
      const target = {
        type: "Work" as const,
        projectId: targetProjectId,
        recordId: crypto.randomUUID(),
      };
      await db.insert(project).values({
        id: targetProjectId,
        workspaceId,
        name: "Deleted target",
        shortCode: `D${accountId.slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      });
      await db.insert(work).values({
        id: target.recordId,
        projectId: targetProjectId,
        key: "DELETED-1",
        number: 1,
        title: "Unavailable Work",
        type: "Task",
      });
      const evidence = createDatabaseSourceEvidence(db);
      const sources = createDatabaseSourcesAndFreshness(db);
      const selection = { projectId, sourceId: crypto.randomUUID() };
      const capture = {
        projectId,
        url: "https://example.org/history",
        title: "History",
        accessedAt: "2026-10-01T09:00:00Z",
        capturedContent: "Historical pin.",
        clientIdempotencyKey: crypto.randomUUID(),
      };
      await sources.create(accountId, {
        ...capture,
        id: selection.sourceId,
        baseRevision: 0,
      });
      const plan = await evidence.preview(accountId, {
        ...selection,
        target,
        expectedSourceRevision: 1,
        versionRevision: 1,
        start: 0,
        end: 15,
      });
      if (!plan) {
        throw new Error("Preview required");
      }
      const id = crypto.randomUUID();
      await evidence.bind(accountId, {
        ...selection,
        id,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        plan,
      });
      await sources.saveVersion(accountId, {
        ...capture,
        sourceId: selection.sourceId,
        baseRevision: 1,
        clientIdempotencyKey: crypto.randomUUID(),
        capturedContent: "Updated pin.",
      });
      expect(
        (await evidence.list(accountId, selection))?.signal?.useIds,
      ).toEqual([id]);
      await db.delete(project).where(eq(project.id, targetProjectId));
      expect(await evidence.list(accountId, selection)).toEqual({
        uses: [],
        signal: null,
      });
      expect(
        await evidence.preview(accountId, {
          ...selection,
          bindingId: id,
          expectedSourceRevision: 2,
          versionRevision: 2,
          start: 0,
          end: 12,
        }),
      ).toBeNull();
      expect(
        await evidence.review(accountId, {
          ...selection,
          bindingId: id,
          baseRevision: 1,
          expectedSourceRevision: 2,
          clientIdempotencyKey: crypto.randomUUID(),
          decision: "Reviewed; keep current version",
        }),
      ).toBeNull();
      expect(
        (
          await db
            .select()
            .from(evidenceBinding)
            .where(eq(evidenceBinding.id, id))
        )[0],
      ).toMatchObject({
        targetProjectId: null,
        pin: plan.pin,
        revision: 1,
        reviewedAt: null,
      });
    });
  },
);
