import {
  buildFeedbackWorkPlan,
  type FeedbackConversionSource,
  type FeedbackRecord,
  type FeedbackStore,
  type FeedbackWorkOrigin,
  type ParsedCreateFeedbackInput,
} from "@cantiara/api/feedback";
import { describe, expect, test } from "vitest";

import {
  createFeedback,
  FeedbackConversionStaleError,
  FeedbackNotFoundError,
  FeedbackProjectNotFoundError,
  FeedbackRevisionConflictError,
} from "./feedback";

const timestamp = "2026-10-01T09:00:00.000Z";

/** Records every call so the seam's reach is observable, not assumed. */
function createMemoryStore() {
  const records = new Map<string, FeedbackRecord>();
  const works = new Map<string, { key: string; title: string }>();
  const idempotent = new Map<string, FeedbackWorkOrigin>();
  const calls: string[] = [];
  let sequence = 0;
  const store: FeedbackStore = {
    convertToWork: async (accountId, input) => {
      await Promise.resolve();
      calls.push("convertToWork");
      const current = records.get(input.feedbackId);
      if (!current || accountId !== "account-1") {
        return null;
      }
      const replay = idempotent.get(input.clientIdempotencyKey);
      const origin: FeedbackWorkOrigin = replay ?? {
        createdAt: timestamp,
        id: input.id,
        workId: input.workId,
        workKey: `FBK-${works.size + 1}`,
        workTitle: input.plan.work.title,
      };
      if (!replay) {
        idempotent.set(input.clientIdempotencyKey, origin);
        works.set(origin.workId, {
          key: origin.workKey,
          title: origin.workTitle,
        });
        records.set(current.id, {
          ...current,
          workOrigins: [...current.workOrigins, origin],
        });
      }
      return { feedback: records.get(current.id) ?? current, origin };
    },
    readConversionSource: async (accountId, projectId, feedbackId) => {
      await Promise.resolve();
      calls.push("readConversionSource");
      const record = records.get(feedbackId);
      return record &&
        accountId === "account-1" &&
        projectId === record.projectId
        ? ({
            projectName: "Feedback Project",
            record,
          } satisfies FeedbackConversionSource)
        : null;
    },
    setIdentity: async (accountId, input) => {
      await Promise.resolve();
      calls.push("setIdentity");
      const current = records.get(input.feedbackId);
      if (!current || accountId !== "account-1") {
        return null;
      }
      const next: FeedbackRecord = {
        ...current,
        company: input.companyId ? { id: input.companyId, name: "Acme" } : null,
        contact: input.contactId
          ? { displayName: "Ada", id: input.contactId }
          : null,
        revision: current.revision + 1,
      };
      records.set(next.id, next);
      return next;
    },
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
        company: input.companyId ? { id: input.companyId, name: "Acme" } : null,
        contact: input.contactId
          ? { displayName: "Ada", id: input.contactId }
          : null,
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
        workOrigins: [],
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
  return { calls, records, store, works };
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
    expect(created.contact).toBeNull();
    expect(created.company).toBeNull();
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

describe("Feedback optional identity", () => {
  const base = {
    occurredAt: "2026-09-30T12:00:00.000Z",
    originalMessage: "Original words",
    projectId: "project-1",
    title: "Hi",
  };

  test("saves without a Contact and never asks for one", async () => {
    const { calls, store } = createMemoryStore();
    const access = createFeedback(store);

    const record = await access.create("account-1", base);

    expect(record).toMatchObject({ company: null, contact: null });
    expect(calls).toEqual(["create"]);
  });

  test("links an existing Contact and Company and clears them again", async () => {
    const access = createFeedback(createMemoryStore().store);
    const created = await access.create("account-1", {
      ...base,
      companyId: "company-1",
      contactId: "contact-1",
    });
    expect(created.contact).toMatchObject({ id: "contact-1" });
    expect(created.company).toMatchObject({ id: "company-1" });

    const cleared = await access.setIdentity("account-1", {
      companyId: null,
      contactId: null,
      feedbackId: created.id,
      projectId: "project-1",
    });

    expect(cleared).toMatchObject({
      contact: null,
      company: null,
      originalMessage: "Original words",
      status: "New",
    });
  });

  test("the identity command carries identity only", async () => {
    const access = createFeedback(createMemoryStore().store);
    const created = await access.create("account-1", base);

    await Promise.all(
      [
        { status: "Reviewed" },
        { originalMessage: "Rewritten" },
        { workId: "work-1" },
        { email: "ada@example.com" },
        { displayName: "Ada" },
      ].map((extra) =>
        expect(
          access.setIdentity("account-1", {
            companyId: null,
            contactId: "contact-1",
            feedbackId: created.id,
            projectId: "project-1",
            ...extra,
          } as never),
        ).rejects.toThrow(),
      ),
    );
    await expect(
      access.setIdentity("account-1", {
        companyId: null,
        contactId: null,
        feedbackId: "missing",
        projectId: "project-1",
      }),
    ).rejects.toBeInstanceOf(FeedbackNotFoundError);
  });
});

describe("Convert to Work", () => {
  async function seeded() {
    const memory = createMemoryStore();
    const access = createFeedback(memory.store);
    const record = await access.create("account-1", {
      occurredAt: "2026-09-30T12:00:00.000Z",
      originalMessage: "Export keeps failing\nfor large files.",
      projectId: "project-1",
      title: "Export fails",
    });
    memory.calls.length = 0;
    return { access, memory, record };
  }

  function confirmation(
    plan: Awaited<
      ReturnType<ReturnType<typeof createFeedback>["previewConvertToWork"]>
    >,
    feedbackId: string,
    key = "key-1",
  ) {
    return {
      baseRevision: 0,
      clientIdempotencyKey: key,
      feedbackId,
      id: "origin-1",
      plan,
      projectId: "project-1",
      workId: "work-1",
    };
  }

  test("previews exactly one Work with title, body, target Project and Origin, writing nothing", async () => {
    const { access, memory, record } = await seeded();

    const plan = await access.previewConvertToWork("account-1", {
      feedbackId: record.id,
      projectId: "project-1",
      workType: "Bug",
    });

    expect(plan).toMatchObject({
      recordCount: 1,
      relation: "Origin",
      targetProject: { id: "project-1", name: "Feedback Project" },
      work: {
        description: "Export keeps failing\nfor large files.",
        title: "Export fails",
        type: "Bug",
      },
    });
    expect(memory.calls).toEqual(["readConversionSource"]);
    expect(memory.works.size).toBe(0);
  });

  test("defaults to Task and refuses Work types the mapping does not own", async () => {
    const { access, record } = await seeded();

    const plan = await access.previewConvertToWork("account-1", {
      feedbackId: record.id,
      projectId: "project-1",
    });
    expect(plan.work.type).toBe("Task");
    await expect(
      access.previewConvertToWork("account-1", {
        feedbackId: record.id,
        projectId: "project-1",
        workType: "Feature" as never,
      }),
    ).rejects.toThrow();
    await expect(
      access.previewConvertToWork("account-1", {
        feedbackId: "missing",
        projectId: "project-1",
      }),
    ).rejects.toBeInstanceOf(FeedbackNotFoundError);
  });

  test("confirming creates one Work and an Origin and leaves the Feedback as it was", async () => {
    const { access, memory, record } = await seeded();
    const plan = await access.previewConvertToWork("account-1", {
      feedbackId: record.id,
      projectId: "project-1",
    });

    const conversion = await access.convertToWork(
      "account-1",
      confirmation(plan, record.id),
    );

    expect(
      memory.calls.filter((call) => call === "convertToWork"),
    ).toHaveLength(1);
    expect(memory.works.size).toBe(1);
    expect(conversion.origin).toMatchObject({ workId: "work-1" });
    expect(conversion.feedback).toMatchObject({
      originalMessage: record.originalMessage,
      revision: record.revision,
      status: "New",
    });
    expect(conversion.feedback.workOrigins).toHaveLength(1);
    expect(memory.records.has(record.id)).toBe(true);
  });

  test("keeps a Reviewed status through conversion", async () => {
    const { access, record } = await seeded();
    const reviewed = await access.setStatus("account-1", {
      feedbackId: record.id,
      projectId: "project-1",
      status: "Reviewed",
    });
    const plan = await access.previewConvertToWork("account-1", {
      feedbackId: record.id,
      projectId: "project-1",
    });

    const conversion = await access.convertToWork(
      "account-1",
      confirmation(plan, record.id),
    );

    expect(conversion.feedback.status).toBe("Reviewed");
    expect(conversion.feedback.revision).toBe(reviewed.revision);
  });

  test("a retry with the same key returns the same Work", async () => {
    const { access, memory, record } = await seeded();
    const plan = await access.previewConvertToWork("account-1", {
      feedbackId: record.id,
      projectId: "project-1",
    });

    const first = await access.convertToWork(
      "account-1",
      confirmation(plan, record.id),
    );
    const second = await access.convertToWork(
      "account-1",
      confirmation(plan, record.id),
    );

    expect(second.origin).toEqual(first.origin);
    expect(memory.works.size).toBe(1);
  });

  test("refuses a stale preview after the Feedback changed", async () => {
    const { access, memory, record } = await seeded();
    const plan = await access.previewConvertToWork("account-1", {
      feedbackId: record.id,
      projectId: "project-1",
    });
    await access.setStatus("account-1", {
      feedbackId: record.id,
      projectId: "project-1",
      status: "Reviewed",
    });

    await expect(
      access.convertToWork("account-1", confirmation(plan, record.id)),
    ).rejects.toBeInstanceOf(FeedbackConversionStaleError);
    expect(memory.works.size).toBe(0);
  });

  test("refuses an edited or forged plan", async () => {
    const { access, memory, record } = await seeded();
    const plan = await access.previewConvertToWork("account-1", {
      feedbackId: record.id,
      projectId: "project-1",
    });
    const edited = {
      ...plan,
      work: { ...plan.work, title: "Something else entirely" },
    };

    await expect(
      access.convertToWork("account-1", confirmation(edited, record.id)),
    ).rejects.toBeInstanceOf(FeedbackConversionStaleError);
    await expect(
      access.convertToWork(
        "account-1",
        confirmation({ ...plan, recordCount: 2 } as never, record.id),
      ),
    ).rejects.toThrow();
    await expect(
      access.convertToWork(
        "account-1",
        confirmation(
          { ...plan, extraWork: { title: "Hidden" } } as never,
          record.id,
        ),
      ),
    ).rejects.toThrow();
    expect(memory.works.size).toBe(0);
  });

  test("the plan mapping is pure and carries no AI or summary field", () => {
    const record = {
      id: "f",
      originalMessage: "Body",
      projectId: "p",
      revision: 3,
      title: "Title",
    } as FeedbackRecord;

    const plan = buildFeedbackWorkPlan({ projectName: "P", record }, "Task");

    expect(plan.work).toEqual({
      description: "Body",
      title: "Title",
      type: "Task",
    });
    expect(plan).not.toHaveProperty("summary");
    expect(plan).not.toHaveProperty("priority");
  });
});
