import {
  PROJECT_ACTIVITY_EVENT_TYPES,
  PROJECT_ACTIVITY_SOURCE_TYPES,
  type ProjectActivityFacts,
  type ProjectActivityHistoryFact,
  projectActivityInputSchema,
} from "@cantiara/api/project-activity";
import { describe, expect, test } from "vitest";

import {
  createProjectActivity,
  ProjectActivityProjectNotFoundError,
} from "../project-activity";
import { createMemoryProjectActivity } from "../project-activity-memory-store";

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

let counter = 0;

function fact(
  overrides: Partial<ProjectActivityHistoryFact> & {
    next?: Record<string, unknown> | null;
    previous?: Record<string, unknown> | null;
  } = {},
): ProjectActivityHistoryFact {
  counter += 1;
  const source = overrides.source ?? WORK;
  const key = source.recordType.toLowerCase();
  const { next, previous, ...rest } = overrides;
  return {
    actor: { actorId: "user-1", type: "User" },
    id: `h${String(counter).padStart(3, "0")}`,
    nextValue: { [key]: "next" in overrides ? next : { title: "B" } } as never,
    occurredAt: `2026-05-01T10:${String(counter).padStart(2, "0")}:00.000Z`,
    origin: HUMAN,
    previousValue: {
      [key]: "previous" in overrides ? previous : { title: "A" },
    } as never,
    relation: false,
    revision: counter,
    source,
    ...rest,
  };
}

function setup(history: ProjectActivityHistoryFact[]) {
  const facts: ProjectActivityFacts = {
    history,
    unattributed: ["Backlog order (keyed by Project)"],
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

describe("Project Activity projection", () => {
  test("filters by source record type and by event type from closed sets", async () => {
    const list = setup([
      fact({ next: { title: "B" }, previous: null }),
      fact({ next: { status: "Done" }, previous: { status: "Todo" } }),
      fact({
        next: { archivedAt: "2026-05-01T00:00:00.000Z" },
        previous: { archivedAt: null },
      }),
      fact({ next: { title: "B" }, relation: true }),
      fact({
        next: { title: "Doc B" },
        previous: { title: "Doc A" },
        source: { label: "Spec", recordId: "doc-1", recordType: "Document" },
      }),
      fact({
        next: { life: "Resolved" },
        previous: { life: "Open" },
        source: { label: "Data loss", recordId: "risk-1", recordType: "Risk" },
      }),
    ]);

    expect(PROJECT_ACTIVITY_SOURCE_TYPES).toEqual([
      "Work",
      "Document",
      "Decision",
      "Risk",
      "Automation",
      "GitHub",
    ]);
    expect(PROJECT_ACTIVITY_EVENT_TYPES).toEqual([
      "Create",
      "Field change",
      "Status change",
      "Archive",
      "Relation",
      "Automation",
    ]);

    const all = await list();
    expect(all.rows).toHaveLength(6);

    const documents = await list({ sourceTypes: ["Document"] });
    expect(documents.rows.map((row) => row.source.recordType)).toEqual([
      "Document",
    ]);

    const statuses = await list({ eventTypes: ["Status change"] });
    expect(statuses.rows.map((row) => row.source.recordType).sort()).toEqual([
      "Risk",
      "Work",
    ]);

    const workStatus = await list({
      eventTypes: ["Status change"],
      sourceTypes: ["Work"],
    });
    expect(workStatus.rows).toHaveLength(1);
    expect(
      (await list({ eventTypes: ["Create"] })).rows.map((r) => r.eventType),
    ).toEqual(["Create"]);
    expect(
      (await list({ eventTypes: ["Archive"] })).rows.map((r) => r.eventType),
    ).toEqual(["Archive"]);
    expect(
      (await list({ eventTypes: ["Relation"] })).rows.map((r) => r.eventType),
    ).toEqual(["Relation"]);
    expect(
      (await list({ eventTypes: ["Field change"] })).rows.map(
        (r) => r.source.recordType,
      ),
    ).toEqual(["Document"]);
  });

  test("keeps the user, System automation and GitHub actor on every row", async () => {
    const list = setup([
      fact(),
      fact({ actor: { actorId: "rule-1", type: "System automation" } }),
      fact({
        actor: { actorId: "gh-1", type: "GitHub" },
        origin: SOURCE_ORIGIN,
      }),
    ]);

    const { rows } = await list();
    expect(rows.map((row) => row.actor.kind).sort()).toEqual([
      "GitHub",
      "System automation",
      "User",
    ]);
    expect(rows.find((row) => row.actor.kind === "GitHub")?.origin).toEqual({
      deliveryId: "delivery-1",
      kind: "source",
      sourceId: "source-1",
    });

    const automation = await list({ sourceTypes: ["Automation"] });
    expect(automation.rows.map((row) => row.actor.kind)).toEqual([
      "System automation",
    ]);
    expect(automation.rows[0]?.eventType).toBe("Automation");
    expect(
      (await list({ eventTypes: ["Automation"] })).rows.map(
        (row) => row.actor.kind,
      ),
    ).toEqual(["System automation"]);

    const github = await list({ sourceTypes: ["GitHub"] });
    expect(github.rows.map((row) => row.actor.kind)).toEqual(["GitHub"]);
  });

  test("shows previous and next values of supported field changes", async () => {
    const list = setup([
      fact({
        next: { status: "Done", title: "B", updatedAt: "later" },
        previous: { status: "Todo", title: "A", updatedAt: "earlier" },
      }),
    ]);

    const [row] = (await list()).rows;
    expect(row?.changes).toEqual([
      {
        field: "status",
        values: {
          kind: "shown",
          next: "Done",
          nextTruncated: false,
          previous: "Todo",
          previousTruncated: false,
        },
      },
      {
        field: "title",
        values: {
          kind: "shown",
          next: "B",
          nextTruncated: false,
          previous: "A",
          previousTruncated: false,
        },
      },
    ]);
    expect(row?.source).toEqual(WORK);
  });

  test("never shows a secret or a redacted value as previous–next", async () => {
    const list = setup([
      fact({
        next: { apiToken: "sk-live-NEW", title: "B" },
        previous: { apiToken: "sk-live-OLD", title: "A" },
      }),
      fact({
        next: { redacted: true },
        previous: { title: "leaks-if-shown" },
      }),
      fact({
        next: { note: { redacted: true, reason: "security" }, title: "B" },
        previous: { note: "hunter2", title: "A" },
      }),
    ]);

    const response = await list();
    const serialized = JSON.stringify(response);
    for (const secret of ["sk-live-NEW", "sk-live-OLD", "hunter2"]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).not.toContain("leaks-if-shown");

    const token = response.rows.find((row) =>
      row.changes.some((change) => change.field === "apiToken"),
    );
    expect(
      token?.changes.find((change) => change.field === "apiToken")?.values,
    ).toEqual({ kind: "redacted" });
    expect(response.rows.filter((row) => row.redacted)).toHaveLength(2);
    expect(
      response.rows.filter((row) => row.redacted).map((row) => row.changes),
    ).toContainEqual([]);
  });

  test("keeps every history entry atomic with its own time, origin and undo boundary", async () => {
    const list = setup([
      fact({
        occurredAt: "2026-05-01T10:00:00.000Z",
        undo: { kind: "field" },
      }),
      fact({ occurredAt: "2026-05-01T10:01:00.000Z" }),
      fact({
        occurredAt: "2026-05-01T10:02:00.000Z",
        undoOf: "h-original",
      }),
    ]);

    const { rows } = await list();
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.occurredAt)).toEqual([
      "2026-05-01T10:02:00.000Z",
      "2026-05-01T10:01:00.000Z",
      "2026-05-01T10:00:00.000Z",
    ]);
    expect(rows.map((row) => row.undo)).toEqual([
      { kind: null, of: "h-original", undoable: false },
      { kind: null, of: null, undoable: false },
      { kind: "field", of: null, undoable: true },
    ]);
  });

  test("pages with a cursor and reports sources that are partial or unattributed", async () => {
    const list = setup(Array.from({ length: 5 }, () => fact()));

    const first = await list({ limit: 2 });
    expect(first.rows).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await list({
      cursor: first.nextCursor ?? undefined,
      limit: 2,
    });
    const third = await list({
      cursor: second.nextCursor ?? undefined,
      limit: 2,
    });
    expect(third.rows).toHaveLength(1);
    expect(third.nextCursor).toBeNull();
    expect(
      new Set([...first.rows, ...second.rows, ...third.rows].map((r) => r.id))
        .size,
    ).toBe(5);

    expect(first.unattributed).toEqual(["Backlog order (keyed by Project)"]);
    const github = first.sources.find((s) => s.sourceType === "GitHub");
    expect(github?.status).toBe("partial");
    expect(github?.reason).toContain("no per-change history");
    expect(
      first.sources.find((s) => s.sourceType === "Decision")?.reason,
    ).toContain("No Decision history");
  });

  test("refuses a Project the account does not own and any domain-write field", async () => {
    const list = setup([]);
    const activity = createProjectActivity(
      createMemoryProjectActivity({ accountId: ACCOUNT, facts: new Map() }),
    );
    await expect(
      activity.list(
        ACCOUNT,
        projectActivityInputSchema.parse({ projectId: "project-9" }),
      ),
    ).rejects.toBeInstanceOf(ProjectActivityProjectNotFoundError);
    expect(
      projectActivityInputSchema.safeParse({
        projectId: "project-1",
        signal: true,
      }).success,
    ).toBe(false);
    expect(
      projectActivityInputSchema.safeParse({
        projectId: "project-1",
        sourceTypes: ["GitHub Activity"],
      }).success,
    ).toBe(false);
    expect((await list()).rows).toEqual([]);
  });

  test("rows carry no signal or story event and the feed is not a story", async () => {
    const list = setup([fact()]);
    const response = await list();
    const keys = new Set([
      ...Object.keys(response),
      ...Object.keys(response.rows[0] ?? {}),
    ]);
    for (const forbidden of [
      "signal",
      "signalId",
      "attention",
      "storyEvent",
      "timeline",
      "notification",
    ]) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });
});
