import type { Context } from "@cantiara/api/context";
import {
  type FocusPeriodAccess,
  FocusPeriodConflictError,
} from "@cantiara/api/focus-period";
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
  closeComparison: null,
  dependencies: { cycles: [], edges: [], nodes: [] },
  evaluation: null,
  followUpWorks: [],
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
    saveEvaluation: vi.fn().mockResolvedValue(undefined),
    linkFollowUpWork: vi.fn().mockResolvedValue(undefined),
    move: vi.fn().mockResolvedValue(undefined),
  };
  const context = { focusPeriod, session } as Context;
  return { client: createRouterClient(appRouter, { context }), focusPeriod };
}

describe("Focus Period RPC", () => {
  test.each([
    "Work is already in an active Focus Period. Use Move.",
    "Work is already in another Focus Period.",
  ])("preserves the membership conflict message: %s", async (message) => {
    const { client, focusPeriod } = testClient({
      session: { id: "session-1" },
      user: { id: "founder" },
    } as Context["session"]);
    vi.spyOn(focusPeriod, "add").mockRejectedValue(
      new FocusPeriodConflictError(message),
    );

    await expect(
      client.addToFocusPeriod({ periodId: "period-1", workId: "work-1" }),
    ).rejects.toMatchObject({ code: "CONFLICT", message });
  });

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
      client.moveToFocusPeriod({ periodId: "period-2", workId: "work-1" }),
    ).resolves.toEqual({ status: true });
    expect(focusPeriod.move).toHaveBeenCalledExactlyOnceWith(
      "founder",
      "period-2",
      "work-1",
    );
    await expect(
      client.decideFocusPeriodLeftovers({
        periodId: "period-1",
        workIds: ["work-1", "work-2"],
        destination: "Backlog",
      }),
    ).resolves.toEqual({ status: true });
    expect(focusPeriod.decide).toHaveBeenCalledExactlyOnceWith("founder", {
      periodId: "period-1",
      workIds: ["work-1", "work-2"],
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
        workIds: [],
        destination: "Backlog",
      }),
    ).rejects.toThrow();
    expect(authenticated.focusPeriod.decide).not.toHaveBeenCalled();
  });

  test("saves an optional evaluation and creates confirmed follow-up Work linked to its learning", async () => {
    const session = {
      session: { id: "session-1" },
      user: { id: "founder" },
    } as Context["session"];
    const { client, focusPeriod } = testClient(session);
    const create = vi.fn().mockResolvedValue({ id: "follow-up-work" });
    const followUpContext = {
      focusPeriod,
      session,
      workLifecycle: { create },
    } as unknown as Context;
    const followUpClient = createRouterClient(appRouter, {
      context: followUpContext,
    });

    await expect(
      client.saveFocusPeriodEvaluation({
        periodId: "period-1",
        evaluation: { keep: "Pair early", change: "", tryNext: "Ship smaller" },
      }),
    ).resolves.toEqual({ status: true });
    expect(focusPeriod.saveEvaluation).toHaveBeenCalledExactlyOnceWith(
      "founder",
      {
        periodId: "period-1",
        evaluation: { keep: "Pair early", change: "", tryNext: "Ship smaller" },
      },
    );
    focusPeriod.find = vi.fn().mockResolvedValue({
      ...period,
      status: "Closed",
      evaluation: {
        keep: "Pair early",
        change: null,
        tryNext: "Ship smaller",
      },
    });

    await expect(
      followUpClient.createFocusPeriodFollowUpWork({
        periodId: "period-1",
        learning: "Try next",
        projectId: "project-1",
        title: "Split the release",
        type: "Task",
        clientIdempotencyKey: "follow-up-key",
      }),
    ).resolves.toEqual({ id: "follow-up-work" });
    expect(create).toHaveBeenCalledExactlyOnceWith("founder", {
      baseRevision: 0,
      clientIdempotencyKey: "follow-up-key",
      projectId: "project-1",
      title: "Split the release",
      type: "Task",
    });
    expect(focusPeriod.linkFollowUpWork).toHaveBeenCalledExactlyOnceWith(
      "founder",
      {
        periodId: "period-1",
        workId: "follow-up-work",
        learning: "Try next",
        learningText: "Ship smaller",
      },
    );
  });
});
