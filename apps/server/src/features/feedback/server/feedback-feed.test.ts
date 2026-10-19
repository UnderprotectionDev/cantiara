import type {
  Feed,
  FeedbackFeedStore,
  FeedRow,
} from "@cantiara/api/feedback-feed";
import { describe, expect, test } from "vitest";

import { FeedbackProjectNotFoundError } from "./feedback";
import { createFeedbackFeed } from "./feedback-feed";

const feedbackRow: FeedRow = {
  attachments: [{ id: "a1", name: "screenshot.png" }],
  body: "Export keeps failing\nfor large files.",
  id: "feedback-1",
  identity: "Email",
  kind: "Feedback",
  occurredAt: "2026-09-30T12:00:00.000Z",
  projectId: "project-1",
  related: [
    {
      id: "work-1",
      projectId: "project-1",
      title: "CAN-1 Fix export",
      type: "Work",
    },
    {
      id: "decision-1",
      projectId: "project-1",
      title: "Cap export size",
      type: "Decision",
    },
  ],
  status: "New",
  title: "Export fails",
};

const reviewedRow: FeedRow = {
  ...feedbackRow,
  attachments: [],
  id: "feedback-2",
  occurredAt: "2026-10-02T08:00:00.000Z",
  related: [],
  status: "Reviewed",
  title: "Slow search",
};

const sourceRow: FeedRow = {
  attachments: [],
  body: "Captured article text about export formats.",
  id: "source-1",
  identity: "example.com",
  kind: "Source",
  occurredAt: "2026-10-01T10:00:00.000Z",
  projectId: "project-1",
  related: [],
  status: null,
  title: "Export formats article",
};

/** Store with only a read method: the port cannot express a write. */
function createStore(rows: FeedRow[]) {
  const calls: string[] = [];
  const store: FeedbackFeedStore = {
    read: async (accountId, projectId): Promise<Feed | null> => {
      await Promise.resolve();
      calls.push("read");
      return accountId === "account-1" && projectId === "project-1"
        ? { readOnly: false, rows }
        : null;
    },
  };
  return { calls, store };
}

const SOCIAL_OR_SIGNAL_KEY =
  /like|comment|vote|reaction|reply|unread|read(At)?$|notif|signal|priority|score/i;

const allRows = [feedbackRow, reviewedRow, sourceRow];

describe("Feedback and Source Feed", () => {
  test("shows the same master record ids with identity, time, attachments, project and related Work/Decision", async () => {
    const { store } = createStore(allRows);
    const feed = await createFeedbackFeed(store).feed("account-1", {
      projectId: "project-1",
    });

    expect(feed.rows.map(({ id }) => id)).toEqual([
      "feedback-2",
      "source-1",
      "feedback-1",
    ]);
    const row = feed.rows.find(({ id }) => id === "feedback-1");
    expect(row).toEqual(feedbackRow);
    expect(row?.related.map(({ type }) => type)).toEqual(["Work", "Decision"]);
    expect(feed.rows.map(({ kind }) => kind).sort()).toEqual([
      "Feedback",
      "Feedback",
      "Source",
    ]);
  });

  test("sorts newest or oldest first and filters by source type and status", async () => {
    const access = createFeedbackFeed(createStore(allRows).store);

    const oldest = await access.feed("account-1", {
      projectId: "project-1",
      sort: "Oldest first",
    });
    expect(oldest.rows.map(({ id }) => id)).toEqual([
      "feedback-1",
      "source-1",
      "feedback-2",
    ]);
    const sources = await access.feed("account-1", {
      projectId: "project-1",
      sourceType: "Source",
    });
    expect(sources.rows.map(({ id }) => id)).toEqual(["source-1"]);
    const reviewed = await access.feed("account-1", {
      conditions: { status: "Reviewed" },
      projectId: "project-1",
    });
    expect(reviewed.rows.map(({ id }) => id)).toEqual(["feedback-2"]);
  });

  test("sorting and filtering do not write Source or Feedback status, priority or the rows", async () => {
    const rows = structuredClone(allRows);
    const before = structuredClone(rows);
    const { calls, store } = createStore(rows);
    const access = createFeedbackFeed(store);

    await access.feed("account-1", {
      projectId: "project-1",
      sort: "Oldest first",
    });
    await access.feed("account-1", {
      conditions: { status: "New" },
      projectId: "project-1",
    });

    expect(calls).toEqual(["read", "read"]);
    expect(Object.keys(store)).toEqual(["read"]);
    expect(rows).toEqual(before);
  });

  test("refuses status, priority and social fields as Feed input", async () => {
    const access = createFeedbackFeed(createStore(allRows).store);

    const refusals = [
      { priority: "High" },
      { status: "Archived" },
      { conditions: { status: "Valid" } },
      { conditions: { priority: "High" } },
      { like: true },
      { vote: 1 },
      { comment: "hi" },
      { recheck: true },
    ].map((extra) =>
      access.feed("account-1", { projectId: "project-1", ...extra } as never),
    );

    for (const refusal of refusals) {
      expect(refusal).toBeInstanceOf(Promise);
    }
    const settled = await Promise.allSettled(refusals);
    expect(settled.every(({ status }) => status === "rejected")).toBe(true);
  });

  test("rows carry no like, comment, vote, read or notification field and expose only a read method", async () => {
    const access = createFeedbackFeed(createStore(allRows).store);
    const feed = await access.feed("account-1", { projectId: "project-1" });

    expect(Object.keys(access)).toEqual(["feed"]);
    const keys = feed.rows.flatMap((row) => Object.keys(row));
    expect(keys.filter((key) => SOCIAL_OR_SIGNAL_KEY.test(key))).toEqual([]);
  });

  test("hides a Project that is not owned", async () => {
    const access = createFeedbackFeed(createStore(allRows).store);

    await expect(
      access.feed("account-2", { projectId: "project-1" }),
    ).rejects.toBeInstanceOf(FeedbackProjectNotFoundError);
  });
});
