import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import type { SpecChangeReviewFollowUpPreview } from "@cantiara/api/spec-change-review-follow-up";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import { createMemorySpecChangeReview } from "../spec-change-review-memory-store";

const accountId = "account-1";
const projectId = "project-1";

const specV1 = [
  "Intro line.",
  "",
  "## Goals {#goals}",
  "Ship the queue.",
  "",
].join("\n");
const specV2 = specV1.replace("Ship the queue.", "Ship the exact queue.");

const available = (title: string, label: string | null = null) => ({
  label,
  projectId,
  status: "available" as const,
  title,
});

async function setup() {
  const harness = createMemorySpecChangeReview(accountId);
  harness.addDocument({
    id: "spec-1",
    projectId,
    versions: [{ body: specV1, title: "Queue spec", type: "Spec" }],
  });
  harness.addWork({
    id: "feature-1",
    key: "CAN-1",
    primarySpecId: "spec-1",
    projectId,
    title: "Queue",
    type: "Feature",
  });
  harness.addRecord("Work", "feature-1", available("Queue", "CAN-1"));
  harness.addRecord("Work", "work-2", available("Wire the queue", "CAN-2"));
  harness.addLink("spec-1", {
    detail: "Implements",
    kind: "Explicit relation",
    pin: null,
    record: { recordId: "work-2", recordType: "Work" },
    sectionId: null,
  });
  // No record is registered for work-hidden: it reads as `No access`.
  harness.addLink("spec-1", {
    detail: "Implements",
    kind: "Explicit relation",
    pin: null,
    record: { recordId: "work-hidden", recordType: "Work" },
    sectionId: null,
  });
  harness.saveVersion("spec-1", { body: specV2 });
  const [review] = await harness.access.list(accountId, projectId);
  if (!review) {
    throw new Error("The review was not opened.");
  }
  return { harness, review };
}

function createClient(
  harness: Pick<
    ReturnType<typeof createMemorySpecChangeReview>,
    "access" | "contracts"
  >,
) {
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
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"],
    specChangeReview: harness.access,
    specChangeReviewMutationContracts: harness.contracts,
  };
  return createRouterClient(appRouter, { context });
}

const work2 = {
  recordId: "work-2",
  recordType: "Work",
  sectionId: null,
} as const;

function confirm(
  client: ReturnType<typeof createClient>,
  reviewId: string,
  preview: SpecChangeReviewFollowUpPreview,
  key = "key-1",
) {
  return client.createSpecChangeReviewFollowUp({
    baseRevision: 0,
    candidate: work2,
    clientIdempotencyKey: key,
    previewFingerprint: preview.fingerprint,
    reviewId,
    workId: "new-work-1",
  });
}

describe("Spec Change Review follow-up Work", () => {
  test("the preview names the one Work, Project, status, versions and source relation", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);

    const { plan } = await client.previewSpecChangeReviewFollowUp({
      candidate: work2,
      reviewId: review.id,
    });

    expect(plan).toMatchObject({
      candidateSource: {
        documentLevel: true,
        reasons: [{ detail: "Implements", kind: "Explicit relation" }],
      },
      recordCount: 1,
      relation: "Origin",
      specVersions: { nextRevision: 2, previousRevision: 1 },
      targetProject: { id: projectId },
      work: { startingStatus: "Not Started", type: "Task" },
    });
    expect(plan.work.title).toContain("Wire the queue");
    expect(harness.createdWorks).toEqual([]);
  });

  test("a preview alone creates no Work and no follow-up", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);

    await client.previewSpecChangeReviewFollowUp({
      candidate: work2,
      reviewId: review.id,
    });

    expect(harness.createdWorks).toHaveLength(0);
    const { candidates } = await harness.access.get(accountId, {
      reviewId: review.id,
    });
    expect(candidates.every(({ followUp }) => followUp === null)).toBe(true);
  });

  test("confirm without a matching preview creates nothing", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);

    await expect(
      client.createSpecChangeReviewFollowUp({
        baseRevision: 0,
        candidate: work2,
        clientIdempotencyKey: "no-preview",
        previewFingerprint: "0".repeat(64),
        reviewId: review.id,
        workId: "new-work-1",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      client.createSpecChangeReviewFollowUp({
        baseRevision: 0,
        candidate: work2,
        clientIdempotencyKey: "missing-preview",
        reviewId: review.id,
        workId: "new-work-1",
      } as never),
    ).rejects.toThrow();
    expect(harness.createdWorks).toHaveLength(0);
  });

  test("confirm creates exactly one Work bound to the spec versions", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);
    const preview = await client.previewSpecChangeReviewFollowUp({
      candidate: work2,
      reviewId: review.id,
    });

    const followUp = await confirm(client, review.id, preview);

    expect(harness.createdWorks).toHaveLength(1);
    expect(harness.createdWorks[0]).toMatchObject({
      id: "new-work-1",
      origin: {
        componentId: review.id,
        ownerRecordId: "spec-1",
        sourceVersion: "1 → 2",
      },
      projectId,
      status: "Not Started",
      title: preview.plan.work.title,
    });
    expect(followUp).toMatchObject({ workId: "new-work-1" });
    const { candidates } = await harness.access.get(accountId, {
      reviewId: review.id,
    });
    expect(
      candidates.find(({ identity }) => identity.recordId === "work-2")
        ?.followUp?.workId,
    ).toBe("new-work-1");
  });

  test("replaying the same command creates no second Work", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);
    const preview = await client.previewSpecChangeReviewFollowUp({
      candidate: work2,
      reviewId: review.id,
    });

    const first = await confirm(client, review.id, preview);
    const replay = await confirm(client, review.id, preview);

    expect(replay).toEqual(first);
    expect(harness.createdWorks).toHaveLength(1);
  });

  test("a second confirm with a new key cannot open another Work", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);
    const preview = await client.previewSpecChangeReviewFollowUp({
      candidate: work2,
      reviewId: review.id,
    });
    await confirm(client, review.id, preview);

    await expect(
      client.previewSpecChangeReviewFollowUp({
        candidate: work2,
        reviewId: review.id,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      confirm(client, review.id, preview, "key-2"),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(harness.createdWorks).toHaveLength(1);
  });

  test("the review result and the candidate stay as they were", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);
    const before = await harness.access.get(accountId, { reviewId: review.id });
    const preview = await client.previewSpecChangeReviewFollowUp({
      candidate: work2,
      reviewId: review.id,
    });

    await confirm(client, review.id, preview);

    const after = await harness.access.get(accountId, { reviewId: review.id });
    const pick = (detail: typeof before) =>
      detail.candidates.map(({ record, review: reviewMark }) => ({
        record,
        reviewMark,
      }));
    // No mark row was written, so the status is still the implicit Waiting.
    expect(harness.marks.size).toBe(0);
    expect(pick(after)).toEqual(pick(before));
    expect(
      after.candidates.every(({ review: mark }) => mark.state === "Waiting"),
    ).toBe(true);
    expect(after.review).toEqual(before.review);
  });

  test("a follow-up opens one Work only, no Test Gap, Refuted Assumption review or bulk", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);
    const preview = await client.previewSpecChangeReviewFollowUp({
      candidate: work2,
      reviewId: review.id,
    });
    await confirm(client, review.id, preview);

    expect(harness.createdWorks.map(({ type }) => type)).toEqual(["Task"]);
    expect(Object.keys(client)).not.toContain("createTestGap");
    expect(Object.keys(client)).not.toContain("refutedAssumptionReview");
    // Other candidates did not become Work.
    const { candidates } = await harness.access.get(accountId, {
      reviewId: review.id,
    });
    expect(candidates.filter(({ followUp }) => followUp !== null)).toHaveLength(
      1,
    );
  });

  test("a stale preview is rejected and creates nothing", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);
    const preview = await client.previewSpecChangeReviewFollowUp({
      candidate: work2,
      reviewId: review.id,
    });
    // The candidate record was renamed after the preview was shown.
    harness.addRecord(
      "Work",
      "work-2",
      available("Wire the queue v2", "CAN-2"),
    );

    await expect(confirm(client, review.id, preview)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(harness.createdWorks).toHaveLength(0);
  });

  test("an inaccessible candidate cannot be followed up and leaks no title", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);
    const hidden = {
      recordId: "work-hidden",
      recordType: "Work",
      sectionId: null,
    };

    await expect(
      client.previewSpecChangeReviewFollowUp({
        candidate: hidden,
        reviewId: review.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.createSpecChangeReviewFollowUp({
        baseRevision: 0,
        candidate: hidden,
        clientIdempotencyKey: "hidden",
        previewFingerprint: "0".repeat(64),
        reviewId: review.id,
        workId: "hidden-work",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(harness.createdWorks).toHaveLength(0);
  });

  test("a record that is not a candidate of the pair cannot be followed up", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);

    await expect(
      client.previewSpecChangeReviewFollowUp({
        candidate: {
          recordId: "unlinked",
          recordType: "Work",
          sectionId: null,
        },
        reviewId: review.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("another account's review is unavailable", async () => {
    const { review } = await setup();
    const other = createMemorySpecChangeReview("account-2");
    const client = createClient(other);

    await expect(
      client.previewSpecChangeReviewFollowUp({
        candidate: work2,
        reviewId: review.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
