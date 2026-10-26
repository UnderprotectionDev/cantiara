import {
  clusterProjectActivityRows,
  type ProjectActivityFacts,
  type ProjectActivityHistoryFact,
  projectActivityInputSchema,
  projectActivitySchema,
} from "@cantiara/api/project-activity";
import {
  STORY_EVENT_KINDS,
  STORY_SOURCE_TYPES,
} from "@cantiara/api/project-history";
import { describe, expect, test } from "vitest";

import { createProjectActivity } from "../project-activity";
import { createMemoryProjectActivity } from "../project-activity-memory-store";

const SECRET_TEXT = /s3cret|private words/;
const SIGNAL_TEXT = /signal|notification|story/;
const CLUSTER_TEXT = /cluster|field/i;
const ACCOUNT = "account-1";
const HUMAN = { clientIdempotencyKey: "key", kind: "human" } as const;
const SOURCE_ORIGIN = {
  deliveryId: "delivery-1",
  kind: "source",
  sourceId: "source-1",
} as const;
const WORK = {
  label: "TID-1 Ship",
  recordId: "work-1",
  recordType: "Work",
} as const;
const OTHER_WORK = {
  label: "TID-2 Other",
  recordId: "work-2",
  recordType: "Work",
} as const;

let counter = 0;

/** `minute` is minutes after 10:00 (fractions allowed via seconds). */
function fact(
  minute: number,
  overrides: Partial<ProjectActivityHistoryFact> & {
    next?: Record<string, unknown> | null;
    previous?: Record<string, unknown> | null;
  } = {},
): ProjectActivityHistoryFact {
  counter += 1;
  const { next, previous, ...rest } = overrides;
  const at = new Date(Date.UTC(2026, 4, 1, 10, 0, 0) + minute * 60_000);
  return {
    actor: { actorId: "user-1", type: "User" },
    id: `h${String(counter).padStart(3, "0")}`,
    nextValue: {
      work: "next" in overrides ? next : { title: `T${counter}` },
    } as never,
    occurredAt: at.toISOString(),
    origin: HUMAN,
    previousValue: {
      work: "previous" in overrides ? previous : { title: "A" },
    } as never,
    relation: false,
    revision: counter,
    source: WORK,
    ...rest,
  };
}

function setup(history: ProjectActivityHistoryFact[]) {
  const facts: ProjectActivityFacts = {
    history,
    unattributed: [],
    windowReached: false,
  };
  const activity = createProjectActivity(
    createMemoryProjectActivity({
      accountId: ACCOUNT,
      facts: new Map([["project-1", facts]]),
    }),
  );
  return (input: Record<string, unknown> = {}) =>
    activity.list(
      ACCOUNT,
      projectActivityInputSchema.parse({ projectId: "project-1", ...input }),
    );
}

function clusters(activity: Awaited<ReturnType<ReturnType<typeof setup>>>) {
  return activity.entries.flatMap((entry) =>
    entry.kind === "cluster" ? [entry.cluster] : [],
  );
}

describe("Five-Minute Presentation Cluster", () => {
  test("forms one cluster from safe field changes of one actor on one record, chained within five minutes", async () => {
    const list = setup([
      fact(0, { next: { title: "B" } }),
      fact(4, { next: { description: "x" }, previous: { description: "" } }),
      fact(9, { next: { title: "C" }, previous: { title: "B" } }),
      fact(15, { next: { title: "D" }, previous: { title: "C" } }),
    ]);
    const activity = await list();
    const [cluster] = clusters(activity);

    expect(activity.entries).toHaveLength(2);
    expect(activity.entries[0]?.kind).toBe("row");
    expect(cluster?.rows).toHaveLength(3);
    expect(cluster?.fieldNames.sort()).toEqual(["description", "title"]);
    expect(cluster?.from).toBe("2026-05-01T10:00:00.000Z");
    expect(cluster?.to).toBe("2026-05-01T10:09:00.000Z");
    expect(cluster?.actor.kind).toBe("User");
    expect(() => projectActivitySchema.parse(activity)).not.toThrow();
  });

  test("a gap of more than five minutes starts a new group; exactly five joins", async () => {
    const { rows } = await setup([fact(0), fact(5), fact(10.2), fact(30)])();
    const entries = clusterProjectActivityRows(rows);
    expect(entries.map((entry) => entry.kind)).toEqual([
      "row",
      "row",
      "cluster",
    ]);
  });

  test("expansion lists every atomic event with time, previous-next, origin and undo boundary", async () => {
    const list = setup([
      fact(0, { next: { title: "B" }, previous: { title: "A" } }),
      fact(1, {
        next: { title: "C" },
        previous: { title: "B" },
        undo: { kind: "field" },
      }),
    ]);
    const activity = await list();
    const [cluster] = clusters(activity);

    expect(cluster?.rows.map((row) => row.id)).toEqual(
      [...activity.rows].map((row) => row.id),
    );
    expect(cluster?.rows).toEqual(activity.rows);
    const newest = cluster?.rows[0];
    expect(newest?.occurredAt).toBe("2026-05-01T10:01:00.000Z");
    expect(newest?.changes[0]?.values).toMatchObject({
      kind: "shown",
      next: "C",
      previous: "B",
    });
    expect(newest?.origin).toEqual({ kind: "human" });
    expect(newest?.undo).toEqual({ kind: "field", of: null, undoable: true });
    expect(cluster?.rows[1]?.undo).toEqual({
      kind: null,
      of: null,
      undoable: false,
    });
  });

  test("never mixes User, System automation, GitHub and Authorized integration", async () => {
    const list = setup([
      fact(0),
      fact(1, {
        actor: { actorId: "gh-1", type: "GitHub" },
        origin: SOURCE_ORIGIN,
      }),
      fact(2, {
        actor: {
          actorId: "int-1",
          authorizingUserId: "user-1",
          type: "Authorized integration",
        },
      }),
      fact(3, { actor: { actorId: "rule-1", type: "System automation" } }),
      fact(4, { actor: { actorId: "user-2", type: "User" } }),
    ]);
    const activity = await list();
    expect(clusters(activity)).toHaveLength(0);
    expect(activity.entries).toHaveLength(5);

    const same = await setup([
      fact(0, {
        actor: { actorId: "gh-1", type: "GitHub" },
        origin: SOURCE_ORIGIN,
      }),
      fact(1, {
        actor: { actorId: "gh-1", type: "GitHub" },
        origin: SOURCE_ORIGIN,
      }),
      fact(2),
      fact(3),
    ])();
    expect(
      clusters(same)
        .map((c) => c.actor.kind)
        .sort(),
    ).toEqual(["GitHub", "User"]);
  });

  test("does not cluster across records or across a human and a source origin", async () => {
    const activity = await setup([
      fact(0),
      fact(1, { source: OTHER_WORK }),
      fact(2, { origin: SOURCE_ORIGIN }),
    ])();
    expect(clusters(activity)).toHaveLength(0);
  });

  test("lifecycle, undo and structural boundaries stay outside clusters and split them", async () => {
    const activity = await setup([
      fact(0),
      fact(1),
      fact(2, { next: { status: "Done" }, previous: { status: "Todo" } }),
      fact(3),
      fact(4),
      fact(5, { undoOf: "h-earlier" }),
      fact(6),
      fact(7, { undo: { kind: "relation" } }),
      fact(8),
      fact(9, { next: { title: "N" }, previous: null }),
      fact(10, {
        next: { archivedAt: "2026-05-01T00:00:00.000Z" },
        previous: { archivedAt: null },
      }),
      fact(11, { next: { title: "R" }, relation: true }),
    ])();

    const grouped = clusters(activity);
    expect(grouped).toHaveLength(2);
    for (const cluster of grouped) {
      expect(
        cluster.rows.every(
          (row) =>
            row.eventType === "Field change" &&
            row.undo.of === null &&
            row.undo.kind !== "relation",
        ),
      ).toBe(true);
    }
    const alone = activity.entries.flatMap((entry) =>
      entry.kind === "row" ? [entry.row.eventType] : [],
    );
    expect(alone).toEqual(
      expect.arrayContaining([
        "Status change",
        "Create",
        "Archive",
        "Relation",
      ]),
    );
    expect(
      activity.entries.some(
        (entry) => entry.kind === "row" && entry.row.undo.of !== null,
      ),
    ).toBe(true);
    // No atomic row is dropped or summed.
    expect(
      activity.entries.reduce(
        (sum, entry) =>
          sum + (entry.kind === "cluster" ? entry.cluster.rows.length : 1),
        0,
      ),
    ).toBe(activity.rows.length);
  });

  test("redacted rows are not clustered and a summary never carries values", async () => {
    const activity = await setup([
      fact(0, {
        next: { apiToken: "s3cret-new", title: "B" },
        previous: { apiToken: "s3cret-old", title: "A" },
      }),
      fact(1, {
        next: { title: "C" },
        previous: { title: "B" },
      }),
      fact(2, {
        next: { note: { redacted: true } },
        previous: { note: "private words" },
      }),
    ])();
    const [cluster] = clusters(activity);
    expect(cluster?.rows).toHaveLength(2);
    expect(activity.entries.filter((e) => e.kind === "row")).toHaveLength(1);
    const { rows: _rows, ...summary } = cluster ?? {};
    expect(JSON.stringify(summary)).not.toMatch(SECRET_TEXT);
    expect(JSON.stringify(activity)).not.toMatch(SECRET_TEXT);
  });

  test("a cluster mints no Dikkat sinyali and the Story Timeline does not treat it as a story event", async () => {
    const activity = await setup([fact(0), fact(1)])();
    expect(Object.keys(activity).sort()).toEqual([
      "entries",
      "nextCursor",
      "projectId",
      "rows",
      "sources",
      "unattributed",
      "windowReached",
    ]);
    expect(JSON.stringify(clusters(activity)[0]).toLowerCase()).not.toMatch(
      SIGNAL_TEXT,
    );
    expect(STORY_EVENT_KINDS.join()).not.toMatch(CLUSTER_TEXT);
    expect(STORY_SOURCE_TYPES.join()).not.toMatch(CLUSTER_TEXT);
  });

  test("a record's own history clusters its changes through the sourceRecord filter", async () => {
    const list = setup([
      fact(0),
      fact(1),
      fact(2, { source: OTHER_WORK }),
      fact(3, { source: OTHER_WORK }),
      fact(4, {
        source: { label: "Doc", recordId: "work-1", recordType: "Document" },
      }),
    ]);
    const own = await list({
      sourceRecord: { recordId: "work-1", recordType: "Work" },
    });
    expect(own.rows).toHaveLength(2);
    expect(clusters(own)).toHaveLength(1);
    expect(clusters(own)[0]?.source.recordId).toBe("work-1");
    expect(
      projectActivityInputSchema.safeParse({
        projectId: "p",
        sourceRecord: { recordId: "x", recordType: "Project" },
      }).success,
    ).toBe(false);
  });

  test("is deterministic for the same rows", async () => {
    const activity = await setup([fact(0), fact(2), fact(4)])();
    expect(clusterProjectActivityRows([...activity.rows].reverse())).toEqual(
      clusterProjectActivityRows(activity.rows),
    );
  });
});
