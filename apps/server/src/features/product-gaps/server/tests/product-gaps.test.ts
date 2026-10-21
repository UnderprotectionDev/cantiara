// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal and status pair is asserted in sequence against one store.
import {
  PRODUCT_GAP_STATUS_PRD_VALUES,
  PRODUCT_GAP_STATUSES,
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
} from "../product-gaps";
import {
  accountId,
  createProductGapHarness,
} from "../product-gaps-memory-store";

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

const gap = {
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
      ...gap,
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
      title: gap.title,
      unmetNeed: gap.unmetNeed,
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
      productGaps.record(accountId, { ...gap, title: "  " }),
    ).rejects.toThrow();
    await expect(
      productGaps.record(accountId, { ...gap, unmetNeed: "" }),
    ).rejects.toThrow();
    for (const extra of [
      { repeatCount: 3 },
      { priority: "High" },
      { workId: "w1" },
      { status: "Met" },
      { projectId: "p1" },
    ]) {
      await expect(
        productGaps.record(accountId, { ...gap, ...extra } as never),
      ).rejects.toThrow();
    }
  });

  test("refuses a link to a missing, trashed or repeated record without writing", async () => {
    const { productGaps, gaps } = setup();

    await expect(
      productGaps.record(accountId, {
        ...gap,
        links: [{ targetId: "nope", targetType: "Work" }],
      }),
    ).rejects.toBeInstanceOf(ProductGapLinkTargetError);
    await expect(
      productGaps.record(accountId, {
        ...gap,
        links: [{ targetId: "f-trash", targetType: "Feature" }],
      }),
    ).rejects.toBeInstanceOf(ProductGapLinkTargetError);
    await expect(
      productGaps.record(accountId, {
        ...gap,
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

    const first = await productGaps.record(accountId, gap);
    const same = await productGaps.record(accountId, gap);
    const similar = await productGaps.record(accountId, {
      ...gap,
      title: "bulk edit across projects ",
    });

    expect(new Set([first.id, same.id, similar.id]).size).toBe(3);
    expect(gaps.size).toBe(3);
    expect((await productGaps.list(accountId)).gaps).toHaveLength(3);
  });

  test("is refused without a Workspace", async () => {
    const { productGaps } = setup();

    await expect(
      productGaps.record("someone-else", gap),
    ).rejects.toBeInstanceOf(ProductGapWorkspaceNotFoundError);
    await expect(productGaps.list("someone-else")).rejects.toBeInstanceOf(
      ProductGapWorkspaceNotFoundError,
    );
  });

  test("reads a link that later goes away as broken and keeps the Gap", async () => {
    const { productGaps, catalog: owners } = setup();
    const created = await productGaps.record(accountId, {
      ...gap,
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
        const created = await productGaps.record(accountId, gap);
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
    const created = await productGaps.record(accountId, gap);

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
      ...gap,
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
    const created = await productGaps.record(accountId, gap);
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
      ...gap,
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
        description: `${gap.unmetNeed}\n\nScope: Board only.`,
        title: gap.title,
        type: "Research",
      },
    });
    expect(writes).toEqual([]);
  });

  test("confirms the exact plan once: one Work, one Follow-up link, retry is the same result", async () => {
    const { productGaps, catalog: owners, writes } = setup();
    const created = await productGaps.record(accountId, gap);
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
      { kind: "Follow-up", label: gap.title, targetType: "Work" },
    ]);
    expect(retry.followUp.workKey).toBe(first.followUp.workKey);
    expect(writes).toEqual(["create Work"]);
    expect(owners.has("Work:work-new")).toBe(true);
  });

  test("relates an existing Feature only after preview and writes no Work", async () => {
    const { productGaps, writes } = setup();
    const created = await productGaps.record(accountId, gap);
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
    const created = await productGaps.record(accountId, gap);
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
    const created = await productGaps.record(accountId, gap);

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
