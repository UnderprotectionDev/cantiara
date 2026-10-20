import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { evidenceBinding } from "@cantiara/db/schema/evidence";
import { feedback } from "@cantiara/db/schema/feedback";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
} from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { usageLink, workRelation } from "@cantiara/db/schema/relation";
import { specChangeReviewMark } from "@cantiara/db/schema/spec-change-review";
import { work } from "@cantiara/db/schema/work";
import { createRouterClient } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabaseDocumentMutationContracts,
  createDatabaseDocuments,
} from "../../documents/server/documents-database";
import { createSpecChangeReview } from "./spec-change-review";
import { createDatabaseSpecChangeReviewStore } from "./spec-change-review-database";
import { createDatabaseSpecChangeReviewMutationContracts } from "./spec-change-review-mark-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Spec Change Review candidates PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `spec-cand-${crypto.randomUUID()}`;
  const otherAccountId = `spec-cand-other-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const otherWorkspaceId = `workspace-other-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;
  const otherProjectId = `project-other-${crypto.randomUUID()}`;

  function client(principalAccountId = accountId) {
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
        user: { id: principalAccountId },
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
    options: {
      primarySpecId?: string;
      project?: string;
      trashedAt?: Date;
      type?: "Feature" | "Task";
    } = {},
  ) {
    await database?.insert(work).values({
      id,
      key: `SCC-${number}`,
      number,
      primarySpecId: options.primarySpecId ?? null,
      projectId: options.project ?? projectId,
      title,
      trashedAt: options.trashedAt ?? null,
      type: options.type ?? "Task",
    });
  }

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values([
      { email: `${accountId}@example.invalid`, id: accountId, name: "Founder" },
      {
        email: `${otherAccountId}@example.invalid`,
        id: otherAccountId,
        name: "Other",
      },
    ]);
    await database.insert(workspace).values([
      { id: workspaceId, ownerAccountId: accountId },
      { id: otherWorkspaceId, ownerAccountId: otherAccountId },
    ]);
    await database.insert(project).values([
      {
        id: projectId,
        name: "Spec candidates",
        shortCode: `SCC-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
      },
      {
        id: otherProjectId,
        name: "Foreign",
        shortCode: `SCF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId: otherWorkspaceId,
      },
    ]);
  });

  afterEach(async () => {
    const actors = [accountId, otherAccountId];
    await database
      ?.delete(mutationHistory)
      .where(inArray(mutationHistory.actorId, actors));
    await database
      ?.delete(mutationReceipt)
      .where(inArray(mutationReceipt.actorId, actors));
    await database
      ?.delete(mutationStaging)
      .where(inArray(mutationStaging.actorId, actors));
    await database?.delete(user).where(inArray(user.id, actors));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  const specBody = [
    "## Goals {#goals}",
    "Ship the queue.",
    "",
    "## Scope {#scope}",
    "Only Primary spec.",
  ].join("\n");

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
    const saved = await client().updateDocument({
      baseRevision: spec.revision,
      body: specBody.replace("Ship the queue.", "Ship the exact queue."),
      clientIdempotencyKey: crypto.randomUUID(),
      documentId: spec.id,
    });
    const [review] = await client().projectSpecChangeReviews({ projectId });
    if (!review) {
      throw new Error("The review was not opened.");
    }
    return { review, saved, spec };
  }

  it("derives candidates from recorded links only and keeps metadata isolated", async () => {
    const { review, spec } = await openReview();
    await insertWork("related", "Related work", 2);
    await insertWork("hosting", "Hosting work", 3);
    await insertWork("twin", "Queue spec", 4);
    await database?.insert(workRelation).values({
      id: crypto.randomUUID(),
      kind: "Implements",
      sourceWorkId: "related",
      targetLabel: "Queue spec",
      targetProjectId: projectId,
      targetRecordId: spec.id,
      targetRecordType: "Document",
    });
    await database?.insert(usageLink).values({
      id: crypto.randomUUID(),
      kind: "Section reference",
      location: { sectionId: "goals" },
      sourceRecordId: spec.id,
      sourceRecordType: "Document",
      surfaceRecordId: "hosting",
      surfaceRecordType: "Work",
      workspaceId,
    });

    const detail = await client().specChangeReview({ reviewId: review.id });
    expect(
      detail.candidates
        .map(({ identity }) => `${identity.recordId}:${identity.sectionId}`)
        .sort(),
    ).toEqual(["feature:null", "hosting:goals", "related:null"]);
    expect(
      detail.candidates.find(({ identity }) => identity.recordId === "hosting")
        ?.changedSection,
    ).toMatchObject({ heading: "Goals", sectionId: "goals" });
    expect(
      detail.candidates.every(({ review: r }) => r.state === "Waiting"),
    ).toBe(true);

    const [before] =
      (await database?.select().from(work).where(eq(work.id, "related"))) ?? [];
    const target = detail.candidates.find(
      ({ identity }) => identity.recordId === "related",
    );
    const mark = await client().markSpecChangeReviewCandidate({
      baseRevision: 0,
      candidate: target?.identity as never,
      clientIdempotencyKey: crypto.randomUUID(),
      note: "No wording impact.",
      reviewId: review.id,
      state: "Not affected",
    });
    expect(mark).toMatchObject({ revision: 1, state: "Not affected" });
    const [after] =
      (await database?.select().from(work).where(eq(work.id, "related"))) ?? [];
    expect(after).toEqual(before);

    const rows = await database?.select().from(specChangeReviewMark);
    expect(rows).toHaveLength(1);
    await expect(
      database?.insert(specChangeReviewMark).values({
        id: crypto.randomUUID(),
        recordId: "x",
        recordType: "Work",
        reviewId: review.id,
        state: "Affected",
      }),
    ).rejects.toThrow();
  });

  it("resolves a candidate of every landed titled store, including a Release name", async () => {
    const { review, spec } = await openReview();
    await database?.insert(projectMilestone).values({
      id: "milestone-surface",
      projectId,
      title: "Queue launch",
    });
    await database?.insert(feedback).values({
      id: "feedback-surface",
      occurredAt: new Date(),
      originalMessage: "The import loses my tags.",
      projectId,
      title: "Import loses tags",
    });
    await database?.insert(projectRelease).values({
      id: "release-surface",
      name: "Queue 1.0",
      projectId,
    });
    await database?.insert(usageLink).values([
      {
        id: crypto.randomUUID(),
        kind: "Live block",
        sourceRecordId: spec.id,
        sourceRecordType: "Document",
        surfaceRecordId: "feedback-surface",
        surfaceRecordType: "Feedback",
        workspaceId,
      },
      {
        id: crypto.randomUUID(),
        kind: "Live block",
        sourceRecordId: spec.id,
        sourceRecordType: "Document",
        surfaceRecordId: "milestone-surface",
        surfaceRecordType: "Milestone",
        workspaceId,
      },
      {
        id: crypto.randomUUID(),
        kind: "Live block",
        sourceRecordId: spec.id,
        sourceRecordType: "Document",
        surfaceRecordId: "release-surface",
        surfaceRecordType: "Project Release",
        workspaceId,
      },
    ]);

    const detail = await client().specChangeReview({ reviewId: review.id });
    const titled = detail.candidates.filter(
      ({ identity }) => identity.recordType !== "Work",
    );
    expect(
      titled.map(({ record }) => `${record.recordType}:${record.title}`),
    ).toEqual([
      "Feedback:Import loses tags",
      "Milestone:Queue launch",
      "Project Release:Queue 1.0",
    ]);
    expect(titled.every(({ record: { broken } }) => broken === null)).toBe(
      true,
    );
  });

  it("derives version-pinned evidence and keeps the prior pair's notes on that pair", async () => {
    const { review, saved, spec } = await openReview();
    await insertWork("claim", "Claim", 2);
    const excerpt = "Only Primary spec.";
    const start = specBody.indexOf(excerpt);
    await database?.insert(evidenceBinding).values({
      actorId: accountId,
      id: crypto.randomUUID(),
      pin: {
        after: "",
        before: "",
        end: start + excerpt.length,
        excerpt,
        source: {
          componentId: null,
          projectId,
          recordId: spec.id,
          recordType: "Document",
          revision: spec.revision,
        },
        start,
      },
      sourceProjectId: projectId,
      sourceRecordId: spec.id,
      targetProjectId: projectId,
      targetRecordId: "claim",
      targetRecordType: "Work",
      workspaceId,
    });
    const detail = await client().specChangeReview({ reviewId: review.id });
    const claim = detail.candidates.find(
      ({ identity }) => identity.recordId === "claim",
    );
    expect(claim?.reasons[0]?.kind).toBe("Version-pinned evidence");
    expect(claim?.identity.sectionId).toBe("scope");
    expect(claim?.changedSection).toBeNull();

    await client().markSpecChangeReviewCandidate({
      baseRevision: 0,
      candidate: claim?.identity as never,
      clientIdempotencyKey: crypto.randomUUID(),
      note: "Old note.",
      reviewId: review.id,
      state: "Reviewed",
    });
    await client().updateDocument({
      baseRevision: saved.revision,
      body: specBody.replace("Only Primary spec.", "Changed again."),
      clientIdempotencyKey: crypto.randomUUID(),
      documentId: spec.id,
    });
    const [newer] = await client().projectSpecChangeReviews({ projectId });
    expect(newer?.id).not.toBe(review.id);
    const newerDetail = await client().specChangeReview({
      reviewId: newer?.id ?? "",
    });
    expect(
      newerDetail.candidates.find(
        ({ identity }) => identity.recordId === "claim",
      )?.review,
    ).toMatchObject({ note: null, state: "Waiting" });
    const olderDetail = await client().specChangeReview({
      reviewId: review.id,
    });
    expect(
      olderDetail.candidates.find(
        ({ identity }) => identity.recordId === "claim",
      )?.review,
    ).toMatchObject({ note: "Old note.", state: "Reviewed" });
  });

  it("presents an inaccessible or trashed candidate as a broken reference without a title", async () => {
    const { review, spec } = await openReview();
    await insertWork("foreign", "Secret foreign title", 50, {
      project: otherProjectId,
    });
    await insertWork("trashed", "Secret trashed title", 51, {
      trashedAt: new Date(),
    });
    await database?.insert(usageLink).values(
      ["foreign", "trashed"].map((surface) => ({
        id: crypto.randomUUID(),
        kind: "Inline reference",
        sourceRecordId: spec.id,
        sourceRecordType: "Document",
        surfaceRecordId: surface,
        surfaceRecordType: "Work",
        workspaceId,
      })),
    );

    const detail = await client().specChangeReview({ reviewId: review.id });
    const foreign = detail.candidates.find(
      ({ identity }) => identity.recordId === "foreign",
    );
    const trashed = detail.candidates.find(
      ({ identity }) => identity.recordId === "trashed",
    );
    expect(foreign?.record).toMatchObject({
      broken: { reason: "No access" },
      projectId: null,
      title: null,
    });
    expect(trashed?.record).toMatchObject({
      broken: { reason: "In Trash" },
      title: null,
    });
    expect(JSON.stringify(detail)).not.toContain("Secret");
    await expect(
      client(otherAccountId).markSpecChangeReviewCandidate({
        baseRevision: 0,
        candidate: foreign?.identity as never,
        clientIdempotencyKey: crypto.randomUUID(),
        note: null,
        reviewId: review.id,
        state: "Reviewed",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
