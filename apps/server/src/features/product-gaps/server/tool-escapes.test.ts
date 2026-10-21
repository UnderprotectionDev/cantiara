// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal is asserted in sequence against one store.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type RecordToolEscapeInput,
  TOOL_ESCAPE_REASON_PRD_VALUES,
  TOOL_ESCAPE_REASONS,
} from "@cantiara/api/product-gaps";
import { describe, expect, test } from "vitest";

import { ProductGapNotFoundError, ToolEscapeSourceError } from "./product-gaps";
import {
  accountId,
  createProductGapHarness,
} from "./product-gaps-memory-store";

const FORBIDDEN_IMPORT =
  /from "[^"]*(github|handoff|external-execution)[^"]*"/i;

const catalog = [
  { label: "Checkout", targetId: "p1", targetType: "Project" as const },
  { label: "Billing", targetId: "p2", targetType: "Project" as const },
  {
    label: "Fix export",
    projectId: "p1",
    targetId: "w1",
    targetType: "Work" as const,
  },
  {
    label: "Old note",
    state: "trashed" as const,
    targetId: "w-trash",
    targetType: "Work" as const,
  },
];

const newGap = {
  kind: "New" as const,
  title: "Bulk edit across projects",
  unmetNeed: "I edit many Works in another tool.",
};

const baseEscape: RecordToolEscapeInput["escape"] = {
  intendedJob: "Bulk rename forty Works",
  occurredAt: "2026-10-01T09:30:00.000Z",
  reasons: ["Missing capability"],
  source: { targetId: "p1", targetType: "Project" },
  tool: "Spreadsheet",
};

function input(
  overrides: Partial<RecordToolEscapeInput> = {},
): RecordToolEscapeInput {
  return { escape: baseEscape, gap: newGap, ...overrides };
}

function setup() {
  return createProductGapHarness(catalog);
}

describe("Tool Escape event", () => {
  test("Record Product Gap writes a new Gap and a dated event with every field", async () => {
    const { productGaps } = setup();

    const { gap, escape: event } = await productGaps.recordToolEscape(
      accountId,
      input({
        escape: {
          ...baseEscape,
          note: "Needed a sort of its own.",
          reasons: ["Missing capability", "Faster"],
          source: { targetId: "w1", targetType: "Work" },
        },
      }),
    );

    expect(gap).toMatchObject({ escapeCount: 1, status: "Open" });
    expect(event).toMatchObject({
      gapId: gap.id,
      intendedJob: "Bulk rename forty Works",
      note: "Needed a sort of its own.",
      occurredAt: "2026-10-01T09:30:00.000Z",
      reasons: ["Missing capability", "Faster"],
      source: {
        label: "Fix export",
        projectId: "p1",
        state: "resolved",
        targetId: "w1",
        targetType: "Work",
      },
      tool: "Spreadsheet",
    });
    expect(Date.parse(event.recordedAt)).not.toBeNaN();
  });

  test("keeps the closed reasons and maps them to the PRD values", () => {
    expect([...TOOL_ESCAPE_REASONS]).toEqual([
      "Missing capability",
      "Faster",
      "More reliable",
      "Usability",
      "Habit",
    ]);
    expect(TOOL_ESCAPE_REASON_PRD_VALUES).toMatchObject({
      Habit: "Alışkanlık",
      "Missing capability": "Eksik yetenek",
    });
  });

  test("requires the source, job, tool and one or more closed reasons", async () => {
    const { productGaps, gaps, escapes } = setup();
    const bad: Record<string, unknown>[] = [
      { reasons: [] },
      { reasons: ["Cheaper"] },
      { tool: " " },
      { intendedJob: "" },
      { occurredAt: "yesterday" },
      { source: undefined },
    ];
    for (const patch of bad) {
      await expect(
        productGaps.recordToolEscape(
          accountId,
          input({ escape: { ...baseEscape, ...patch } as never }),
        ),
      ).rejects.toThrow();
    }
    expect(gaps.size).toBe(0);
    expect(escapes).toHaveLength(0);
  });

  test("stores no content, session, severity or High-impact field", async () => {
    const { productGaps, escapes } = setup();
    for (const extra of [
      { severity: "High" },
      { highImpact: true },
      { "High-impact": true },
      { content: "copied text" },
      { sessionUrl: "https://example.test/s/1" },
      { repeatCount: 3 },
    ]) {
      await expect(
        productGaps.recordToolEscape(
          accountId,
          input({ escape: { ...baseEscape, ...extra } as never }),
        ),
      ).rejects.toThrow();
    }
    const { escape: event } = await productGaps.recordToolEscape(
      accountId,
      input(),
    );
    expect(Object.keys(event).sort()).toEqual([
      "gapId",
      "id",
      "intendedJob",
      "note",
      "occurredAt",
      "reasons",
      "recordedAt",
      "source",
      "tool",
    ]);
    expect(escapes).toHaveLength(1);
  });

  test("refuses an unavailable source or Gap without writing anything", async () => {
    const { productGaps, gaps, escapes } = setup();

    await expect(
      productGaps.recordToolEscape(
        accountId,
        input({
          escape: {
            ...baseEscape,
            source: { targetId: "w-trash", targetType: "Work" },
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ToolEscapeSourceError);
    await expect(
      productGaps.recordToolEscape(
        accountId,
        input({ gap: { gapId: "missing", kind: "Existing" } }),
      ),
    ).rejects.toBeInstanceOf(ProductGapNotFoundError);
    expect(gaps.size).toBe(0);
    expect(escapes).toHaveLength(0);
  });
});

describe("new Gap or existing Gap is a deliberate choice", () => {
  test("attaches to the Gap the founder names and creates no second Gap", async () => {
    const { productGaps, gaps } = setup();
    const first = await productGaps.recordToolEscape(accountId, input());

    const second = await productGaps.recordToolEscape(
      accountId,
      input({ gap: { gapId: first.gap.id, kind: "Existing" } }),
    );

    expect(second.gap).toMatchObject({ escapeCount: 2, id: first.gap.id });
    expect(gaps.size).toBe(1);
  });

  test("never merges by title: the same title opens a separate Gap", async () => {
    const { productGaps, gaps } = setup();

    const first = await productGaps.recordToolEscape(accountId, input());
    const same = await productGaps.recordToolEscape(accountId, input());
    const similar = await productGaps.recordToolEscape(
      accountId,
      input({ gap: { ...newGap, title: "bulk edit across projects " } }),
    );

    expect(new Set([first.gap.id, same.gap.id, similar.gap.id]).size).toBe(3);
    expect(gaps.size).toBe(3);
    for (const { gap } of [first, same, similar]) {
      expect(gap.escapeCount).toBe(1);
    }
  });

  test("a status change leaves recorded events untouched and writes no other record", async () => {
    const { productGaps, escapes, writes } = setup();
    const { gap } = await productGaps.recordToolEscape(accountId, input());
    const before = structuredClone(escapes);

    await productGaps.setStatus(accountId, {
      expectedStatus: "Open",
      gapId: gap.id,
      status: "Conscious boundary",
    });

    expect(escapes).toEqual(before);
    expect(writes).toEqual([]);
  });
});

describe("repeat count", () => {
  test("is derived from recorded events and opens that exact set", async () => {
    const { productGaps } = setup();
    const first = await productGaps.recordToolEscape(accountId, input());
    const ids = [first.escape.id];
    for (const occurredAt of [
      "2026-10-02T09:00:00.000Z",
      "2026-10-03T09:00:00.000Z",
    ]) {
      const next = await productGaps.recordToolEscape(
        accountId,
        input({
          escape: { ...baseEscape, occurredAt, reasons: ["Habit"] },
          gap: { gapId: first.gap.id, kind: "Existing" },
        }),
      );
      ids.push(next.escape.id);
    }
    await productGaps.recordToolEscape(accountId, input());

    const [listed] = (await productGaps.list(accountId)).gaps.filter(
      ({ id }) => id === first.gap.id,
    );
    const opened = await productGaps.listEscapes(accountId, {
      gapId: first.gap.id,
    });

    expect(listed?.escapeCount).toBe(3);
    expect(opened.map(({ id }) => id).sort()).toEqual([...ids].sort());
    expect(opened.map(({ occurredAt }) => occurredAt)).toEqual([
      "2026-10-03T09:00:00.000Z",
      "2026-10-02T09:00:00.000Z",
      "2026-10-01T09:30:00.000Z",
    ]);
  });

  test("does not rank, score, change status or write any other record", async () => {
    const { productGaps, writes } = setup();
    const quiet = await productGaps.recordToolEscape(accountId, input());
    const busy = await productGaps.recordToolEscape(accountId, input());
    const orderBefore = (await productGaps.list(accountId)).gaps.map(
      ({ id }) => id,
    );
    for (let index = 0; index < 4; index += 1) {
      await productGaps.recordToolEscape(
        accountId,
        input({ gap: { gapId: busy.gap.id, kind: "Existing" } }),
      );
    }

    const { gaps } = await productGaps.list(accountId);

    // The order stays the order of recording: events never move a Gap.
    expect(gaps.map(({ id }) => id)).toEqual(orderBefore);
    expect(gaps).toHaveLength(2);
    expect(gaps.map(({ id }) => id).sort()).toEqual(
      [busy.gap.id, quiet.gap.id].sort(),
    );
    expect(gaps.find(({ id }) => id === busy.gap.id)).toMatchObject({
      escapeCount: 5,
      status: "Open",
    });
    expect(Object.keys(gaps[0] ?? {})).not.toEqual(
      expect.arrayContaining(["priority", "score", "rank"]),
    );
    expect(writes).toEqual([]);
  });
});

describe("dogfooding summary filters", () => {
  async function seed() {
    const harness = setup();
    const { productGaps } = harness;
    const a = await productGaps.recordToolEscape(
      accountId,
      input({
        escape: { ...baseEscape, reasons: ["Faster"], tool: "Spreadsheet" },
      }),
    );
    const b = await productGaps.recordToolEscape(
      accountId,
      input({
        escape: {
          ...baseEscape,
          reasons: ["Usability", "Habit"],
          source: { targetId: "p2", targetType: "Project" },
          tool: "Notes App",
        },
        gap: { ...newGap, title: "Other gap" },
      }),
    );
    await productGaps.recordToolEscape(
      accountId,
      input({
        escape: {
          ...baseEscape,
          reasons: ["Habit"],
          source: { targetId: "w1", targetType: "Work" },
          tool: "notes app",
        },
        gap: { gapId: b.gap.id, kind: "Existing" },
      }),
    );
    await productGaps.setStatus(accountId, {
      expectedStatus: "Open",
      gapId: a.gap.id,
      status: "Evaluating",
    });
    return { ...harness, a: a.gap.id, b: b.gap.id };
  }

  test("filters by tool (case-insensitive), reason, project and status", async () => {
    const { productGaps, a, b } = await seed();
    const ids = async (filter: Parameters<typeof productGaps.list>[1]) =>
      (await productGaps.list(accountId, filter)).gaps.map(({ id }) => id);

    expect(await ids({ tool: "NOTES APP" })).toEqual([b]);
    expect(await ids({ reason: "Faster" })).toEqual([a]);
    expect(await ids({ reason: "Habit" })).toEqual([b]);
    expect((await ids({ projectId: "p1" })).sort()).toEqual([a, b].sort());
    expect(await ids({ projectId: "p2" })).toEqual([b]);
    expect(await ids({ status: "Evaluating" })).toEqual([a]);
    expect(await ids({ status: "Met" })).toEqual([]);
    expect(await ids({ projectId: "p1", tool: "Notes App" })).toEqual([b]);
    expect((await ids(undefined)).sort()).toEqual([a, b].sort());
  });

  test("a filtered count equals the exact event set the same filter opens", async () => {
    const { productGaps, b } = await seed();

    const { gaps, tools } = await productGaps.list(accountId, {
      projectId: "p1",
      tool: "Notes App",
    });
    const opened = await productGaps.listEscapes(accountId, {
      gapId: b,
      projectId: "p1",
      tool: "Notes App",
    });

    expect(gaps[0]?.escapeCount).toBe(1);
    expect(opened).toHaveLength(1);
    expect(tools.map((tool) => tool.toLowerCase())).toEqual([
      "notes app",
      "spreadsheet",
    ]);
    await expect(
      productGaps.list(accountId, { rank: "count" } as never),
    ).rejects.toThrow();
  });
});

describe("a Tool Escape is not a GitHub, Test Handoff or External Execution write", () => {
  test("the escape path writes no record other than the Gap and its event", async () => {
    const { productGaps, writes, catalog: owners } = setup();
    const owned = JSON.stringify([...owners.entries()]);

    await productGaps.recordToolEscape(accountId, input());

    expect(writes).toEqual([]);
    expect(JSON.stringify([...owners.entries()])).toBe(owned);
  });

  test("the module imports none of the GitHub, Test Handoff or External Execution seams", () => {
    const files = [
      ...readdirSync(import.meta.dirname)
        .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
        .map((name) => join(import.meta.dirname, name)),
      join(
        import.meta.dirname,
        "../../../../../../packages/api/src/product-gaps.ts",
      ),
    ];
    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toMatch(FORBIDDEN_IMPORT);
    }
  });
});
