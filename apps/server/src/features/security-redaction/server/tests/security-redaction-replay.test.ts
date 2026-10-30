import {
  REDACTED_VALUE_MARK,
  redactJson,
  redactText,
  SECURITY_REDACTION_EVENT_TYPE,
  type SecurityRedactionEvent,
  type SecurityRedactionEventLog,
  SecurityRedactionGrantRejectedError,
  SecurityRedactionSpreadIncompleteError,
  type SecurityRedactionTargetAdapter,
  SecurityRedactionTypedNameMismatchError,
} from "@cantiara/api/security-redaction";
import { describe, expect, test, vi } from "vitest";

import { createSecurityRedaction } from "../security-redaction";
import {
  packSecurityRedactionTarget,
  unpackSecurityRedactionTarget,
} from "../security-redaction-events-database";
import {
  createSecurityRedactionReplay,
  findReplayValue,
} from "../security-redaction-replay";
import { createSecurityRedactionSpread } from "../security-redaction-spread";

const ACCOUNT = "account-1";
const ACTOR = { accountId: ACCOUNT, accountName: "Mert Demirkaya" };
const SECRET = "sk-live-very-secret";
const SHORT_SECRET = "hunter2";
const KEY = "server-only-replay-key-0123456789";
const NOW = new Date("2026-03-01T10:00:00.000Z");
const project = { kind: "Project", projectId: "project-1" } as const;

/** The log double: append-only, in memory, never part of the restore unit. */
function eventLog() {
  const events: SecurityRedactionEvent[] = [];
  const log: SecurityRedactionEventLog = {
    append: (event) => {
      if (!events.some((known) => known.id === event.id)) {
        events.push(event);
      }
      return Promise.resolve();
    },
    list: () => Promise.resolve([...events]),
  };
  return { events, log };
}

/** A Document row as the product read path serves it: trashed rows are hidden. */
interface Row {
  body: string;
  id: string;
  title: string;
  trashed: boolean;
}

/** Current content with Trash restore, plus the stale before-image an undo keeps. */
function store(rows: Row[], undoBeforeImages: { body: string }[] = []) {
  const state = { rows, undoBeforeImages };
  const adapter: SecurityRedactionTargetAdapter = {
    kind: "current-field",
    remove: ({ sensitiveValue }) => {
      let copies = 0;
      for (const row of state.rows) {
        const next = redactJson(
          { body: row.body, title: row.title },
          sensitiveValue,
        );
        if (next.changed) {
          const value = next.value as { body: string; title: string };
          row.body = value.body;
          row.title = value.title;
          copies += 1;
        }
      }
      return Promise.resolve(copies);
    },
  };
  const undoAdapter: SecurityRedactionTargetAdapter = {
    kind: "history-revision",
    remove: ({ sensitiveValue }) => {
      let copies = 0;
      for (const image of state.undoBeforeImages) {
        const next = redactText(image.body, sensitiveValue);
        if (next !== image.body) {
          image.body = next;
          copies += 1;
        }
      }
      return Promise.resolve(copies);
    },
  };
  return {
    adapters: [adapter, undoAdapter],
    /** Trash restore un-stamps the same row: it copies nothing from elsewhere. */
    restore: (id: string) => {
      for (const row of state.rows) {
        if (row.id === id) {
          row.trashed = false;
        }
      }
    },
    /** What the product read path serves right now. */
    readable: () =>
      state.rows
        .filter((row) => !row.trashed)
        .map((row) => `${row.title} ${row.body}`),
    /** Mutation undo writes the before-image back as the row body. */
    undo: (id: string) => {
      const image = state.undoBeforeImages.shift();
      const row = state.rows.find((known) => known.id === id);
      if (row && image) {
        row.body = image.body;
      }
    },
    texts: () =>
      Promise.resolve(state.rows.flatMap((row) => [row.title, row.body])),
  };
}

function setup(
  rows: Row[],
  options: {
    failingAdapters?: SecurityRedactionTargetAdapter[];
    undoBeforeImages?: { body: string }[];
  } = {},
) {
  const world = store(rows, options.undoBeforeImages);
  const { events, log } = eventLog();
  const spreadEngine = createSecurityRedactionSpread([
    ...world.adapters,
    ...(options.failingAdapters ?? []),
  ]);
  const spread = { spread: vi.fn(spreadEngine.spread) };
  let counter = 0;
  const access = createSecurityRedaction({
    now: () => NOW,
    projectName: (accountId, projectId) =>
      Promise.resolve(
        accountId === ACCOUNT && projectId === "project-1" ? "Atlas" : null,
      ),
    recording: {
      actorAlias: (accountId) =>
        Promise.resolve(`account:alias-of-${accountId}`),
      log,
      newOperationId: () => {
        counter += 1;
        return `op-${counter}`;
      },
      replayKey: KEY,
    },
    spread,
  });
  const replay = createSecurityRedactionReplay({
    events: log,
    key: KEY,
    spread,
    texts: world.texts,
  });
  const apply = (value = SECRET, overrides: Record<string, unknown> = {}) =>
    access.apply(
      ACTOR,
      {
        grant: "grant-1",
        scope: project,
        sensitiveValue: value,
        typedName: "Atlas",
        ...overrides,
      } as never,
      () => Promise.resolve(true),
    );
  return { apply, events, log, replay, spread, world };
}

const rowsWith = (value: string): Row[] => [
  { body: `deploy with ${value}`, id: "d1", title: "Deploy", trashed: false },
  { body: `use ${value} here`, id: "d2", title: "Notes", trashed: true },
];

describe("Security Redaction event", () => {
  test("apply appends one secret-free pseudonymised event with a replay locator", async () => {
    const harness = setup(rowsWith(SECRET));
    await harness.apply();

    expect(harness.events).toHaveLength(1);
    const [event] = harness.events;
    expect(event).toMatchObject({
      actorAlias: "account:alias-of-account-1",
      id: "security-redaction:op-1",
      occurredAt: NOW.toISOString(),
      operationId: "op-1",
      scopeAlias: "Project:account-1:project-1",
      type: SECURITY_REDACTION_EVENT_TYPE,
      version: 1,
    });
    expect(event?.replay.length).toBe(SECRET.length);
    const serialised = JSON.stringify(event);
    expect(serialised).not.toContain(SECRET);
    expect(serialised).not.toContain("Mert");
    expect(serialised).not.toContain("Atlas");
    expect(serialised).not.toContain("grant-1");
  });

  test("the locator of a short value is keyed and salted, so the log alone cannot confirm a guess", async () => {
    const first = setup(rowsWith(SHORT_SECRET));
    const second = setup(rowsWith(SHORT_SECRET));
    await first.apply(SHORT_SECRET);
    await second.apply(SHORT_SECRET);

    const [one] = first.events;
    const [two] = second.events;
    expect(one?.replay.salt).not.toBe(two?.replay.salt);
    expect(one?.replay.digest).not.toBe(two?.replay.digest);
    // A guess without the server key finds nothing.
    expect(
      findReplayValue("another-key", one?.replay as never, SHORT_SECRET),
    ).toBeNull();
    expect(findReplayValue(KEY, one?.replay as never, SHORT_SECRET)).toBe(
      SHORT_SECRET,
    );
  });

  test("a refusal writes no event", async () => {
    const harness = setup(rowsWith(SECRET));
    await expect(
      harness.apply(SECRET, { typedName: "Oops" }),
    ).rejects.toBeInstanceOf(SecurityRedactionTypedNameMismatchError);
    expect(harness.events).toEqual([]);

    const access = createSecurityRedaction({
      projectName: () => Promise.resolve("Atlas"),
      recording: {
        actorAlias: () => Promise.resolve("alias"),
        log: harness.log,
        replayKey: KEY,
      },
    });
    await expect(
      access.apply(
        ACTOR,
        {
          grant: "bad",
          scope: project,
          sensitiveValue: SECRET,
          typedName: "Atlas",
        } as never,
        () => Promise.resolve(false),
      ),
    ).rejects.toBeInstanceOf(SecurityRedactionGrantRejectedError);
    expect(harness.events).toEqual([]);
  });

  test("a partly failed spread still records the event so replay can finish", async () => {
    const harness = setup(rowsWith(SECRET), {
      failingAdapters: [
        { kind: "cache", remove: () => Promise.reject(new Error(SECRET)) },
      ],
    });
    await expect(harness.apply()).rejects.toBeInstanceOf(
      SecurityRedactionSpreadIncompleteError,
    );
    expect(harness.events).toHaveLength(1);
  });

  test("the event packs into the existing security log columns without a value", () => {
    const event: SecurityRedactionEvent = {
      actorAlias: "alias",
      id: "security-redaction:op-1",
      occurredAt: NOW.toISOString(),
      operationId: "op-1",
      replay: { digest: "ab12", length: 7, salt: "cd34" },
      scopeAlias: "Project:account-1:project-1",
      type: SECURITY_REDACTION_EVENT_TYPE,
      version: 1,
    };
    const packed = packSecurityRedactionTarget(event);
    expect(unpackSecurityRedactionTarget(packed)).toEqual({
      operationId: "op-1",
      replay: event.replay,
      scopeAlias: event.scopeAlias,
    });
    expect(unpackSecurityRedactionTarget("garbage")).toBeNull();
  });
});

describe("Security Redaction restore does not resurrect", () => {
  test("a Trash restore of a redacted row brings back the mark, never the value", async () => {
    const harness = setup(rowsWith(SECRET));
    expect(harness.world.readable().join()).toContain(SECRET);

    await harness.apply();
    // d2 sat in Trash while the redaction ran: it was cleaned there too.
    harness.world.restore("d2");

    const readable = harness.world.readable();
    expect(readable).toHaveLength(2);
    expect(readable.join()).not.toContain(SECRET);
    expect(readable.join()).toContain(REDACTED_VALUE_MARK);
  });

  test("a mutation undo writes back the redacted before-image, never the value", async () => {
    const harness = setup(rowsWith(SECRET), {
      undoBeforeImages: [{ body: `old text ${SECRET}` }],
    });
    await harness.apply();
    harness.world.undo("d1");

    const readable = harness.world.readable().join();
    expect(readable).not.toContain(SECRET);
    expect(readable).toContain("old text");
  });
});

describe("Security Redaction replay", () => {
  test("a restored row that still holds the value is cleaned again through the one spread", async () => {
    const harness = setup(rowsWith(SECRET));
    await harness.apply();
    const applied = harness.spread.spread.mock.calls.length;

    // A restore from an older backup brings the value back, in a living and a trashed row.
    const restored = setup(rowsWith(SECRET));
    const replay = createSecurityRedactionReplay({
      events: harness.log,
      key: KEY,
      spread: restored.spread,
      texts: restored.world.texts,
    });
    expect(restored.world.readable().join()).toContain(SECRET);

    const result = await replay.replay();

    expect(result).toEqual({ reapplied: 1, unreadable: 0 });
    expect(restored.world.readable().join()).not.toContain(SECRET);
    restored.world.restore("d2");
    expect(restored.world.readable().join()).not.toContain(SECRET);
    // Replay is a second trigger of the same engine: one more spread call, no second path.
    expect(restored.spread.spread).toHaveBeenCalledTimes(1);
    expect(applied).toBe(1);
    expect(restored.spread.spread.mock.calls[0]?.[0]).toEqual({
      accountId: ACCOUNT,
      scope: project,
      sensitiveValue: SECRET,
    });
    // Replay writes no new event: the log is the record of the first apply.
    expect(harness.events).toHaveLength(1);
  });

  test("replay is idempotent and leaves a clean store alone", async () => {
    const harness = setup(rowsWith(SECRET));
    await harness.apply();
    harness.spread.spread.mockClear();

    expect(await harness.replay.replay()).toEqual({
      reapplied: 0,
      unreadable: 0,
    });
    expect(harness.spread.spread).not.toHaveBeenCalled();
  });

  test("a short value is found again and an unrelated text is not", async () => {
    const harness = setup(rowsWith(SHORT_SECRET));
    await harness.apply(SHORT_SECRET);
    const restored = setup([
      { body: "password is hunter2!", id: "d1", title: "t", trashed: false },
      { body: "hunter3 is not it", id: "d2", title: "t", trashed: false },
    ]);
    const replay = createSecurityRedactionReplay({
      events: harness.log,
      key: KEY,
      spread: restored.spread,
      texts: restored.world.texts,
    });

    await replay.replay();

    expect(restored.world.readable().join()).not.toContain(SHORT_SECRET);
    expect(restored.world.readable().join()).toContain("hunter3");
  });

  test("an unreadable scope alias is counted, never skipped silently", async () => {
    const { log } = eventLog();
    await log.append({
      actorAlias: "alias",
      id: "security-redaction:bad",
      occurredAt: NOW.toISOString(),
      operationId: "bad",
      replay: { digest: "ab", length: 3, salt: "cd" },
      scopeAlias: "nonsense",
      type: SECURITY_REDACTION_EVENT_TYPE,
      version: 1,
    });
    const replay = createSecurityRedactionReplay({
      events: log,
      key: KEY,
      spread: { spread: vi.fn() },
      texts: () => Promise.resolve([]),
    });
    expect(await replay.replay()).toEqual({ reapplied: 0, unreadable: 1 });
  });
});
