import type {
  PublicRoadmapInternalState,
  PublicRoadmapRecordFact,
} from "@cantiara/api/attention-signals-public-roadmap";
import { describe, expect, test } from "vitest";

import { createAttentionSignals } from "../attention-signals";
import {
  createPublicRoadmapReview,
  type PublicRoadmapFacts,
  type PublicRoadmapReviewStore,
} from "../public-roadmap-review";
import { createMemoryAttentionSignalStore } from "./attention-signals-memory-store";

const ACCOUNT = "account-1";
const DAY = 86_400_000;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

const record = (
  overrides: Partial<PublicRoadmapRecordFact> = {},
): PublicRoadmapRecordFact => ({
  approvedAt: new Date(T0).toISOString(),
  internalState: "active",
  publicLabel: "Planned",
  recordId: "work-1",
  recordKind: "Work",
  snapshotRevision: 1,
  ...overrides,
});

function setup(initial: PublicRoadmapRecordFact[], days: number | null = 30) {
  const attentionStore = createMemoryAttentionSignalStore();
  const attention = createAttentionSignals(attentionStore.store);
  const state = {
    clock: T0,
    facts: initial,
    factReads: 0,
    intervals: new Map<string, number>(
      days === null ? [] : [["project-1", days]],
    ),
    writes: 0,
  };
  const store: PublicRoadmapReviewStore = {
    get: (accountId, projectId) =>
      Promise.resolve(
        accountId === ACCOUNT && projectId === "project-1"
          ? { days: state.intervals.get(projectId) ?? null, readOnly: false }
          : undefined,
      ),
    listConfigured: () =>
      Promise.resolve(
        [...state.intervals].map(([projectId, d]) => ({ days: d, projectId })),
      ),
    set: (_accountId, projectId, value) => {
      if (value === null) {
        state.intervals.delete(projectId);
      } else {
        state.intervals.set(projectId, value);
      }
      return Promise.resolve(true);
    },
  };
  // The facts port is read-only: it exposes no write member to count.
  const facts: PublicRoadmapFacts = {
    read: () => {
      state.factReads += 1;
      return Promise.resolve(state.facts);
    },
  };
  const review = createPublicRoadmapReview(
    store,
    facts,
    attention,
    () => new Date(state.clock),
  );
  return { attention, review, state };
}

const signalsOf = async (attention: ReturnType<typeof setup>["attention"]) =>
  (await attention.center(ACCOUNT)).sections
    .flatMap((section) => section.groups.flatMap((group) => group.signals))
    .filter((signal) => signal.signalId === "public-roadmap-review-due");

describe("public-roadmap-review-due matrix", () => {
  test("is silent until the founder sets an interval, even for a very old snapshot", async () => {
    const { attention, review, state } = setup([record()], null);
    state.clock = T0 + 1000 * DAY;
    expect(await review.refresh(ACCOUNT)).toEqual({ emitted: 0 });
    expect(await signalsOf(attention)).toEqual([]);
    expect(await review.interval(ACCOUNT, { projectId: "project-1" })).toEqual({
      days: null,
      projectId: "project-1",
    });
  });

  test.each([7, 30, 180])("accepts %i whole days", async (days) => {
    const { review } = setup([]);
    await expect(
      review.setInterval(ACCOUNT, { days, projectId: "project-1" }),
    ).resolves.toEqual({ days, projectId: "project-1" });
  });

  test.each([0, 6, 181, 7.5, -1, Number.NaN])(
    "rejects %f as an interval",
    async (days) => {
      const { review } = setup([]);
      await expect(
        review.setInterval(ACCOUNT, { days, projectId: "project-1" }),
      ).rejects.toThrow();
    },
  );

  test("clears the interval with null", async () => {
    const { review } = setup([], 30);
    await expect(
      review.setInterval(ACCOUNT, { days: null, projectId: "project-1" }),
    ).resolves.toEqual({ days: null, projectId: "project-1" });
  });

  test("fires in Action Required exactly when the snapshot is the interval old", async () => {
    const { attention, review, state } = setup([record()], 30);
    state.clock = T0 + 30 * DAY - 1;
    expect(await review.refresh(ACCOUNT)).toEqual({ emitted: 0 });
    state.clock = T0 + 30 * DAY;
    expect(await review.refresh(ACCOUNT)).toEqual({ emitted: 1 });
    const [signal] = await signalsOf(attention);
    expect(signal).toMatchObject({
      group: { id: "work-1", kind: "Work" },
      projectId: "project-1",
      section: "Action Required",
      targetId: "work-1",
    });
    expect(signal?.occurredAt).toBe(new Date(T0 + 30 * DAY).toISOString());
  });

  test("emits at most one signal per snapshot revision, however often it runs", async () => {
    const { attention, review, state } = setup([record()], 30);
    state.clock = T0 + 31 * DAY;
    expect(await review.refresh(ACCOUNT)).toEqual({ emitted: 1 });
    state.clock = T0 + 90 * DAY;
    expect(await review.refresh(ACCOUNT)).toEqual({ emitted: 0 });
    expect(await review.refresh(ACCOUNT)).toEqual({ emitted: 0 });
    expect(await signalsOf(attention)).toHaveLength(1);
  });

  test("a new Onaylı snapshot revizyonu resets the interval", async () => {
    const { attention, review, state } = setup([record()], 30);
    state.clock = T0 + 31 * DAY;
    await review.refresh(ACCOUNT);
    state.facts = [
      record({
        approvedAt: new Date(T0 + 40 * DAY).toISOString(),
        snapshotRevision: 2,
      }),
    ];
    state.clock = T0 + 69 * DAY;
    expect(await review.refresh(ACCOUNT)).toEqual({ emitted: 0 });
    state.clock = T0 + 70 * DAY;
    expect(await review.refresh(ACCOUNT)).toEqual({ emitted: 1 });
    expect(await signalsOf(attention)).toHaveLength(2);
  });

  test.each<[string, Partial<PublicRoadmapRecordFact>]>([
    ["a completed public record", { internalState: "completed" }],
    ["a closed public record", { internalState: "closed" }],
    ["a record with no public label", { publicLabel: null }],
    [
      "a record with no approved snapshot",
      { approvedAt: null, snapshotRevision: null },
    ],
  ])("does not cover %s", async (_name, overrides) => {
    const { attention, review, state } = setup([record(overrides)], 30);
    state.clock = T0 + 365 * DAY;
    expect(await review.refresh(ACCOUNT)).toEqual({ emitted: 0 });
    expect(await signalsOf(attention)).toEqual([]);
  });

  test("covers each active public record on its own", async () => {
    const states: PublicRoadmapInternalState[] = [
      "active",
      "completed",
      "active",
    ];
    const { attention, review, state } = setup(
      states.map((internalState, index) =>
        record({ internalState, recordId: `work-${index}` }),
      ),
      30,
    );
    state.clock = T0 + 31 * DAY;
    expect(await review.refresh(ACCOUNT)).toEqual({ emitted: 2 });
    expect((await signalsOf(attention)).map((s) => s.targetId).sort()).toEqual([
      "work-0",
      "work-2",
    ]);
  });

  test("clearing the interval returns to silence", async () => {
    const { attention, review, state } = setup([record()], 30);
    await review.setInterval(ACCOUNT, { days: null, projectId: "project-1" });
    state.clock = T0 + 100 * DAY;
    expect(await review.refresh(ACCOUNT)).toEqual({ emitted: 0 });
    expect(await signalsOf(attention)).toEqual([]);
  });

  test("writes no status, label or snapshot: the facts are untouched and read-only", async () => {
    const { review, state } = setup([record()], 30);
    const before = JSON.stringify(state.facts);
    state.clock = T0 + 100 * DAY;
    await review.refresh(ACCOUNT);
    expect(JSON.stringify(state.facts)).toBe(before);
    expect(state.factReads).toBe(1);
  });

  test("refuses a Project the account does not own", async () => {
    const { review } = setup([]);
    await expect(
      review.setInterval("account-2", { days: 30, projectId: "project-1" }),
    ).rejects.toMatchObject({
      code: "PUBLIC_ROADMAP_REVIEW_PROJECT_NOT_FOUND",
    });
  });
});
