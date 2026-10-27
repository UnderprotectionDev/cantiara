import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import { createAttentionSignals } from "../attention-signals";
import { createMemoryAttentionSignalStore } from "./attention-signals-memory-store";

function setup(authenticated = true) {
  const { store } = createMemoryAttentionSignalStore();
  const access = createAttentionSignals(store);
  const context = {
    attentionSignals: access,
    session: authenticated
      ? { session: { id: "session" }, user: { id: "account-1" } }
      : null,
  } as unknown as Context;
  return { access, client: createRouterClient(appRouter, { context }) };
}

const EMIT_PROCEDURE = /emit/i;

describe("Notification Center RPC seam", () => {
  test("serves both sections with Action Required open to the signed-in account", async () => {
    const { access, client } = setup();
    await access.emit("account-1", {
      eventId: "e1",
      group: { id: "work-1", kind: "Work" },
      occurredAt: "2026-10-27T09:00:00.000Z",
      reason: "Open Risk.",
      signalId: "open-risk",
      targetId: "risk-1",
    });
    const center = await client.notificationCenter();
    expect(center.sections.map((s) => [s.section, s.defaultOpen])).toEqual([
      ["Action Required", true],
      ["Information Flow", false],
    ]);
    expect(center.sections[0]?.groups[0]?.signals[0]?.signalId).toBe(
      "open-risk",
    );
  });

  test("exposes no emit procedure to the client", () => {
    const { client } = setup();
    expect(Object.keys(client).filter((k) => EMIT_PROCEDURE.test(k))).toEqual(
      [],
    );
  });

  test("marks, opens and previews follow-up work through the signed-in account", async () => {
    const { access, client } = setup();
    const { signal } = await access.emit("account-1", {
      eventId: "e1",
      group: { id: "work-1", kind: "Work" },
      occurredAt: "2026-10-27T09:00:00.000Z",
      projectId: "project-1",
      reason: "Open Risk.",
      signalId: "open-risk",
      targetId: "risk-1",
    });
    const read = await client.markNotification({
      mark: "read",
      signalRowId: signal.id,
    });
    expect(read.readAt).not.toBeNull();
    expect(
      (await client.openNotification({ signalRowId: signal.id })).outcome,
    ).toBe("record");
    const preview = await client.previewNotificationFollowUp({
      signalRowId: signal.id,
    });
    expect(preview.work.projectId).toBe("project-1");
    await expect(
      client.markNotification({ mark: "read", signalRowId: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("refuses an anonymous caller", async () => {
    const { client } = setup(false);
    await expect(client.notificationCenter()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
