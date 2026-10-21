import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import {
  accountId,
  createProductGapHarness,
} from "./product-gaps-memory-store";

const PRODUCT_GAP_PROCEDURE = /product ?gap|tool ?escape/i;

function setup(authenticated = true) {
  const harness = createProductGapHarness([
    { label: "Checkout", targetId: "p1", targetType: "Project" },
    { label: "Offline mode", targetId: "f1", targetType: "Feature" },
  ]);
  const context = {
    productGaps: harness.productGaps,
    session: authenticated
      ? { session: { id: "session" }, user: { id: accountId } }
      : null,
  } as Context;
  return { ...harness, client: createRouterClient(appRouter, { context }) };
}

const gap = {
  title: "Bulk edit across projects",
  unmetNeed: "I edit many Works in another tool.",
};

describe("Product Gaps RPC seam", () => {
  test("records a Gap by hand, lists it and moves its status", async () => {
    const { client } = setup();

    const created = await client.recordProductGap({
      ...gap,
      links: [{ targetId: "p1", targetType: "Project" }],
    });
    const moved = await client.setProductGapStatus({
      expectedStatus: "Open",
      gapId: created.id,
      status: "Evaluating",
    });

    expect(created.links).toMatchObject([{ label: "Checkout" }]);
    expect(moved.status).toBe("Evaluating");
    expect((await client.productGaps()).gaps).toMatchObject([
      { id: created.id, status: "Evaluating" },
    ]);
    expect(
      await client.productGapLinkTargets({ targetType: "Feature" }),
    ).toMatchObject([{ targetId: "f1" }]);
  });

  test("previews before it writes and confirms only the previewed plan", async () => {
    const { client, writes } = setup();
    const created = await client.recordProductGap(gap);

    const plan = await client.previewProductGapFollowUp({
      gapId: created.id,
      kind: "Work",
      projectId: "p1",
    });
    expect(writes).toEqual([]);
    const confirmed = await client.confirmProductGapFollowUp({
      baseRevision: 0,
      clientIdempotencyKey: "key-1",
      gapId: created.id,
      id: "link-1",
      plan,
      workId: "work-1",
    });

    expect(confirmed.gap.links).toMatchObject([{ kind: "Follow-up" }]);
    if (plan.kind !== "Work") {
      throw new Error("Expected a Work plan.");
    }
    await expect(
      client.confirmProductGapFollowUp({
        baseRevision: 0,
        clientIdempotencyKey: "key-2",
        gapId: created.id,
        id: "link-2",
        plan: { ...plan, targetProject: { id: "p1", name: "Renamed" } },
        workId: "work-2",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("records a Tool Escape, opens its event set and filters the summary", async () => {
    const { client, writes } = setup();
    const toolEscape = {
      intendedJob: "Bulk rename forty Works",
      occurredAt: "2026-10-01T09:30:00.000Z",
      reasons: ["Faster" as const],
      source: { targetId: "p1", targetType: "Project" as const },
      tool: "Spreadsheet",
    };

    const first = await client.recordToolEscape({
      escape: toolEscape,
      gap: { kind: "New", ...gap },
    });
    await client.recordToolEscape({
      escape: { ...toolEscape, tool: "Notes" },
      gap: { gapId: first.gap.id, kind: "Existing" },
    });

    expect(first.escape).toMatchObject({ tool: "Spreadsheet" });
    expect(
      await client.productGapEscapes({ gapId: first.gap.id, tool: "notes" }),
    ).toHaveLength(1);
    expect((await client.productGaps({ reason: "Faster" })).gaps).toMatchObject(
      [{ escapeCount: 2, id: first.gap.id }],
    );
    expect((await client.productGaps({ tool: "Missing" })).gaps).toEqual([]);
    await expect(
      client.recordToolEscape({
        escape: {
          ...toolEscape,
          source: { targetId: "nope", targetType: "Work" },
        },
        gap: { kind: "New", ...gap },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(writes).toEqual([]);
  });

  test("maps domain refusals to typed failures", async () => {
    const { client } = setup();
    const created = await client.recordProductGap(gap);

    await expect(
      client.recordProductGap({
        ...gap,
        links: [{ targetId: "nope", targetType: "Work" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.setProductGapStatus({
        expectedStatus: "Evaluating",
        gapId: created.id,
        status: "Met",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      client.setProductGapStatus({
        expectedStatus: "Open",
        gapId: "missing",
        status: "Met",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("requires a signed-in founder and exposes no count, ranking or telemetry procedure", async () => {
    const { client } = setup(false);

    await expect(client.recordProductGap(gap)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    const names = Object.keys(appRouter).filter((name) =>
      PRODUCT_GAP_PROCEDURE.test(name),
    );
    expect(names.sort()).toEqual([
      "confirmProductGapFollowUp",
      "previewProductGapFollowUp",
      "productGapEscapes",
      "productGapLinkTargets",
      "productGaps",
      "recordProductGap",
      "recordToolEscape",
      "setProductGapStatus",
    ]);
  });
});
