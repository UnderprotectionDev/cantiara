import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { feedback } from "@cantiara/db/schema/feedback";
import { fileAttachment } from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import { source } from "@cantiara/db/schema/source";
import { work } from "@cantiara/db/schema/work";
import { eq } from "drizzle-orm";
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
});
