import type { Context } from "@cantiara/api/context";
import type { FocusPeriodAccess } from "@cantiara/api/focus-period";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const period = {
  id: "period-1",
  purpose: "Ship beta",
  startDate: "2026-10-01",
  endDate: "2026-10-07",
  status: "Active" as const,
  members: [],
  available: [],
  startSnapshot: [],
  closeSnapshot: null,
  closedAt: null,
  leftoverDecisions: [],
};

function testClient(session: Context["session"]) {
  const focusPeriod: FocusPeriodAccess = {
    list: vi.fn().mockResolvedValue([period]),
    find: vi.fn().mockResolvedValue(period),
    create: vi.fn().mockResolvedValue(period),
    add: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    decide: vi.fn().mockResolvedValue(undefined),
  };
  const context = { focusPeriod, session } as Context;
  return { client: createRouterClient(appRouter, { context }), focusPeriod };
}

describe("Focus Period RPC", () => {
  test("binds period creation and membership to the authenticated Account", async () => {
    const { client, focusPeriod } = testClient({
      session: { id: "session-1" },
      user: { id: "founder" },
    } as Context["session"]);
    await expect(
      client.createFocusPeriod({
        purpose: "Ship beta",
        startDate: "2026-10-01",
        endDate: "2026-10-07",
      }),
    ).resolves.toEqual(period);
    await expect(
      client.addToFocusPeriod({ periodId: "period-1", workId: "work-1" }),
    ).resolves.toEqual({ status: true });
    expect(focusPeriod.create).toHaveBeenCalledExactlyOnceWith("founder", {
      purpose: "Ship beta",
      startDate: "2026-10-01",
      endDate: "2026-10-07",
    });
    expect(focusPeriod.add).toHaveBeenCalledExactlyOnceWith(
      "founder",
      "period-1",
      "work-1",
    );
    await expect(
      client.decideFocusPeriodLeftovers({
        periodId: "period-1",
        workIds: ["work-1"],
        destination: "Backlog",
      }),
    ).resolves.toEqual({ status: true });
    expect(focusPeriod.decide).toHaveBeenCalledExactlyOnceWith("founder", {
      periodId: "period-1",
      workIds: ["work-1"],
      destination: "Backlog",
    });
  });

  test("rejects anonymous and invalid 1–8 week windows before access", async () => {
    const anonymous = testClient(null);
    await expect(anonymous.client.focusPeriods()).rejects.toThrow();
    await expect(
      anonymous.client.createFocusPeriod({
        purpose: "Ship beta",
        startDate: "2026-10-01",
        endDate: "2026-10-07",
      }),
    ).rejects.toThrow();
    expect(anonymous.focusPeriod.list).not.toHaveBeenCalled();
    await expect(
      anonymous.client.decideFocusPeriodLeftovers({
        periodId: "period-1",
        workIds: ["work-1"],
        destination: "Backlog",
      }),
    ).rejects.toThrow();
    const authenticated = testClient({
      session: { id: "session-1" },
      user: { id: "founder" },
    } as Context["session"]);
    await expect(
      authenticated.client.createFocusPeriod({
        purpose: "Ship beta",
        startDate: "2026-10-01",
        endDate: "2026-10-06",
      }),
    ).rejects.toThrow();
    expect(authenticated.focusPeriod.create).not.toHaveBeenCalled();
    await expect(
      authenticated.client.decideFocusPeriodLeftovers({
        periodId: "period-1",
        workIds: ["work-1", "work-2"],
        destination: "Backlog",
      }),
    ).rejects.toThrow();
    expect(authenticated.focusPeriod.decide).not.toHaveBeenCalled();
  });
});
