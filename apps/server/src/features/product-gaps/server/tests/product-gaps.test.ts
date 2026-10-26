// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal and status pair is asserted in sequence against one store.
// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal is asserted in sequence against one store.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CloseToolEscapeInput,
  PRODUCT_GAP_STATUS_PRD_VALUES,
  PRODUCT_GAP_STATUSES,
  type RecordToolEscapeInput,
  TOOL_ESCAPE_CLOSE_CONDITIONS,
  TOOL_ESCAPE_REASON_PRD_VALUES,
  TOOL_ESCAPE_REASONS,
} from "@cantiara/api/product-gaps";
import { describe, expect, test } from "vitest";
import {
  ProductGapFollowUpStaleError,
  ProductGapFollowUpTargetError,
  ProductGapLinkTargetError,
  ProductGapNotFoundError,
  ProductGapProjectReadOnlyError,
  ProductGapStatusConflictError,
  ProductGapWorkspaceNotFoundError,
  ToolEscapeAlreadyClosedError,
  ToolEscapeCloseRefusedError,
  ToolEscapeNotFoundError,
  ToolEscapeSourceError,
} from "../product-gaps";
import {
  accountId,
  createProductGapHarness,
  type ProductGapCloseFixture,
} from "./product-gaps-memory-store";

const catalog = [
  { label: "Checkout", targetId: "p1", targetType: "Project" as const },
  {
    label: "Old import",
    readOnly: true,
    targetId: "p-archived",
    targetType: "Project" as const,
  },
  { label: "Fix export", targetId: "w1", targetType: "Work" as const },
  { label: "Offline mode", targetId: "f1", targetType: "Feature" as const },
  { label: "Use CSV", targetId: "d1", targetType: "Decision" as const },
  {
    label: "Gone feature",
    state: "trashed" as const,
    targetId: "f-trash",
    targetType: "Feature" as const,
  },
];

const gapFixture = {
  title: "Bulk edit across projects",
  unmetNeed: "I edit many Works in another tool.",
};

function setup() {
  const harness = createProductGapHarness(catalog);
  return { ...harness };
}

describe("Record Product Gap", () => {
  test("writes an Open Workspace Product Gap with scope and related records", async () => {
    const { productGaps } = setup();

    const created = await productGaps.record(accountId, {
      ...gapFixture,
      links: [
        { targetId: "p1", targetType: "Project" },
        { targetId: "w1", targetType: "Work" },
        { targetId: "f1", targetType: "Feature" },
        { targetId: "d1", targetType: "Decision" },
      ],
      scope: "Only board view.",
    });

    expect(created).toMatchObject({
      scope: "Only board view.",
      status: "Open",
      title: gapFixture.title,
      unmetNeed: gapFixture.unmetNeed,
    });
    expect(created.links.map(({ label, kind }) => [label, kind])).toEqual([
      ["Checkout", "Related"],
      ["Fix export", "Related"],
      ["Offline mode", "Related"],
      ["Use CSV", "Related"],
    ]);
    expect((await productGaps.list(accountId)).gaps).toHaveLength(1);
  });

  test("requires a title and the unmet need, and refuses count, priority or Work fields", async () => {
    const { productGaps } = setup();

    await expect(
      productGaps.record(accountId, { ...gapFixture, title: "  " }),
    ).rejects.toThrow();
    await expect(
      productGaps.record(accountId, { ...gapFixture, unmetNeed: "" }),
    ).rejects.toThrow();
    for (const extra of [
      { repeatCount: 3 },
      { priority: "High" },
      { workId: "w1" },
      { status: "Met" },
      { projectId: "p1" },
    ]) {
      await expect(
        productGaps.record(accountId, { ...gapFixture, ...extra } as never),
      ).rejects.toThrow();
    }
  });

  test("refuses a link to a missing, trashed or repeated record without writing", async () => {
    const { productGaps, gaps } = setup();

    await expect(
      productGaps.record(accountId, {
        ...gapFixture,
        links: [{ targetId: "nope", targetType: "Work" }],
      }),
    ).rejects.toBeInstanceOf(ProductGapLinkTargetError);
    await expect(
      productGaps.record(accountId, {
        ...gapFixture,
        links: [{ targetId: "f-trash", targetType: "Feature" }],
      }),
    ).rejects.toBeInstanceOf(ProductGapLinkTargetError);
    await expect(
      productGaps.record(accountId, {
        ...gapFixture,
        links: [
          { targetId: "w1", targetType: "Work" },
          { targetId: "w1", targetType: "Work" },
        ],
      }),
    ).rejects.toBeInstanceOf(ProductGapLinkTargetError);
    expect(gaps.size).toBe(0);
  });

  test("never merges similar titles: each record is its own Gap", async () => {
    const { productGaps, gaps } = setup();

    const first = await productGaps.record(accountId, gapFixture);
    const same = await productGaps.record(accountId, gapFixture);
    const similar = await productGaps.record(accountId, {
      ...gapFixture,
      title: "bulk edit across projects ",
    });

    expect(new Set([first.id, same.id, similar.id]).size).toBe(3);
    expect(gaps.size).toBe(3);
    expect((await productGaps.list(accountId)).gaps).toHaveLength(3);
  });

  test("is refused without a Workspace", async () => {
    const { productGaps } = setup();

    await expect(
      productGaps.record("someone-else", gapFixture),
    ).rejects.toBeInstanceOf(ProductGapWorkspaceNotFoundError);
    await expect(productGaps.list("someone-else")).rejects.toBeInstanceOf(
      ProductGapWorkspaceNotFoundError,
    );
  });

  test("reads a link that later goes away as broken and keeps the Gap", async () => {
    const { productGaps, catalog: owners } = setup();
    const created = await productGaps.record(accountId, {
      ...gapFixture,
      links: [{ targetId: "w1", targetType: "Work" }],
    });

    const work = owners.get("Work:w1");
    if (work) {
      work.state = "trashed";
    }
    const [listed] = (await productGaps.list(accountId)).gaps;

    expect(listed?.id).toBe(created.id);
    expect(listed?.links[0]).toMatchObject({
      brokenReason: "In Trash",
      label: null,
      state: "broken",
    });
  });
});

describe("Product Gap status matrix", () => {
  test("keeps the closed catalog and maps it to the PRD values", () => {
    expect([...PRODUCT_GAP_STATUSES]).toEqual([
      "Open",
      "Evaluating",
      "Met",
      "Conscious boundary",
    ]);
    expect(PRODUCT_GAP_STATUS_PRD_VALUES).toEqual({
      "Conscious boundary": "Bilinçli sınır",
      Evaluating: "Değerlendiriliyor",
      Met: "Karşılandı",
      Open: "Açık",
    });
  });

  test("lets the founder move between every pair of statuses", async () => {
    const { productGaps } = setup();
    for (const from of PRODUCT_GAP_STATUSES) {
      for (const to of PRODUCT_GAP_STATUSES) {
        const created = await productGaps.record(accountId, gapFixture);
        await productGaps.setStatus(accountId, {
          expectedStatus: "Open",
          gapId: created.id,
          status: from,
        });

        const moved = await productGaps.setStatus(accountId, {
          expectedStatus: from,
          gapId: created.id,
          status: to,
        });

        expect(moved.status).toBe(to);
      }
    }
  });

  test("refuses a value outside the catalog, an extra key and a stale view", async () => {
    const { productGaps } = setup();
    const created = await productGaps.record(accountId, gapFixture);

    await expect(
      productGaps.setStatus(accountId, {
        expectedStatus: "Open",
        gapId: created.id,
        status: "Won't fix" as never,
      }),
    ).rejects.toThrow();
    await expect(
      productGaps.setStatus(accountId, {
        expectedStatus: "Open",
        gapId: created.id,
        repeatCount: 5,
        status: "Met",
      } as never),
    ).rejects.toThrow();
    await productGaps.setStatus(accountId, {
      expectedStatus: "Open",
      gapId: created.id,
      status: "Evaluating",
    });
    await expect(
      productGaps.setStatus(accountId, {
        expectedStatus: "Open",
        gapId: created.id,
        status: "Met",
      }),
    ).rejects.toBeInstanceOf(ProductGapStatusConflictError);
    await expect(
      productGaps.setStatus(accountId, {
        expectedStatus: "Open",
        gapId: "missing",
        status: "Met",
      }),
    ).rejects.toBeInstanceOf(ProductGapNotFoundError);
  });

  test("changing status writes the Gap alone and leaves every linked record as it was", async () => {
    const { productGaps, catalog: owners, writes } = setup();
    const created = await productGaps.record(accountId, {
      ...gapFixture,
      links: [
        { targetId: "p1", targetType: "Project" },
        { targetId: "w1", targetType: "Work" },
        { targetId: "f1", targetType: "Feature" },
        { targetId: "d1", targetType: "Decision" },
      ],
    });
    const before = structuredClone([...owners.entries()]);

    const met = await productGaps.setStatus(accountId, {
      expectedStatus: "Open",
      gapId: created.id,
      status: "Met",
    });
    const bounded = await productGaps.setStatus(accountId, {
      expectedStatus: "Met",
      gapId: created.id,
      status: "Conscious boundary",
    });

    expect(met.links).toEqual(created.links);
    expect(bounded.links).toEqual(created.links);
    expect(met.createdAt).toBe(created.createdAt);
    expect([...owners.entries()]).toEqual(before);
    expect(writes).toEqual([]);
  });
});

describe("Product Gap follow-up", () => {
  const workConfirmation = (
    plan: Awaited<
      ReturnType<ReturnType<typeof setup>["productGaps"]["previewFollowUp"]>
    >,
    gapId: string,
    key = "key-1",
  ) => ({
    baseRevision: 0,
    clientIdempotencyKey: key,
    gapId,
    id: "link-1",
    plan,
    workId: "work-new",
  });

  test("a Gap is not a Work and never converts by itself", async () => {
    const { productGaps, catalog: owners, writes } = setup();
    const created = await productGaps.record(accountId, gapFixture);
    await productGaps.setStatus(accountId, {
      expectedStatus: "Open",
      gapId: created.id,
      status: "Evaluating",
    });
    await productGaps.previewFollowUp(accountId, {
      gapId: created.id,
      kind: "Work",
      projectId: "p1",
    });

    expect(writes).toEqual([]);
    expect([...owners.keys()].filter((id) => id.startsWith("Work:"))).toEqual([
      "Work:w1",
    ]);
    expect((await productGaps.list(accountId)).gaps[0]?.links).toEqual([]);
  });

  test("previews exactly one Work with title, body, target Project and relation, writing nothing", async () => {
    const { productGaps, writes } = setup();
    const created = await productGaps.record(accountId, {
      ...gapFixture,
      scope: "Board only.",
    });

    const plan = await productGaps.previewFollowUp(accountId, {
      gapId: created.id,
      kind: "Work",
      projectId: "p1",
      workType: "Research",
    });

    expect(plan).toEqual({
      gapId: created.id,
      kind: "Work",
      recordCount: 1,
      relation: "Follow-up",
      targetProject: { id: "p1", name: "Checkout" },
      work: {
        description: `${gapFixture.unmetNeed}\n\nScope: Board only.`,
        title: gapFixture.title,
        type: "Research",
      },
    });
    expect(writes).toEqual([]);
  });

  test("confirms the exact plan once: one Work, one Follow-up link, retry is the same result", async () => {
    const { productGaps, catalog: owners, writes } = setup();
    const created = await productGaps.record(accountId, gapFixture);
    const plan = await productGaps.previewFollowUp(accountId, {
      gapId: created.id,
      kind: "Work",
      projectId: "p1",
    });

    const first = await productGaps.confirmFollowUp(
      accountId,
      workConfirmation(plan, created.id),
    );
    const retry = await productGaps.confirmFollowUp(
      accountId,
      workConfirmation(plan, created.id),
    );

    expect(first.followUp).toMatchObject({ workId: "work-new" });
    expect(first.gap.status).toBe("Open");
    expect(first.gap.links).toMatchObject([
      { kind: "Follow-up", label: gapFixture.title, targetType: "Work" },
    ]);
    expect(retry.followUp.workKey).toBe(first.followUp.workKey);
    expect(writes).toEqual(["create Work"]);
    expect(owners.has("Work:work-new")).toBe(true);
  });

  test("relates an existing Feature only after preview and writes no Work", async () => {
    const { productGaps, writes } = setup();
    const created = await productGaps.record(accountId, gapFixture);
    const plan = await productGaps.previewFollowUp(accountId, {
      featureId: "f1",
      gapId: created.id,
      kind: "Feature relation",
    });

    expect(plan).toMatchObject({
      feature: { id: "f1", label: "Offline mode" },
      kind: "Feature relation",
      recordCount: 0,
    });
    expect((await productGaps.list(accountId)).gaps[0]?.links).toEqual([]);

    const confirmed = await productGaps.confirmFollowUp(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "key-feature",
      gapId: created.id,
      id: "link-feature",
      plan,
    });

    expect(confirmed.gap.links).toMatchObject([
      { kind: "Follow-up", label: "Offline mode", targetType: "Feature" },
    ]);
    expect(confirmed.followUp).toEqual({
      linkId: "link-feature",
      workId: null,
      workKey: null,
    });
    expect(writes).toEqual([]);
  });

  test("refuses a plan that is not the previewed one, an unavailable target and an archived Project", async () => {
    const { productGaps } = setup();
    const created = await productGaps.record(accountId, gapFixture);
    const plan = await productGaps.previewFollowUp(accountId, {
      gapId: created.id,
      kind: "Work",
      projectId: "p1",
    });

    await expect(
      productGaps.confirmFollowUp(
        accountId,
        workConfirmation(
          plan.kind === "Work"
            ? { ...plan, work: { ...plan.work, title: "Edited" } }
            : plan,
          created.id,
        ),
      ),
    ).rejects.toBeInstanceOf(ProductGapFollowUpStaleError);
    await expect(
      productGaps.confirmFollowUp(accountId, {
        ...workConfirmation(plan, created.id),
        workId: undefined,
      }),
    ).rejects.toThrow();
    await expect(
      productGaps.previewFollowUp(accountId, {
        gapId: created.id,
        kind: "Work",
        projectId: "nope",
      }),
    ).rejects.toBeInstanceOf(ProductGapFollowUpTargetError);
    await expect(
      productGaps.previewFollowUp(accountId, {
        featureId: "f-trash",
        gapId: created.id,
        kind: "Feature relation",
      }),
    ).rejects.toBeInstanceOf(ProductGapFollowUpTargetError);
    await expect(
      productGaps.previewFollowUp(accountId, {
        gapId: created.id,
        kind: "Work",
        projectId: "p-archived",
      }),
    ).rejects.toBeInstanceOf(ProductGapProjectReadOnlyError);
    await expect(
      productGaps.previewFollowUp(accountId, {
        gapId: "missing",
        kind: "Work",
        projectId: "p1",
      }),
    ).rejects.toBeInstanceOf(ProductGapNotFoundError);
  });

  test("does not offer Bug or Feature as a converted Work type", async () => {
    const { productGaps } = setup();
    const created = await productGaps.record(accountId, gapFixture);

    for (const workType of ["Bug", "Feature"]) {
      await expect(
        productGaps.previewFollowUp(accountId, {
          gapId: created.id,
          kind: "Work",
          projectId: "p1",
          workType: workType as never,
        }),
      ).rejects.toThrow();
    }
  });
});

describe("Product Gaps stay free of telemetry", () => {
  test("the access offers no observation, count, ranking or auto-convert operation", () => {
    const { productGaps } = setup();

    expect(Object.keys(productGaps).sort()).toEqual([
      "closeToolEscape",
      "confirmFollowUp",
      "linkTargets",
      "list",
      "listEscapes",
      "previewFollowUp",
      "record",
      "recordToolEscape",
      "setStatus",
    ]);
  });

  test("link targets list only visible Workspace records of the chosen family", async () => {
    const { productGaps } = setup();

    expect(
      await productGaps.linkTargets(accountId, { targetType: "Feature" }),
    ).toEqual([
      { label: "Offline mode", targetId: "f1", targetType: "Feature" },
    ]);
  });
});

const catalogEscapeClose = [
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
  "0154_tool_escape_close_never_held.sql",
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

async function setupEscapeClose(candidate: ProductGapCloseFixture = fixture) {
  const harness = createProductGapHarness(catalogEscapeClose, candidate);
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
    const { tracked, gap, productGaps } = await setupEscapeClose();
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
    const { closes, tracked, productGaps } = await setupEscapeClose();

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
    const { tracked, productGaps } = await setupEscapeClose();

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
    const { tracked, productGaps } = await setupEscapeClose({
      ...fixture,
      candidate: null,
    });

    await expect(
      productGaps.closeToolEscape(accountId, validClose(tracked.id)),
    ).rejects.toBeInstanceOf(ToolEscapeCloseRefusedError);
  });

  test("Conscious boundary does not waive the four conditions", async () => {
    const { tracked, gap, productGaps } = await setupEscapeClose();
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

  test("a `Never held parallel truth` close is its own close without the four conditions", async () => {
    const { closes, tracked, productGaps } = await setupEscapeClose();

    const closed = await productGaps.closeToolEscape(accountId, {
      escapeId: tracked.id,
      impact: "Never held parallel truth",
    });

    expect(closed.close).toMatchObject({
      candidateBuild: null,
      escapeId: tracked.id,
      externalCopyHow: null,
      impact: "Never held parallel truth",
      records: [],
      restoreMethod: null,
      workflowRef: null,
    });
    expect(closes).toHaveLength(1);
    expect(tracked.tool).toBe("Spreadsheet");
    expect(
      (await productGaps.listEscapes(accountId, { gapId: tracked.gapId }))[0]
        ?.close?.impact,
    ).toBe("Never held parallel truth");

    await expect(
      productGaps.closeToolEscape(accountId, {
        escapeId: tracked.id,
        impact: "Never held parallel truth",
      }),
    ).rejects.toBeInstanceOf(ToolEscapeAlreadyClosedError);
    expect(closes).toHaveLength(1);
  });

  test("a close whose escape never held parallel truth carries no proof fields", async () => {
    const { closes, tracked, productGaps } = await setupEscapeClose();

    await expect(
      productGaps.closeToolEscape(accountId, {
        ...validClose(tracked.id),
        impact: "Never held parallel truth",
      }),
    ).rejects.toThrow();
    expect(closes).toEqual([]);
  });

  test("refuses a second close and keeps the first", async () => {
    const { closes, tracked, productGaps } = await setupEscapeClose();
    await productGaps.closeToolEscape(accountId, validClose(tracked.id));

    await expect(
      productGaps.closeToolEscape(accountId, validClose(tracked.id)),
    ).rejects.toBeInstanceOf(ToolEscapeAlreadyClosedError);
    expect(closes).toHaveLength(1);
  });

  test("an unknown escape is not found", async () => {
    const { productGaps } = await setupEscapeClose();

    await expect(
      productGaps.closeToolEscape(accountId, validClose("missing")),
    ).rejects.toBeInstanceOf(ToolEscapeNotFoundError);
  });

  test("closing appends a record and leaves the event, the count and the Gap unchanged", async () => {
    const { tracked, escapes, gap, productGaps } = await setupEscapeClose();
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
    const { tracked, productGaps } = await setupEscapeClose();
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
          "../../../../../../../packages/db/src/migrations",
          name,
        ),
        "utf8",
      ),
    ).join("\n");
    expect(migrations).not.toMatch(SEVERITY_COLUMN);
  });
});

const FORBIDDEN_IMPORT =
  /from "[^"]*(github|handoff|external-execution)[^"]*"/i;

const catalogToolEscapes = [
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

function inputFixture(
  overrides: Partial<RecordToolEscapeInput> = {},
): RecordToolEscapeInput {
  return { escape: baseEscape, gap: newGap, ...overrides };
}

function setupToolEscapes() {
  return createProductGapHarness(catalogToolEscapes);
}

describe("Tool Escape event", () => {
  test("Record Product Gap writes a new Gap and a dated event with every field", async () => {
    const { productGaps } = setupToolEscapes();

    const { gap, escape: event } = await productGaps.recordToolEscape(
      accountId,
      inputFixture({
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
    const { productGaps, gaps, escapes } = setupToolEscapes();
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
          inputFixture({ escape: { ...baseEscape, ...patch } as never }),
        ),
      ).rejects.toThrow();
    }
    expect(gaps.size).toBe(0);
    expect(escapes).toHaveLength(0);
  });

  test("stores no content, session, severity or High-impact field", async () => {
    const { productGaps, escapes } = setupToolEscapes();
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
          inputFixture({ escape: { ...baseEscape, ...extra } as never }),
        ),
      ).rejects.toThrow();
    }
    const { escape: event } = await productGaps.recordToolEscape(
      accountId,
      inputFixture(),
    );
    expect(Object.keys(event).sort()).toEqual([
      "close",
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
    const { productGaps, gaps, escapes } = setupToolEscapes();

    await expect(
      productGaps.recordToolEscape(
        accountId,
        inputFixture({
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
        inputFixture({ gap: { gapId: "missing", kind: "Existing" } }),
      ),
    ).rejects.toBeInstanceOf(ProductGapNotFoundError);
    expect(gaps.size).toBe(0);
    expect(escapes).toHaveLength(0);
  });
});

describe("new Gap or existing Gap is a deliberate choice", () => {
  test("attaches to the Gap the founder names and creates no second Gap", async () => {
    const { productGaps, gaps } = setupToolEscapes();
    const first = await productGaps.recordToolEscape(accountId, inputFixture());

    const second = await productGaps.recordToolEscape(
      accountId,
      inputFixture({ gap: { gapId: first.gap.id, kind: "Existing" } }),
    );

    expect(second.gap).toMatchObject({ escapeCount: 2, id: first.gap.id });
    expect(gaps.size).toBe(1);
  });

  test("never merges by title: the same title opens a separate Gap", async () => {
    const { productGaps, gaps } = setupToolEscapes();

    const first = await productGaps.recordToolEscape(accountId, inputFixture());
    const same = await productGaps.recordToolEscape(accountId, inputFixture());
    const similar = await productGaps.recordToolEscape(
      accountId,
      inputFixture({ gap: { ...newGap, title: "bulk edit across projects " } }),
    );

    expect(new Set([first.gap.id, same.gap.id, similar.gap.id]).size).toBe(3);
    expect(gaps.size).toBe(3);
    for (const { gap } of [first, same, similar]) {
      expect(gap.escapeCount).toBe(1);
    }
  });

  test("a status change leaves recorded events untouched and writes no other record", async () => {
    const { productGaps, escapes, writes } = setupToolEscapes();
    const { gap } = await productGaps.recordToolEscape(
      accountId,
      inputFixture(),
    );
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
    const { productGaps } = setupToolEscapes();
    const first = await productGaps.recordToolEscape(accountId, inputFixture());
    const ids = [first.escape.id];
    for (const occurredAt of [
      "2026-10-02T09:00:00.000Z",
      "2026-10-03T09:00:00.000Z",
    ]) {
      const next = await productGaps.recordToolEscape(
        accountId,
        inputFixture({
          escape: { ...baseEscape, occurredAt, reasons: ["Habit"] },
          gap: { gapId: first.gap.id, kind: "Existing" },
        }),
      );
      ids.push(next.escape.id);
    }
    await productGaps.recordToolEscape(accountId, inputFixture());

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
    const { productGaps, writes } = setupToolEscapes();
    const quiet = await productGaps.recordToolEscape(accountId, inputFixture());
    const busy = await productGaps.recordToolEscape(accountId, inputFixture());
    const orderBefore = (await productGaps.list(accountId)).gaps.map(
      ({ id }) => id,
    );
    for (let index = 0; index < 4; index += 1) {
      await productGaps.recordToolEscape(
        accountId,
        inputFixture({ gap: { gapId: busy.gap.id, kind: "Existing" } }),
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
    const harness = setupToolEscapes();
    const { productGaps } = harness;
    const a = await productGaps.recordToolEscape(
      accountId,
      inputFixture({
        escape: { ...baseEscape, reasons: ["Faster"], tool: "Spreadsheet" },
      }),
    );
    const b = await productGaps.recordToolEscape(
      accountId,
      inputFixture({
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
      inputFixture({
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
    const { productGaps, writes, catalog: owners } = setupToolEscapes();
    const owned = JSON.stringify([...owners.entries()]);

    await productGaps.recordToolEscape(accountId, inputFixture());

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
        "../../../../../../../packages/api/src/product-gaps.ts",
      ),
    ];
    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toMatch(FORBIDDEN_IMPORT);
    }
  });
});
