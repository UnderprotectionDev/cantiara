// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal is asserted in sequence against one store.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CloseToolEscapeInput,
  TOOL_ESCAPE_CLOSE_CONDITIONS,
} from "@cantiara/api/product-gaps";
import { describe, expect, test } from "vitest";

import {
  ToolEscapeAlreadyClosedError,
  ToolEscapeCloseRefusedError,
  ToolEscapeNotFoundError,
  ToolEscapeNotHighImpactError,
} from "./product-gaps";
import {
  accountId,
  createProductGapHarness,
} from "./product-gaps-memory-store";

const catalog = [
  { label: "Checkout", targetId: "p1", targetType: "Project" as const },
  {
    label: "Fix export",
    projectId: "p1",
    targetId: "w1",
    targetType: "Work" as const,
  },
  {
    label: "Pricing rule",
    projectId: "p1",
    targetId: "d1",
    targetType: "Decision" as const,
  },
  {
    label: "Old note",
    state: "trashed" as const,
    targetId: "w-trash",
    targetType: "Work" as const,
  },
];

const MIGRATIONS = [
  "0152_tool_escape_event.sql",
  "0153_high_impact_escape_close.sql",
];
const SEVERITY_COLUMN = /severity|high_impact|threshold|duration|waiting/i;

const BUILD = "build-2026-10-20";

const fixture = {
  candidate: BUILD,
  runs: {
    "run-ok": {
      build: BUILD,
      records: [
        { targetId: "w1", targetType: "Work" as const },
        { targetId: "d1", targetType: "Decision" as const },
      ],
      succeeded: true,
    },
    "run-failed": {
      build: BUILD,
      records: [{ targetId: "w1", targetType: "Work" as const }],
      succeeded: false,
    },
    "run-old-build": {
      build: "build-older",
      records: [{ targetId: "w1", targetType: "Work" as const }],
      succeeded: true,
    },
    "run-other-record": {
      build: BUILD,
      records: [{ targetId: "d1", targetType: "Decision" as const }],
      succeeded: true,
    },
  },
};

const validClose = (escapeId: string): CloseToolEscapeInput => ({
  candidate: { build: BUILD },
  escapeId,
  externalCopy: {
    how: "Spreadsheet archived and shared link revoked.",
    state: "Closed",
  },
  impact: "Lasting parallel source of truth",
  restore: {
    method: "Manual recreate",
    records: [{ targetId: "w1", targetType: "Work" }],
  },
  workflow: { runRef: "run-ok" },
});

async function setup(candidate = fixture) {
  const harness = createProductGapHarness(catalog, candidate);
  const { escape: tracked, gap } = await harness.productGaps.recordToolEscape(
    accountId,
    {
      escape: {
        intendedJob: "Keep the release plan",
        occurredAt: "2026-10-01T09:30:00.000Z",
        reasons: ["Missing capability"],
        source: { targetId: "p1", targetType: "Project" },
        tool: "Spreadsheet",
      },
      gap: { kind: "New", title: "Release plan", unmetNeed: "Plan elsewhere." },
    },
  );
  return { ...harness, tracked, gap };
}

describe("High-impact Tool Escape close", () => {
  test("accepts a close with all four conditions and shows the bound evidence", async () => {
    const { tracked, gap, productGaps } = await setup();
    const input = {
      ...validClose(tracked.id),
      restore: {
        method: "Supported import" as const,
        records: [
          { targetId: "w1", targetType: "Work" as const },
          { targetId: "d1", targetType: "Decision" as const },
        ],
      },
    };

    const closed = await productGaps.closeToolEscape(accountId, input);

    expect(closed.close).toMatchObject({
      candidateBuild: BUILD,
      escapeId: tracked.id,
      gapId: gap.id,
      impact: "Lasting parallel source of truth",
      records: [
        { label: "Fix export", state: "resolved", targetId: "w1" },
        { label: "Pricing rule", state: "resolved", targetId: "d1" },
      ],
      restoreMethod: "Supported import",
      workflowRef: "run-ok",
    });
    const listed = await productGaps.listEscapes(accountId, { gapId: gap.id });
    expect(listed[0]?.close?.externalCopyHow).toContain("Spreadsheet");
    expect(listed[0]?.intendedJob).toBe("Keep the release plan");
  });

  test.each([
    ["no candidate build", { candidate: null }, [0]],
    [
      "a candidate build that is not the current one",
      { candidate: { build: "build-older" } },
      [0],
    ],
    ["no workflow run", { workflow: null }, [0, 3]],
    ["an unknown workflow run", { workflow: { runRef: "nope" } }, [0, 3]],
    ["a failed workflow run", { workflow: { runRef: "run-failed" } }, [0]],
    ["a run on an older build", { workflow: { runRef: "run-old-build" } }, [0]],
    ["no restored records", { restore: null }, [1, 3]],
    [
      "a restored record that is in Trash",
      {
        restore: {
          method: "Manual recreate" as const,
          records: [{ targetId: "w-trash", targetType: "Work" as const }],
        },
      },
      [1, 3],
    ],
    [
      "evidence that does not name the restored record",
      { workflow: { runRef: "run-other-record" } },
      [3],
    ],
    ["no external copy statement", { externalCopy: null }, [2]],
    [
      "an external copy that is still an active parallel source",
      {
        externalCopy: {
          how: "Still in use.",
          state: "Active parallel source" as const,
        },
      },
      [2],
    ],
  ])("refuses, and writes nothing, with %s", async (_label, change, unmet) => {
    const { closes, tracked, productGaps } = await setup();

    const refusal = await productGaps
      .closeToolEscape(accountId, { ...validClose(tracked.id), ...change })
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ToolEscapeCloseRefusedError);
    expect((refusal as ToolEscapeCloseRefusedError).conditions).toEqual(
      unmet.map((index) => TOOL_ESCAPE_CLOSE_CONDITIONS[index]),
    );
    expect(closes).toEqual([]);
  });

  test("a note or an external screenshot is not a field and cannot close", async () => {
    const { tracked, productGaps } = await setup();

    await expect(
      productGaps.closeToolEscape(accountId, {
        escapeId: tracked.id,
        impact: "Canonical truth moved out",
        note: "fixed",
        screenshot: "other-tool.png",
      } as never),
    ).rejects.toThrow();
    await expect(
      productGaps.closeToolEscape(accountId, {
        escapeId: tracked.id,
        impact: "Canonical truth moved out",
      }),
    ).rejects.toMatchObject({
      conditions: [...TOOL_ESCAPE_CLOSE_CONDITIONS],
    });
  });

  test("fails closed when there is no current Product release candidate", async () => {
    const { tracked, productGaps } = await setup({
      ...fixture,
      candidate: null,
    });

    await expect(
      productGaps.closeToolEscape(accountId, validClose(tracked.id)),
    ).rejects.toBeInstanceOf(ToolEscapeCloseRefusedError);
  });

  test("Conscious boundary does not waive the four conditions", async () => {
    const { tracked, gap, productGaps } = await setup();
    await productGaps.setStatus(accountId, {
      expectedStatus: "Open",
      gapId: gap.id,
      status: "Conscious boundary",
    });

    await expect(
      productGaps.closeToolEscape(accountId, {
        escapeId: tracked.id,
        impact: "Lasting parallel source of truth",
      }),
    ).rejects.toBeInstanceOf(ToolEscapeCloseRefusedError);
    const closed = await productGaps.closeToolEscape(
      accountId,
      validClose(tracked.id),
    );
    expect(closed.close).not.toBeNull();
    expect((await productGaps.list(accountId)).gaps[0]?.status).toBe(
      "Conscious boundary",
    );
  });

  test("an escape that never held parallel truth does not use this close", async () => {
    const { closes, tracked, productGaps } = await setup();

    await expect(
      productGaps.closeToolEscape(accountId, {
        ...validClose(tracked.id),
        impact: "Never held parallel truth",
      }),
    ).rejects.toBeInstanceOf(ToolEscapeNotHighImpactError);
    expect(closes).toEqual([]);
  });

  test("refuses a second close and keeps the first", async () => {
    const { closes, tracked, productGaps } = await setup();
    await productGaps.closeToolEscape(accountId, validClose(tracked.id));

    await expect(
      productGaps.closeToolEscape(accountId, validClose(tracked.id)),
    ).rejects.toBeInstanceOf(ToolEscapeAlreadyClosedError);
    expect(closes).toHaveLength(1);
  });

  test("an unknown escape is not found", async () => {
    const { productGaps } = await setup();

    await expect(
      productGaps.closeToolEscape(accountId, validClose("missing")),
    ).rejects.toBeInstanceOf(ToolEscapeNotFoundError);
  });

  test("closing appends a record and leaves the event, the count and the Gap unchanged", async () => {
    const { tracked, escapes, gap, productGaps } = await setup();
    const before = structuredClone(escapes);

    await productGaps.closeToolEscape(accountId, validClose(tracked.id));

    expect(escapes).toEqual(before);
    const listed = await productGaps.list(accountId);
    expect(listed.gaps[0]).toMatchObject({
      escapeCount: 1,
      id: gap.id,
      status: "Open",
    });
  });

  test("no count, time or severity closes an escape or is stored", async () => {
    const { tracked, productGaps } = await setup();
    for (let index = 0; index < 5; index += 1) {
      await productGaps.recordToolEscape(accountId, {
        escape: {
          intendedJob: "Again",
          occurredAt: "2020-01-01T00:00:00.000Z",
          reasons: ["Habit"],
          source: { targetId: "p1", targetType: "Project" },
          tool: "Spreadsheet",
        },
        gap: { gapId: tracked.gapId, kind: "Existing" },
      });
    }

    const listed = await productGaps.listEscapes(accountId, {
      gapId: tracked.gapId,
    });
    expect(listed).toHaveLength(6);
    expect(listed.every((event) => event.close === null)).toBe(true);
    expect(Object.keys(listed[0] ?? {})).not.toContain("severity");
    // The migrations are the stored shape: no severity-like column anywhere.
    const migrations = MIGRATIONS.map((name) =>
      readFileSync(
        join(
          import.meta.dirname,
          "../../../../../../packages/db/src/migrations",
          name,
        ),
        "utf8",
      ),
    ).join("\n");
    expect(migrations).not.toMatch(SEVERITY_COLUMN);
  });
});
