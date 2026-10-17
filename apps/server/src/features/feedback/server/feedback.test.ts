import type {
  FeedbackRecord,
  FeedbackStore,
  ParsedCreateFeedbackInput,
} from "@cantiara/api/feedback";
import { describe, expect, test } from "vitest";

import {
  createFeedback,
  FeedbackNotFoundError,
  FeedbackProjectNotFoundError,
  FeedbackRevisionConflictError,
} from "./feedback";

const timestamp = "2026-10-01T09:00:00.000Z";

/** Records every call so the seam's reach is observable, not assumed. */
function createMemoryStore() {
  const records = new Map<string, FeedbackRecord>();
  const calls: string[] = [];
  let sequence = 0;
  const store: FeedbackStore = {
    create: async (accountId, input: ParsedCreateFeedbackInput) => {
      await Promise.resolve();
      calls.push("create");
      if (accountId !== "account-1" || input.projectId !== "project-1") {
        return null;
      }
      sequence += 1;
      const record: FeedbackRecord = {
        attachments: [],
        channel: input.channel ?? null,
        createdAt: timestamp,
        id: `feedback-${sequence}`,
        link: input.link ?? null,
        occurredAt: input.occurredAt,
        originalMessage: input.originalMessage,
        projectId: input.projectId,
        revision: 1,
        status: "New",
        title: input.title,
        updatedAt: timestamp,
      };
      records.set(record.id, record);
      return record;
    },
    list: async (accountId, projectId) => {
      await Promise.resolve();
      calls.push("list");
      return accountId === "account-1" && projectId === "project-1"
        ? { readOnly: false, records: [...records.values()] }
        : null;
    },
    setStatus: async (accountId, input) => {
      await Promise.resolve();
      calls.push("setStatus");
      const current = records.get(input.feedbackId);
      if (!current || accountId !== "account-1") {
        return null;
      }
      if (
        input.expectedRevision !== undefined &&
        input.expectedRevision !== current.revision
      ) {
        throw new FeedbackRevisionConflictError(current.id);
      }
      const next = {
        ...current,
        revision: current.revision + 1,
        status: input.status,
      };
      records.set(next.id, next);
      return next;
    },
  };
  return { calls, records, store };
}

const message = "  Export keeps failing on large files.\nPlease fix.  ";

describe("Feedback master record", () => {
  test("keeps the original message, channel, time and link from an unknown sender", async () => {
    const { store } = createMemoryStore();
    const access = createFeedback(store);

    const created = await access.create("account-1", {
      channel: "Email",
      link: "https://example.com/thread/1",
      occurredAt: "2026-09-30T12:00:00.000Z",
      originalMessage: message,
      projectId: "project-1",
      title: "Export fails",
    });

    expect(created).toMatchObject({
      channel: "Email",
      link: "https://example.com/thread/1",
      occurredAt: "2026-09-30T12:00:00.000Z",
      originalMessage: message.trim(),
      status: "New",
      title: "Export fails",
    });
    expect(created).not.toHaveProperty("summary");
    expect(created).not.toHaveProperty("contactId");
  });

  test("needs only a message, time and title", async () => {
    const access = createFeedback(createMemoryStore().store);

    const created = await access.create("account-1", {
      occurredAt: "2026-09-30T12:00:00.000Z",
      originalMessage: "Nice app",
      projectId: "project-1",
      title: "Praise",
    });

    expect(created).toMatchObject({
      channel: null,
      link: null,
      attachments: [],
    });
  });

  test("rejects blank messages, non-http links and a missing Project", async () => {
    const access = createFeedback(createMemoryStore().store);
    const base = {
      occurredAt: "2026-09-30T12:00:00.000Z",
      originalMessage: "Hello",
      projectId: "project-1",
      title: "Hi",
    };

    await expect(
      access.create("account-1", { ...base, originalMessage: "   " }),
    ).rejects.toThrow();
    await expect(
      access.create("account-1", { ...base, link: "javascript:alert(1)" }),
    ).rejects.toThrow();
    await expect(
      access.create("account-1", { ...base, projectId: "project-2" }),
    ).rejects.toBeInstanceOf(FeedbackProjectNotFoundError);
    await expect(access.create("account-2", base)).rejects.toBeInstanceOf(
      FeedbackProjectNotFoundError,
    );
  });

  test("is not a Source: no Source type, recheck, snapshot or version fields exist", async () => {
    const { store } = createMemoryStore();
    const access = createFeedback(store);
    const created = await access.create("account-1", {
      link: "https://example.com/a",
      occurredAt: "2026-09-30T12:00:00.000Z",
      originalMessage: "Hello",
      projectId: "project-1",
      title: "Hi",
    });

    for (const sourceField of [
      "sourceType",
      "recheck",
      "recheckedAt",
      "snapshot",
      "candidateSnapshot",
      "version",
      "versions",
      "freshness",
    ]) {
      expect(created).not.toHaveProperty(sourceField);
    }
    // A Source-shaped create command is refused by the strict contract.
    await expect(
      access.create("account-1", {
        occurredAt: "2026-09-30T12:00:00.000Z",
        originalMessage: "Hello",
        projectId: "project-1",
        sourceType: "Feedback",
        title: "Hi",
      } as never),
    ).rejects.toThrow();
  });

  test("refuses social and requester actions on the create contract", async () => {
    const access = createFeedback(createMemoryStore().store);
    const base = {
      occurredAt: "2026-09-30T12:00:00.000Z",
      originalMessage: "Hello",
      projectId: "project-1",
      title: "Hi",
    };

    await Promise.all(
      [
        { comment: "thanks" },
        { votes: 1 },
        { likes: 1 },
        { reply: "We will fix it" },
        { summary: "short" },
      ].map((extra) =>
        expect(
          access.create("account-1", { ...base, ...extra } as never),
        ).rejects.toThrow(),
      ),
    );
  });
});

describe("Feedback status", () => {
  async function seeded() {
    const memory = createMemoryStore();
    const access = createFeedback(memory.store);
    const record = await access.create("account-1", {
      occurredAt: "2026-09-30T12:00:00.000Z",
      originalMessage: "Original words",
      projectId: "project-1",
      title: "Hi",
    });
    memory.calls.length = 0;
    return { access, memory, record };
  }

  test("moves New to Reviewed to Archived and keeps the original message", async () => {
    const { access, record } = await seeded();

    const reviewed = await access.setStatus("account-1", {
      expectedRevision: record.revision,
      feedbackId: record.id,
      projectId: "project-1",
      status: "Reviewed",
    });
    const archived = await access.setStatus("account-1", {
      feedbackId: record.id,
      projectId: "project-1",
      status: "Archived",
    });

    expect([reviewed.status, archived.status]).toEqual([
      "Reviewed",
      "Archived",
    ]);
    expect(archived.originalMessage).toBe("Original words");
    expect(archived.revision).toBe(record.revision + 2);
  });

  test("touches only the Feedback store and cannot carry Work fields", async () => {
    const { access, memory, record } = await seeded();

    await access.setStatus("account-1", {
      feedbackId: record.id,
      projectId: "project-1",
      status: "Reviewed",
    });

    expect(memory.calls).toEqual(["setStatus"]);
    await Promise.all(
      [
        { workStatus: "Done" },
        { workId: "work-1" },
        { priority: "High" },
        { kanbanColumn: "Done" },
      ].map((workField) =>
        expect(
          access.setStatus("account-1", {
            feedbackId: record.id,
            projectId: "project-1",
            status: "Archived",
            ...workField,
          } as never),
        ).rejects.toThrow(),
      ),
    );
    expect(memory.calls).toEqual(["setStatus"]);
  });

  test("rejects unknown statuses, stale revisions and unknown records", async () => {
    const { access, record } = await seeded();

    await expect(
      access.setStatus("account-1", {
        feedbackId: record.id,
        projectId: "project-1",
        status: "Done" as never,
      }),
    ).rejects.toThrow();
    await expect(
      access.setStatus("account-1", {
        expectedRevision: record.revision + 5,
        feedbackId: record.id,
        projectId: "project-1",
        status: "Reviewed",
      }),
    ).rejects.toBeInstanceOf(FeedbackRevisionConflictError);
    await expect(
      access.setStatus("account-1", {
        feedbackId: "missing",
        projectId: "project-1",
        status: "Reviewed",
      }),
    ).rejects.toBeInstanceOf(FeedbackNotFoundError);
  });
});
