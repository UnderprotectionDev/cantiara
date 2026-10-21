import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
} from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { workRelation } from "@cantiara/db/schema/relation";
import {
  specChangeReviewFollowUp,
  specChangeReviewMark,
} from "@cantiara/db/schema/spec-change-review";
import { work } from "@cantiara/db/schema/work";
import { createRouterClient } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabaseDocumentMutationContracts,
  createDatabaseDocuments,
} from "../../../documents/server/documents-database";
import { createSpecChangeReview } from "../spec-change-review";
import { createDatabaseSpecChangeReviewStore } from "../spec-change-review-database";
import { createDatabaseSpecChangeReviewMutationContracts } from "../spec-change-review-mark-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Spec Change Review follow-up Work PostgreSQL seam", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `spec-fu-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;

  function client() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const documents = createDatabaseDocuments(database);
    const context: Context = {
      accountAccess: {
        listSessions: async () => [],
        revokeOtherSessions: async () => undefined,
        revokeSession: async () => undefined,
      },
      accountPreferences: {
        get: () => Promise.reject(new Error("Not part of this test.")),
      },
      auth: null,
      db: database,
      documentMutationContracts:
        createDatabaseDocumentMutationContracts(database),
      documents,
      githubAvailability: { getStatus: () => "available" },
      session: {
        session: { id: "session-1" },
        user: { id: accountId },
      } as Context["session"],
      specChangeReview: createSpecChangeReview(
        createDatabaseSpecChangeReviewStore(database),
        documents,
      ),
      specChangeReviewMutationContracts:
        createDatabaseSpecChangeReviewMutationContracts(database),
    };
    return createRouterClient(appRouter, { context });
  }

  async function insertWork(
    id: string,
    title: string,
    number: number,
    options: { primarySpecId?: string; type?: "Feature" | "Task" } = {},
  ) {
    await database?.insert(work).values({
      id,
      key: `SFU-${number}`,
      number,
      primarySpecId: options.primarySpecId ?? null,
      projectId,
      title,
      type: options.type ?? "Task",
    });
  }

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await database
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await database.insert(project).values({
      id: projectId,
      name: "Follow-up",
      shortCode: `SFU-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workCount: 10,
      workspaceId,
    });
  });

  afterEach(async () => {
    await database
      ?.delete(mutationHistory)
      .where(inArray(mutationHistory.actorId, [accountId]));
    await database
      ?.delete(mutationReceipt)
      .where(inArray(mutationReceipt.actorId, [accountId]));
    await database
      ?.delete(mutationStaging)
      .where(inArray(mutationStaging.actorId, [accountId]));
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  const specBody = ["## Goals {#goals}", "Ship the queue."].join("\n");

  async function openReview() {
    const spec = await client().createDocument({
      baseRevision: 0,
      body: specBody,
      clientIdempotencyKey: crypto.randomUUID(),
      projectId,
      title: "Queue spec",
      type: "Spec",
    });
    await insertWork("feature", "Queue", 1, {
      primarySpecId: spec.id,
      type: "Feature",
    });
    await insertWork("related", "Related work", 2);
    await database?.insert(workRelation).values({
      id: crypto.randomUUID(),
      kind: "Implements",
      sourceWorkId: "related",
      targetLabel: "Queue spec",
      targetProjectId: projectId,
      targetRecordId: spec.id,
      targetRecordType: "Document",
    });
    await client().updateDocument({
      baseRevision: spec.revision,
      body: specBody.replace("Ship the queue.", "Ship the exact queue."),
      clientIdempotencyKey: crypto.randomUUID(),
      documentId: spec.id,
    });
    const [review] = await client().projectSpecChangeReviews({ projectId });
    if (!review) {
      throw new Error("The review was not opened.");
    }
    return { review, spec };
  }

  const related = {
    recordId: "related",
    recordType: "Work",
    sectionId: null,
  } as const;

  it("confirm creates exactly one bound Work, replays idempotently and leaves the review result", async () => {
    const { review, spec } = await openReview();
    const [relatedBefore] =
      (await database?.select().from(work).where(eq(work.id, "related"))) ?? [];
    const preview = await client().previewSpecChangeReviewFollowUp({
      candidate: related,
      reviewId: review.id,
    });
    const worksBefore = (await database?.select().from(work)) ?? [];

    expect((await database?.select().from(work)) ?? []).toHaveLength(
      worksBefore.length,
    );
    const command = {
      baseRevision: 0,
      candidate: related,
      clientIdempotencyKey: crypto.randomUUID(),
      previewFingerprint: preview.fingerprint,
      reviewId: review.id,
      workId: crypto.randomUUID(),
    };
    const first = await client().createSpecChangeReviewFollowUp(command);
    const replay = await client().createSpecChangeReviewFollowUp(command);

    expect(replay).toEqual(first);
    const worksAfter = (await database?.select().from(work)) ?? [];
    expect(worksAfter).toHaveLength(worksBefore.length + 1);
    const [created] =
      (await database
        ?.select()
        .from(work)
        .where(eq(work.id, command.workId))) ?? [];
    expect(created).toMatchObject({
      originComponentId: review.id,
      originOwnerRecordId: spec.id,
      originSourceVersion: "1 → 2",
      projectId,
      status: "Not Started",
      title: preview.plan.work.title,
    });
    expect(first.workKey).toBe(created?.key);

    // The review result and the candidate are untouched.
    expect(await database?.select().from(specChangeReviewMark)).toHaveLength(0);
    expect(
      await database?.select().from(specChangeReviewFollowUp),
    ).toHaveLength(1);
    const [relatedAfter] =
      (await database?.select().from(work).where(eq(work.id, "related"))) ?? [];
    expect(relatedAfter).toEqual(relatedBefore);
    const detail = await client().specChangeReview({ reviewId: review.id });
    expect(
      detail.candidates.find(({ identity }) => identity.recordId === "related")
        ?.review.state,
    ).toBe("Waiting");

    await expect(
      client().createSpecChangeReviewFollowUp({
        ...command,
        clientIdempotencyKey: crypto.randomUUID(),
        workId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("rejects a stale preview and an inaccessible candidate and creates nothing", async () => {
    const { review } = await openReview();
    const preview = await client().previewSpecChangeReviewFollowUp({
      candidate: related,
      reviewId: review.id,
    });
    await database
      ?.update(work)
      .set({ title: "Renamed after preview" })
      .where(eq(work.id, "related"));
    const before = (await database?.select().from(work)) ?? [];

    await expect(
      client().createSpecChangeReviewFollowUp({
        baseRevision: 0,
        candidate: related,
        clientIdempotencyKey: crypto.randomUUID(),
        previewFingerprint: preview.fingerprint,
        reviewId: review.id,
        workId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      client().previewSpecChangeReviewFollowUp({
        candidate: { recordId: "missing", recordType: "Work", sectionId: null },
        reviewId: review.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await database?.select().from(work)).toHaveLength(before.length);
    expect(
      await database?.select().from(specChangeReviewFollowUp),
    ).toHaveLength(0);
  });
});
