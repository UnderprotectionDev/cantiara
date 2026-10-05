import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";
import type { Context } from "./context";
import {
  createPersonalReminderInputSchema,
  PERSONAL_REMINDER_SOURCE_TYPES,
  type PersonalReminder,
  type PersonalRemindersAccess,
} from "./personal-reminders";
import { appRouter } from "./routers/index";

const personalReminder: PersonalReminder = {
  action: "Remind me",
  cancelledAt: null,
  condition: "In any case",
  createdAt: "2026-09-28T10:00:00.000Z",
  fireAt: "2026-09-28T11:00:00.000Z",
  fireNote: null,
  id: "reminder-1",
  sourceProjectId: "project-1",
  sourceRecordId: "project-1",
  sourceRecordType: "Project",
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
  test.each(["In any case", "Only if still open"] as const)(
    "maps Work Review Later into the strict Personal Reminders input with %s",
    async (condition) => {
      const reminder: PersonalReminder = {
        ...personalReminder,
        action: "Review Later",
        condition,
        sourceRecordId: "work-1",
        sourceRecordType: "Work",
      };
      const access: PersonalRemindersAccess = {
        cancel: vi.fn(),
        create: vi.fn<PersonalRemindersAccess["create"]>(
          (_accountId, reminderInput) => {
            createPersonalReminderInputSchema.parse(reminderInput);
            return Promise.resolve(reminder);
          },
        ),
        list: vi.fn(),
      };
      const client = createRouterClient(appRouter, {
        context: createContext(access),
      });
      const input = {
        clientIdempotencyKey: "work-review-later-rpc-1",
        condition,
        fireAt: "2026-09-28T11:00:00.000Z",
        workId: "work-1",
      };

      await expect(client.createWorkReviewLater(input)).resolves.toEqual(
        reminder,
      );
      expect(access.create).toHaveBeenCalledExactlyOnceWith("account-1", {
        action: "Review Later",
        clientIdempotencyKey: input.clientIdempotencyKey,
        condition,
        fireAt: input.fireAt,
        sourceRecordId: input.workId,
        sourceRecordType: "Work",
      });
    },
  );

  test("creates, lists, and cancels a supported source reminder as the signed-in Account", async () => {
    const cancelled = {
      ...personalReminder,
      cancelledAt: "2026-09-28T10:30:00.000Z",
      status: "Cancelled" as const,
    };
    const access: PersonalRemindersAccess = {
      cancel: vi.fn().mockResolvedValue(cancelled),
      create: vi.fn().mockResolvedValue(personalReminder),
      list: vi.fn().mockResolvedValue([personalReminder]),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });
    const input = {
      action: "Remind me" as const,
      clientIdempotencyKey: "personal-reminder-rpc-1",
      condition: "In any case" as const,
      fireAt: "2026-09-28T11:00:00.000Z",
      sourceRecordId: "project-1",
      sourceRecordType: "Project" as const,
    };
    const source = {
      sourceRecordId: "project-1",
      sourceRecordType: "Project" as const,
    };

    await expect(client.createPersonalReminder(input)).resolves.toEqual(
      personalReminder,
    );
    await expect(client.personalReminders(source)).resolves.toEqual([
      personalReminder,
    ]);
    await expect(
      client.cancelPersonalReminder({ reminderId: personalReminder.id }),
    ).resolves.toEqual(cancelled);

    expect(access.create).toHaveBeenCalledExactlyOnceWith("account-1", input);
    expect(access.list).toHaveBeenCalledExactlyOnceWith("account-1", source);
    expect(access.cancel).toHaveBeenCalledExactlyOnceWith(
      "account-1",
      personalReminder.id,
    );
  });

  test("creates a Review Later for a Document section through the signed-in Account", async () => {
    const documentReminder: PersonalReminder = {
      ...personalReminder,
      action: "Review Later",
      sectionId: "release-readiness",
      sourceRecordId: "document-1",
      sourceRecordType: "Document",
    };
    const access: PersonalRemindersAccess = {
      cancel: vi.fn(),
      create: vi.fn().mockResolvedValue(documentReminder),
      list: vi.fn(),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });
    const input = {
      action: "Review Later" as const,
      clientIdempotencyKey: "document-section-review-later-1",
      fireAt: "2026-09-28T11:00:00.000Z",
      sectionId: "release-readiness",
      sourceRecordId: "document-1",
      sourceRecordType: "Document" as const,
    };

    await expect(client.createPersonalReminder(input)).resolves.toEqual(
      documentReminder,
    );
    expect(access.create).toHaveBeenCalledExactlyOnceWith("account-1", {
      ...input,
      condition: "In any case",
    });
    expect(
      createPersonalReminderInputSchema.safeParse({
        ...input,
        action: "Remind me",
      }).success,
    ).toBe(false);
    expect(
      createPersonalReminderInputSchema.safeParse({
        ...input,
        sourceRecordType: "Project",
      }).success,
    ).toBe(false);
  });

  test("uses the same Review Later contract for a Project Release", async () => {
    const releaseReminder: PersonalReminder = {
      ...personalReminder,
      action: "Review Later",
      sourceRecordId: "release-1",
      sourceRecordType: "Project Release",
    };
    const access: PersonalRemindersAccess = {
      cancel: vi.fn(),
      create: vi.fn().mockResolvedValue(releaseReminder),
      list: vi.fn(),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });
    const input = {
      action: "Review Later" as const,
      clientIdempotencyKey: "release-review-later-1",
      fireAt: "2026-09-28T11:00:00.000Z",
      sourceRecordId: "release-1",
      sourceRecordType: "Project Release" as const,
    };

    await expect(client.createPersonalReminder(input)).resolves.toEqual(
      releaseReminder,
    );
    expect(access.create).toHaveBeenCalledExactlyOnceWith("account-1", {
      ...input,
      condition: "In any case",
    });
  });

  test("requires a source and keeps the list closed to permanent record models", () => {
    expect(PERSONAL_REMINDER_SOURCE_TYPES).toEqual([
      "Project",
      "Document",
      "Work",
      "Decision",
      "Risk",
      "Milestone",
      "Project Release",
      "Production Incident",
    ]);

    const reminder = {
      action: "Remind me" as const,
      clientIdempotencyKey: "unsupported-reminder-source",
      fireAt: "2026-09-28T11:00:00.000Z",
      sourceRecordId: "project-1",
    };

    for (const sourceRecordType of ["Design", "Source", "Test Gap"] as const) {
      expect(
        createPersonalReminderInputSchema.safeParse({
          ...reminder,
          sourceRecordType,
        }).success,
      ).toBe(false);
    }

    expect(
      createPersonalReminderInputSchema.safeParse({
        action: "Review Later",
        clientIdempotencyKey: "standalone-reminder",
        fireAt: "2026-09-28T11:00:00.000Z",
      }).success,
    ).toBe(false);

    expect(
      createPersonalReminderInputSchema.safeParse({
        ...reminder,
        sourceRecordType: "Project",
        targetDate: "2026-10-15",
      }).success,
    ).toBe(false);
  });
});
