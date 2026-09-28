import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";
import type { Context } from "./context";
import type {
  PersonalRemindersAccess,
  WorkReviewLater,
} from "./personal-reminders";
import { appRouter } from "./routers/index";

const workReviewLater: WorkReviewLater = {
  action: "Review Later",
  cancelledAt: null,
  condition: "Only if still open",
  createdAt: "2026-09-28T10:00:00.000Z",
  fireAt: "2026-09-28T11:00:00.000Z",
  fireNote: null,
  id: "reminder-1",
  sourceProjectId: "project-1",
  sourceRecordId: "work-1",
  sourceRecordType: "Work",
  status: "Planned",
  triggeredAt: null,
};

function createContext(personalReminders: PersonalRemindersAccess): Context {
  return {
    accountAccess: {
      listSessions: async () => [],
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    },
    accountPreferences: {
      get: async () => ({
        appearance: "Dark",
        dateFormat: "locale",
        firstDayOfWeek: "Monday",
        isSaved: false,
        locale: "en-GB",
        revision: 0,
        savedAt: null,
        timeZone: "Europe/Istanbul",
      }),
    },
    auth: null,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    personalReminders,
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
  };
}

describe("Personal Reminders RPC", () => {
  test("creates, lists, and cancels Work Review Later as the signed-in Account", async () => {
    const cancelled = {
      ...workReviewLater,
      cancelledAt: "2026-09-28T10:30:00.000Z",
      status: "Cancelled" as const,
    };
    const access: PersonalRemindersAccess = {
      cancelWorkReviewLater: vi.fn().mockResolvedValue(cancelled),
      createWorkReviewLater: vi.fn().mockResolvedValue(workReviewLater),
      listWorkReviewLater: vi.fn().mockResolvedValue([workReviewLater]),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });
    const input = {
      clientIdempotencyKey: "review-later-rpc-1",
      condition: "Only if still open" as const,
      fireAt: "2026-09-28T11:00:00.000Z",
      workId: "work-1",
    };

    await expect(client.createWorkReviewLater(input)).resolves.toEqual(
      workReviewLater,
    );
    await expect(client.workReviewLater({ workId: "work-1" })).resolves.toEqual(
      [workReviewLater],
    );
    await expect(
      client.cancelWorkReviewLater({ reminderId: workReviewLater.id }),
    ).resolves.toEqual(cancelled);

    expect(access.createWorkReviewLater).toHaveBeenCalledExactlyOnceWith(
      "account-1",
      input,
    );
    expect(access.listWorkReviewLater).toHaveBeenCalledExactlyOnceWith(
      "account-1",
      "work-1",
    );
    expect(access.cancelWorkReviewLater).toHaveBeenCalledExactlyOnceWith(
      "account-1",
      workReviewLater.id,
    );
  });
});
