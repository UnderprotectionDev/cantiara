import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  workspaceCompany,
  workspaceCompanyFeedback,
  workspaceContact,
  workspaceContactFeedback,
} from "@cantiara/db/schema/contact";
import { feedback, feedbackWorkOrigin } from "@cantiara/db/schema/feedback";
import { fileAttachment } from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import { source } from "@cantiara/db/schema/source";
import { work } from "@cantiara/db/schema/work";
import { and, eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  FeedbackAttachmentUnavailableError,
  FeedbackConversionStaleError,
  FeedbackIdentityUnavailableError,
  FeedbackNotFoundError,
  FeedbackProjectNotFoundError,
  FeedbackRevisionConflictError,
} from "./feedback";
import { createDatabaseFeedback } from "./feedback-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Feedback PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `feedback-${crypto.randomUUID()}`;
  const otherAccountId = `feedback-other-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const otherWorkspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;
  const otherProjectId = `project-${crypto.randomUUID()}`;
  const occurredAt = "2026-09-30T12:00:00.000Z";

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
  }

  beforeEach(async () => {
    const db = requireDatabase();
    await db.insert(user).values([
      { email: `${accountId}@example.invalid`, id: accountId, name: "Founder" },
      {
        email: `${otherAccountId}@example.invalid`,
        id: otherAccountId,
        name: "Other",
      },
    ]);
    await db.insert(workspace).values([
      { id: workspaceId, ownerAccountId: accountId },
      { id: otherWorkspaceId, ownerAccountId: otherAccountId },
    ]);
    await db.insert(project).values([
      {
        id: projectId,
        name: "Feedback",
        shortCode: `FBK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
      },
      {
        id: otherProjectId,
        name: "Other",
        shortCode: `OTH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId: otherWorkspaceId,
      },
    ]);
  });

  afterEach(async () => {
    const db = requireDatabase();
    await db.delete(user).where(eq(user.id, accountId));
    await db.delete(user).where(eq(user.id, otherAccountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("creates Project-scoped Feedback that keeps the original message verbatim", async () => {
    const access = createDatabaseFeedback(requireDatabase());
    const message = "Line one\n\n  Line two with   spacing";

    const created = await access.create(accountId, {
      channel: "Interview",
      link: "https://example.com/call",
      occurredAt,
      originalMessage: message,
      projectId,
      title: "Call notes",
    });
    const bare = await access.create(accountId, {
      occurredAt,
      originalMessage: "Unknown sender",
      projectId,
      title: "Anonymous",
    });

    expect(created).toMatchObject({
      attachments: [],
      channel: "Interview",
      link: "https://example.com/call",
      occurredAt,
      originalMessage: message,
      projectId,
      status: "New",
    });
    expect(bare).toMatchObject({ channel: null, link: null });
    const listed = await access.list(accountId, projectId);
    expect(listed.readOnly).toBe(false);
    expect(listed.records.map(({ id }) => id).sort()).toEqual(
      [created.id, bare.id].sort(),
    );
    await expect(access.list(otherAccountId, projectId)).rejects.toBeInstanceOf(
      FeedbackProjectNotFoundError,
    );
  });

  test("references only active File Attachments of the same Project", async () => {
    const db = requireDatabase();
    const access = createDatabaseFeedback(db);
    const active = `attachment-${crypto.randomUUID()}`;
    const foreign = `attachment-${crypto.randomUUID()}`;
    const trashed = `attachment-${crypto.randomUUID()}`;
    await db.insert(fileAttachment).values([
      {
        id: active,
        name: "screenshot.png",
        projectId,
        scopeType: "Project",
        workspaceId,
      },
      {
        id: foreign,
        name: "other.png",
        projectId: otherProjectId,
        scopeType: "Project",
        workspaceId: otherWorkspaceId,
      },
      {
        id: trashed,
        lifecycleStatus: "Trash",
        name: "gone.png",
        projectId,
        scopeType: "Project",
        workspaceId,
      },
    ]);
    const base = {
      occurredAt,
      originalMessage: "See attached",
      projectId,
      title: "Attached",
    };

    const created = await access.create(accountId, {
      ...base,
      attachmentIds: [active, active],
    });

    expect(created.attachments).toEqual([
      { id: active, name: "screenshot.png" },
    ]);
    await Promise.all(
      [foreign, trashed, "missing"].map((attachmentId) =>
        expect(
          access.create(accountId, { ...base, attachmentIds: [attachmentId] }),
        ).rejects.toBeInstanceOf(FeedbackAttachmentUnavailableError),
      ),
    );
  });

  test("is a separate master record, not a Source row", async () => {
    const db = requireDatabase();
    const access = createDatabaseFeedback(db);
    const sourcesBefore = await db
      .select()
      .from(source)
      .where(eq(source.projectId, projectId));

    const created = await access.create(accountId, {
      link: "https://example.com/post",
      occurredAt,
      originalMessage: "Looks great",
      projectId,
      title: "Praise",
    });

    expect(
      await db.select().from(source).where(eq(source.projectId, projectId)),
    ).toHaveLength(sourcesBefore.length);
    expect(
      await db.select().from(feedback).where(eq(feedback.id, created.id)),
    ).toHaveLength(1);
    expect(Object.keys(created)).not.toEqual(
      expect.arrayContaining(["sourceType", "snapshot", "version"]),
    );
  });

  test("status changes never write Work status, priority or planning fields", async () => {
    const db = requireDatabase();
    const access = createDatabaseFeedback(db);
    const workId = `work-${crypto.randomUUID()}`;
    await db.insert(work).values({
      id: workId,
      key: "FBK-1",
      number: 1,
      projectId,
      roadmapHorizon: "Next",
      status: "In Progress",
      title: "Fix export",
      type: "Task",
    });
    const [workBefore] = await db
      .select()
      .from(work)
      .where(eq(work.id, workId));
    const created = await access.create(accountId, {
      occurredAt,
      originalMessage: "Export fails",
      projectId,
      title: "Export",
    });

    const reviewed = await access.setStatus(accountId, {
      expectedRevision: created.revision,
      feedbackId: created.id,
      projectId,
      status: "Reviewed",
    });
    const archived = await access.setStatus(accountId, {
      feedbackId: created.id,
      projectId,
      status: "Archived",
    });

    expect([reviewed.status, archived.status]).toEqual([
      "Reviewed",
      "Archived",
    ]);
    expect(archived.originalMessage).toBe("Export fails");
    const [workAfter] = await db.select().from(work).where(eq(work.id, workId));
    expect(workAfter).toEqual(workBefore);
  });

  test("keeps status commands owner-scoped and revision-checked", async () => {
    const access = createDatabaseFeedback(requireDatabase());
    const created = await access.create(accountId, {
      occurredAt,
      originalMessage: "Hello",
      projectId,
      title: "Hi",
    });

    await expect(
      access.setStatus(otherAccountId, {
        feedbackId: created.id,
        projectId,
        status: "Reviewed",
      }),
    ).rejects.toBeInstanceOf(FeedbackNotFoundError);
    await expect(
      access.setStatus(accountId, {
        expectedRevision: created.revision + 3,
        feedbackId: created.id,
        projectId,
        status: "Reviewed",
      }),
    ).rejects.toBeInstanceOf(FeedbackRevisionConflictError);
    const unchanged = await access.setStatus(accountId, {
      feedbackId: created.id,
      projectId,
      status: "New",
    });
    expect(unchanged.revision).toBe(created.revision);
  });

  async function seedIdentity() {
    const db = requireDatabase();
    const contactId = `contact-${crypto.randomUUID()}`;
    const companyId = `company-${crypto.randomUUID()}`;
    const foreignContactId = `contact-${crypto.randomUUID()}`;
    await db.insert(workspaceContact).values([
      { displayName: "Ada", id: contactId, workspaceId },
      {
        displayName: "Other",
        id: foreignContactId,
        workspaceId: otherWorkspaceId,
      },
    ]);
    await db
      .insert(workspaceCompany)
      .values({ id: companyId, name: "Acme", workspaceId });
    return { companyId, contactId, foreignContactId };
  }

  test("saves without a Contact and links an existing Contact and Company on request", async () => {
    const db = requireDatabase();
    const access = createDatabaseFeedback(db);
    const { companyId, contactId, foreignContactId } = await seedIdentity();
    const base = {
      occurredAt,
      originalMessage: "Hello",
      projectId,
      title: "Hi",
    };

    const anonymous = await access.create(accountId, base);
    const known = await access.create(accountId, {
      ...base,
      companyId,
      contactId,
    });

    expect(anonymous).toMatchObject({ company: null, contact: null });
    expect(known.contact).toEqual({ displayName: "Ada", id: contactId });
    expect(known.company).toEqual({ id: companyId, name: "Acme" });
    expect(
      await db
        .select()
        .from(workspaceContactFeedback)
        .where(eq(workspaceContactFeedback.feedbackId, anonymous.id)),
    ).toHaveLength(0);
    await expect(
      access.create(accountId, { ...base, contactId: foreignContactId }),
    ).rejects.toBeInstanceOf(FeedbackIdentityUnavailableError);
    await expect(
      access.create(accountId, { ...base, companyId: "missing" }),
    ).rejects.toBeInstanceOf(FeedbackIdentityUnavailableError);
    // A refused identity leaves no half-created Feedback behind.
    expect(
      (await access.list(accountId, projectId)).records
        .map(({ id }) => id)
        .sort(),
    ).toEqual([anonymous.id, known.id].sort());
  });

  test("replaces and clears identity without touching the message or status", async () => {
    const db = requireDatabase();
    const access = createDatabaseFeedback(db);
    const { companyId, contactId } = await seedIdentity();
    const created = await access.create(accountId, {
      occurredAt,
      originalMessage: "Original words",
      projectId,
      title: "Hi",
    });

    const linked = await access.setIdentity(accountId, {
      companyId,
      contactId,
      feedbackId: created.id,
      projectId,
    });
    const cleared = await access.setIdentity(accountId, {
      companyId: null,
      contactId: null,
      feedbackId: created.id,
      projectId,
    });

    expect(linked.contact?.id).toBe(contactId);
    expect(cleared).toMatchObject({
      company: null,
      contact: null,
      originalMessage: "Original words",
      status: "New",
    });
    expect(
      await db
        .select()
        .from(workspaceCompanyFeedback)
        .where(eq(workspaceCompanyFeedback.feedbackId, created.id)),
    ).toHaveLength(0);
    await expect(
      access.setIdentity(otherAccountId, {
        companyId: null,
        contactId,
        feedbackId: created.id,
        projectId,
      }),
    ).rejects.toBeInstanceOf(FeedbackNotFoundError);
  });

  describe("Convert to Work", () => {
    async function createRecord(title = "Export fails") {
      const access = createDatabaseFeedback(requireDatabase());
      const record = await access.create(accountId, {
        occurredAt,
        originalMessage: "Export keeps failing\nfor large files.",
        projectId,
        title,
      });
      return { access, record };
    }

    function confirmation(
      plan: Awaited<
        ReturnType<
          ReturnType<typeof createDatabaseFeedback>["previewConvertToWork"]
        >
      >,
      feedbackId: string,
      key = `key-${crypto.randomUUID()}`,
    ) {
      return {
        baseRevision: 0,
        clientIdempotencyKey: key,
        feedbackId,
        id: `origin-${crypto.randomUUID()}`,
        plan,
        projectId,
        workId: `work-${crypto.randomUUID()}`,
      };
    }

    test("previews without writing and confirms exactly one Work with an Origin", async () => {
      const db = requireDatabase();
      const { access, record } = await createRecord();
      const plan = await access.previewConvertToWork(accountId, {
        feedbackId: record.id,
        projectId,
        workType: "Bug",
      });
      expect(
        await db.select().from(work).where(eq(work.projectId, projectId)),
      ).toHaveLength(0);

      const input = confirmation(plan, record.id);
      const conversion = await access.convertToWork(accountId, input);

      const works = await db
        .select()
        .from(work)
        .where(eq(work.projectId, projectId));
      expect(works).toHaveLength(1);
      expect(works[0]).toMatchObject({
        description: "Export keeps failing\nfor large files.",
        id: input.workId,
        status: "Not Started",
        title: "Export fails",
        type: "Bug",
      });
      expect(works[0]?.number).toBe(1);
      expect(conversion.origin).toMatchObject({
        id: input.id,
        workId: input.workId,
        workKey: works[0]?.key,
      });
      expect(conversion.feedback.workOrigins).toHaveLength(1);
    });

    test("leaves the Feedback undeleted, unarchived and its status unchanged", async () => {
      const db = requireDatabase();
      const { access, record } = await createRecord();
      const reviewed = await access.setStatus(accountId, {
        feedbackId: record.id,
        projectId,
        status: "Reviewed",
      });
      const [before] = await db
        .select()
        .from(feedback)
        .where(eq(feedback.id, record.id));
      const plan = await access.previewConvertToWork(accountId, {
        feedbackId: record.id,
        projectId,
      });

      const conversion = await access.convertToWork(
        accountId,
        confirmation(plan, record.id),
      );

      const [after] = await db
        .select()
        .from(feedback)
        .where(eq(feedback.id, record.id));
      expect(after).toEqual(before);
      expect(conversion.feedback).toMatchObject({
        revision: reviewed.revision,
        status: "Reviewed",
      });
    });

    test("a retry with the same key returns the same Work and creates no second one", async () => {
      const db = requireDatabase();
      const { access, record } = await createRecord();
      const plan = await access.previewConvertToWork(accountId, {
        feedbackId: record.id,
        projectId,
      });
      const input = confirmation(plan, record.id);

      const first = await access.convertToWork(accountId, input);
      const second = await access.convertToWork(accountId, input);

      expect(second.origin).toEqual(first.origin);
      expect(
        await db.select().from(work).where(eq(work.projectId, projectId)),
      ).toHaveLength(1);
      expect(
        await db
          .select()
          .from(feedbackWorkOrigin)
          .where(eq(feedbackWorkOrigin.feedbackId, record.id)),
      ).toHaveLength(1);
    });

    test("refuses a preview made stale by a change and an edited plan, creating nothing", async () => {
      const db = requireDatabase();
      const { access, record } = await createRecord();
      const plan = await access.previewConvertToWork(accountId, {
        feedbackId: record.id,
        projectId,
      });

      await expect(
        access.convertToWork(
          accountId,
          confirmation(
            { ...plan, work: { ...plan.work, title: "Rewritten" } },
            record.id,
          ),
        ),
      ).rejects.toBeInstanceOf(FeedbackConversionStaleError);
      await access.setStatus(accountId, {
        feedbackId: record.id,
        projectId,
        status: "Archived",
      });
      await expect(
        access.convertToWork(accountId, confirmation(plan, record.id)),
      ).rejects.toBeInstanceOf(FeedbackConversionStaleError);
      expect(
        await db.select().from(work).where(eq(work.projectId, projectId)),
      ).toHaveLength(0);
    });

    test("is owner-scoped and refused in an archived Project", async () => {
      const db = requireDatabase();
      const { access, record } = await createRecord();
      const plan = await access.previewConvertToWork(accountId, {
        feedbackId: record.id,
        projectId,
      });

      await expect(
        access.previewConvertToWork(otherAccountId, {
          feedbackId: record.id,
          projectId,
        }),
      ).rejects.toBeInstanceOf(FeedbackNotFoundError);
      await db
        .update(project)
        .set({ archivedAt: new Date() })
        .where(eq(project.id, projectId));
      await expect(
        access.convertToWork(accountId, confirmation(plan, record.id)),
      ).rejects.toThrow();
      expect(
        await db.select().from(work).where(eq(work.projectId, projectId)),
      ).toHaveLength(0);
    });

    test("several Feedback records origin-link to one Work as separate origins without a count", async () => {
      const db = requireDatabase();
      const { access, record: first } = await createRecord("First report");
      const { record: second } = await createRecord("Second report");
      const plan = await access.previewConvertToWork(accountId, {
        feedbackId: first.id,
        projectId,
      });
      const conversion = await access.convertToWork(
        accountId,
        confirmation(plan, first.id),
      );

      await db.insert(feedbackWorkOrigin).values({
        actorId: accountId,
        feedbackId: second.id,
        id: `origin-${crypto.randomUUID()}`,
        workId: conversion.origin.workId,
      });

      const listed = await access.list(accountId, projectId);
      const origins = listed.records.flatMap((item) =>
        item.workOrigins.map((origin) => ({
          feedbackId: item.id,
          workId: origin.workId,
        })),
      );
      expect(origins).toHaveLength(2);
      expect(new Set(origins.map(({ workId }) => workId))).toEqual(
        new Set([conversion.origin.workId]),
      );
      for (const item of listed.records) {
        expect(item).not.toHaveProperty("votes");
        expect(item).not.toHaveProperty("priority");
      }
      const [workRow] = await db
        .select()
        .from(work)
        .where(and(eq(work.id, conversion.origin.workId)));
      expect(workRow?.status).toBe("Not Started");
    });
  });
});
