import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import type {
  SpecCandidateLink,
  SpecChangeReviewCandidate,
} from "@cantiara/api/spec-change-review-candidates";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import { createMemorySpecChangeReview } from "./spec-change-review-memory-store";

const accountId = "account-1";
const projectId = "project-1";

const specV1 = [
  "Intro line.",
  "",
  "## Goals {#goals}",
  "Ship the queue.",
  "",
  "## Scope {#scope}",
  "Only Primary spec.",
  "",
].join("\n");

const specV2 = specV1.replace("Ship the queue.", "Ship the exact queue.");

function link(
  kind: SpecCandidateLink["kind"],
  recordType: string,
  recordId: string,
  extra: Partial<SpecCandidateLink> = {},
): SpecCandidateLink {
  return {
    detail: null,
    kind,
    pin: null,
    record: { recordId, recordType },
    sectionId: null,
    ...extra,
  };
}

function available(title: string, label: string | null = null) {
  return {
    label,
    projectId,
    status: "available" as const,
    title,
  };
}

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
  harness.addRecord("Document", "doc-1", available("Roadmap notes"));
  harness.addRecord("Decision", "decision-1", available("Use jsdiff"));
  harness.addRecord(
    "Work",
    "work-title-twin",
    available("Queue spec", "CAN-9"),
  );
  harness.addRecord("Document", "doc-twin", available("Queue spec"));
  harness.addLink("spec-1", link("Primary spec", "Work", "feature-1"));
  harness.addLink(
    "spec-1",
    link("Explicit relation", "Work", "work-2", { detail: "Implements" }),
  );
  harness.addLink(
    "spec-1",
    link("Stable section reference", "Document", "doc-1", {
      sectionId: "goals",
    }),
  );
  harness.addLink("spec-1", link("Inline reference", "Document", "doc-1"));
  harness.addLink(
    "spec-1",
    link("Live content use", "Work", "work-2", { detail: "Section reference" }),
  );
  harness.addLink(
    "spec-1",
    link("Version-pinned evidence", "Decision", "decision-1", {
      detail: "Pinned to Version 1",
      pin: { revision: 1, start: specV1.indexOf("Only Primary spec.") },
    }),
  );
  harness.saveVersion("spec-1", { body: specV2 });
  const [review] = await harness.access.list(accountId, projectId);
  if (!review) {
    throw new Error("The review was not opened.");
  }
  return { harness, review };
}

function createClient(
  harness: ReturnType<typeof createMemorySpecChangeReview>,
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

function find(
  candidates: SpecChangeReviewCandidate[],
  recordType: string,
  recordId: string,
  sectionId: string | null,
) {
  return candidates.find(
    ({ identity }) =>
      identity.recordType === recordType &&
      identity.recordId === recordId &&
      identity.sectionId === sectionId,
  );
}

describe("Spec Change Review candidates: recorded-link closure", () => {
  test("the candidate set equals the recorded links, nothing more", async () => {
    const { harness, review } = await setup();
    const { candidates } = await harness.access.get(accountId, {
      reviewId: review.id,
    });

    expect(
      candidates
        .map(({ identity }) => identity)
        .sort((a, b) =>
          `${a.recordType}${a.recordId}${a.sectionId}`.localeCompare(
            `${b.recordType}${b.recordId}${b.sectionId}`,
          ),
        ),
    ).toEqual([
      { recordId: "decision-1", recordType: "Decision", sectionId: "scope" },
      { recordId: "doc-1", recordType: "Document", sectionId: "goals" },
      { recordId: "doc-1", recordType: "Document", sectionId: null },
      { recordId: "feature-1", recordType: "Work", sectionId: null },
      { recordId: "work-2", recordType: "Work", sectionId: null },
    ]);
  });

  test("a record with the same title or text but no recorded link is absent", async () => {
    const { harness, review } = await setup();
    const { candidates } = await harness.access.get(accountId, {
      reviewId: review.id,
    });

    expect(find(candidates, "Work", "work-title-twin", null)).toBeUndefined();
    expect(find(candidates, "Document", "doc-twin", null)).toBeUndefined();
    expect(candidates.some(({ record }) => record.title === "Queue spec")).toBe(
      false,
    );
  });

  test("every candidate shows why it is one and its exact version pair", async () => {
    const { harness, review } = await setup();
    const { candidates } = await harness.access.get(accountId, {
      reviewId: review.id,
    });

    const work = find(candidates, "Work", "work-2", null);
    expect(work?.reasons).toEqual([
      { detail: "Section reference", kind: "Live content use" },
      { detail: "Implements", kind: "Explicit relation" },
    ]);
    expect(work).toMatchObject({ nextRevision: 2, previousRevision: 1 });
    expect(
      find(candidates, "Work", "feature-1", null)?.reasons.map(
        ({ kind }) => kind,
      ),
    ).toEqual(["Primary spec"]);
  });

  test("only an exact section bind ties a candidate to a changed section", async () => {
    const { harness, review } = await setup();
    const { candidates } = await harness.access.get(accountId, {
      reviewId: review.id,
    });

    const section = find(candidates, "Document", "doc-1", "goals");
    expect(section).toMatchObject({
      changedSection: {
        change: "Changed",
        heading: "Goals",
        sectionId: "goals",
      },
      documentLevel: false,
    });
    const wholeDocument = find(candidates, "Document", "doc-1", null);
    expect(wholeDocument).toMatchObject({
      changedSection: null,
      documentLevel: true,
    });
    // Pinned in the unchanged `Scope` section: bound to it, but not hit by this diff.
    expect(find(candidates, "Decision", "decision-1", "scope")).toMatchObject({
      changedSection: null,
      documentLevel: false,
    });
  });
});

describe("Spec Change Review candidates: review metadata", () => {
  test("every candidate defaults to Waiting without writing anything", async () => {
    const { harness, review } = await setup();
    const { candidates } = await harness.access.get(accountId, {
      reviewId: review.id,
    });

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.review).toEqual({
        note: null,
        revision: 0,
        state: "Waiting",
        updatedAt: null,
      });
    }
  });

  test("marks one candidate with one of exactly three values and a note", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);
    const [first, ...rest] = (
      await harness.access.get(accountId, { reviewId: review.id })
    ).candidates;

    for (const [index, state] of (
      ["Reviewed", "Not affected", "Waiting"] as const
    ).entries()) {
      // biome-ignore lint/performance/noAwaitInLoops: Each mark builds on the previous revision.
      const mark = await client.markSpecChangeReviewCandidate({
        baseRevision: index,
        candidate: first?.identity ?? {
          recordId: "",
          recordType: "",
          sectionId: null,
        },
        clientIdempotencyKey: `key-${index}`,
        note: state === "Not affected" ? "Copy only." : null,
        reviewId: review.id,
        state,
      });
      expect(mark).toMatchObject({ revision: index + 1, state });
    }
    const after = await harness.access.get(accountId, { reviewId: review.id });
    expect(after.candidates[0]?.review.state).toBe("Waiting");
    expect(after.candidates[0]?.review.note).toBeNull();
    // Only the one marked candidate was touched; no bulk implicit write.
    expect(
      after.candidates.slice(1).every(({ review: r }) => r.revision === 0),
    ).toBe(true);
    expect(rest.length).toBe(after.candidates.length - 1);
  });

  test("a fourth value is rejected", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);
    const [first] = (
      await harness.access.get(accountId, { reviewId: review.id })
    ).candidates;

    await expect(
      client.markSpecChangeReviewCandidate({
        baseRevision: 0,
        candidate: first?.identity as never,
        clientIdempotencyKey: "key",
        note: null,
        reviewId: review.id,
        state: "Affected" as never,
      }),
    ).rejects.toThrow();
  });

  test("there is no bulk shape: a list or an all flag is rejected", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);
    const { candidates } = await harness.access.get(accountId, {
      reviewId: review.id,
    });

    await expect(
      client.markSpecChangeReviewCandidate({
        baseRevision: 0,
        candidate: candidates.map(({ identity }) => identity) as never,
        clientIdempotencyKey: "bulk",
        note: null,
        reviewId: review.id,
        state: "Reviewed",
      }),
    ).rejects.toThrow();
    await expect(
      client.markSpecChangeReviewCandidate({
        all: true,
        baseRevision: 0,
        candidate: candidates[0]?.identity,
        clientIdempotencyKey: "bulk-2",
        note: null,
        reviewId: review.id,
        state: "Reviewed",
      } as never),
    ).rejects.toThrow();
    const after = await harness.access.get(accountId, { reviewId: review.id });
    expect(after.candidates.every(({ review: r }) => r.revision === 0)).toBe(
      true,
    );
  });

  test("a record that is not a candidate of this pair cannot be marked", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);

    await expect(
      client.markSpecChangeReviewCandidate({
        baseRevision: 0,
        candidate: {
          recordId: "work-title-twin",
          recordType: "Work",
          sectionId: null,
        },
        clientIdempotencyKey: "twin",
        note: null,
        reviewId: review.id,
        state: "Reviewed",
      }),
    ).rejects.toThrow();
  });

  test("marking is idempotent and a stale base revision is refused", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);
    const [first] = (
      await harness.access.get(accountId, { reviewId: review.id })
    ).candidates;
    const input = {
      baseRevision: 0,
      candidate: first?.identity as never,
      clientIdempotencyKey: "same-key",
      note: "Checked.",
      reviewId: review.id,
      state: "Reviewed" as const,
    };

    const once = await client.markSpecChangeReviewCandidate(input);
    const replay = await client.markSpecChangeReviewCandidate(input);
    expect(replay).toEqual(once);
    await expect(
      client.markSpecChangeReviewCandidate({
        ...input,
        clientIdempotencyKey: "other-key",
      }),
    ).rejects.toThrow();
  });

  test("metadata writes no candidate field", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);
    const before = structuredClone(harness.works);
    const [first] = (
      await harness.access.get(accountId, { reviewId: review.id })
    ).candidates;

    const mark = await client.markSpecChangeReviewCandidate({
      baseRevision: 0,
      candidate: first?.identity as never,
      clientIdempotencyKey: "isolation",
      note: null,
      reviewId: review.id,
      state: "Not affected",
    });

    expect(Object.keys(mark).sort()).toEqual([
      "candidate",
      "id",
      "note",
      "reviewId",
      "revision",
      "state",
      "updatedAt",
    ]);
    expect(harness.works).toEqual(before);
  });

  test("a new spec version keeps the earlier pair and does not reuse its note", async () => {
    const { harness, review } = await setup();
    const client = createClient(harness);
    const target = find(
      (await harness.access.get(accountId, { reviewId: review.id })).candidates,
      "Work",
      "work-2",
      null,
    );
    await client.markSpecChangeReviewCandidate({
      baseRevision: 0,
      candidate: target?.identity as never,
      clientIdempotencyKey: "pair-1",
      note: "Wording only.",
      reviewId: review.id,
      state: "Not affected",
    });

    harness.saveVersion("spec-1", {
      body: specV2.replace("Only Primary spec.", "Primary spec and links."),
    });
    const queue = await harness.access.list(accountId, projectId);
    const [newer, older] = queue;
    expect(older?.id).toBe(review.id);
    expect(newer?.nextRevision).toBe(3);

    const newerDetail = await harness.access.get(accountId, {
      reviewId: newer?.id ?? "",
    });
    expect(
      find(newerDetail.candidates, "Work", "work-2", null)?.review,
    ).toEqual({ note: null, revision: 0, state: "Waiting", updatedAt: null });

    const olderDetail = await harness.access.get(accountId, {
      reviewId: review.id,
    });
    expect(
      find(olderDetail.candidates, "Work", "work-2", null)?.review,
    ).toMatchObject({ note: "Wording only.", state: "Not affected" });
  });
});

describe("Spec Change Review candidates: access", () => {
  test("an inaccessible candidate uses the broken-reference view and leaks no title", async () => {
    const { harness, review } = await setup();
    // `work-2` stops being readable: moved out of this account's reach.
    harness.addRecord("Work", "work-2", {
      at: null,
      projectId: null,
      reason: "No access",
      status: "unavailable",
    });
    harness.addRecord("Decision", "decision-1", {
      at: "2026-10-02T09:00:00.000Z",
      projectId,
      reason: "In Trash",
      status: "unavailable",
    });
    const detail = await harness.access.get(accountId, { reviewId: review.id });

    const noAccess = find(detail.candidates, "Work", "work-2", null);
    expect(noAccess?.record).toMatchObject({
      broken: { canOpenSourceRecord: false, reason: "No access" },
      label: null,
      projectId: null,
      title: null,
    });
    const trashed = find(detail.candidates, "Decision", "decision-1", "scope");
    expect(trashed?.record).toMatchObject({
      broken: { canOpenSourceRecord: true, reason: "In Trash" },
      label: null,
      title: null,
    });
    const serialized = JSON.stringify(detail.candidates);
    expect(serialized).not.toContain("Wire the queue");
    expect(serialized).not.toContain("CAN-2");
    expect(serialized).not.toContain("Use jsdiff");
  });

  test("a record that is not readable at all reads as No access, never as missing", async () => {
    const { harness, review } = await setup();
    // Another Workspace's record: never registered for this account.
    const { candidates } = await harness.access.get(accountId, {
      reviewId: review.id,
    });
    harness.addLink("spec-1", link("Explicit relation", "Work", "foreign-1"));
    const after = await harness.access.get(accountId, { reviewId: review.id });

    expect(candidates.length).toBeLessThan(after.candidates.length);
    expect(
      find(after.candidates, "Work", "foreign-1", null)?.record,
    ).toMatchObject({ broken: { reason: "No access" }, title: null });
  });
});
