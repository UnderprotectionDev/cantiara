import type { Context } from "@cantiara/api/context";
import type { DailyFocusAccess } from "@cantiara/api/daily-focus";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const focusDate = "2026-09-27";
const accountId = "founder-account";
const day = { focusDate, available: [], events: [], members: [] };

function testClient(session: Context["session"]) {
  const dailyFocus: DailyFocusAccess = {
    add: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue(day),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const context = {
    auth: null,
    dailyFocus,
    db: {} as Context["db"],
    session,
  } as Context;
  return { client: createRouterClient(appRouter, { context }), dailyFocus };
}

describe("Daily Focus RPC", () => {
  test("binds day membership to the authenticated Account", async () => {
    const { client, dailyFocus } = testClient({
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"]);

    await expect(client.dailyFocusDay({ focusDate })).resolves.toEqual(day);
    await expect(
      client.addToDailyFocus({ focusDate, workId: "work-1" }),
    ).resolves.toEqual({ status: true });
    await expect(
      client.removeFromDailyFocus({ focusDate, workId: "work-1" }),
    ).resolves.toEqual({ status: true });
    expect(dailyFocus.list).toHaveBeenCalledExactlyOnceWith(
      accountId,
      focusDate,
    );
    expect(dailyFocus.add).toHaveBeenCalledExactlyOnceWith(
      accountId,
      focusDate,
      "work-1",
    );
    expect(dailyFocus.remove).toHaveBeenCalledExactlyOnceWith(
      accountId,
      focusDate,
      "work-1",
    );
  });

  test("rejects unauthenticated access and invalid calendar dates", async () => {
    const anonymous = testClient(null);
    await expect(
      anonymous.client.dailyFocusDay({ focusDate }),
    ).rejects.toThrow();
    expect(anonymous.dailyFocus.list).not.toHaveBeenCalled();
    const authenticated = testClient({
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"]);
    await expect(
      authenticated.client.dailyFocusDay({ focusDate: "2026-02-30" }),
    ).rejects.toThrow();
    expect(authenticated.dailyFocus.list).not.toHaveBeenCalled();
  });
});
