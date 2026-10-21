import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { feedback } from "@cantiara/db/schema/feedback";
import { fileAttachment } from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import { source, sourceVersion } from "@cantiara/db/schema/source";
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

import { FeedbackProjectNotFoundError } from "../feedback";
import { createDatabaseFeedbackWithFeed } from "../feedback-feed-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Feed PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `feed-${crypto.randomUUID()}`;
  const otherAccountId = `feed-other-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;
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
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await db.insert(project).values({
      id: projectId,
      name: "Feed",
      shortCode: `FED-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
  });

  afterEach(async () => {
    const db = requireDatabase();
    await db.delete(user).where(eq(user.id, accountId));
    await db.delete(user).where(eq(user.id, otherAccountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  function feedAccess() {
    return createDatabaseFeedbackWithFeed(requireDatabase());
  }

  function createRecord(title: string, attachmentIds?: string[]) {
    return feedAccess().create(accountId, {
      attachmentIds,
      occurredAt,
      originalMessage: `${title} original message`,
      projectId,
      title,
    });
  }

  function confirmation(
    plan: Awaited<
      ReturnType<ReturnType<typeof feedAccess>["previewConvertToWork"]>
    >,
    feedbackId: string,
  ) {
    return {
      baseRevision: 0,
      clientIdempotencyKey: `key-${crypto.randomUUID()}`,
      feedbackId,
      id: `origin-${crypto.randomUUID()}`,
      plan,
      projectId,
      workId: `work-${crypto.randomUUID()}`,
    };
  }

  test("shows the saved version of each long-body Source and omits Sources without captured content", async () => {
    const db = requireDatabase();
    const current = `source-${crypto.randomUUID()}`;
    const empty = `source-${crypto.randomUUID()}`;
    await db.insert(source).values([
      { id: current, projectId, revision: 2 },
      { id: empty, projectId, revision: 1 },
    ]);
    await db.insert(sourceVersion).values([
      {
        accessedAt: new Date("2026-09-01T00:00:00.000Z"),
        capturedContent: "Older captured body",
        provider: "Web",
        revision: 1,
        sourceId: current,
        title: "Article",
        url: "https://example.com/article",
      },
      {
        accessedAt: new Date("2026-09-02T00:00:00.000Z"),
        capturedContent: "Current captured body",
        provider: "Web",
        revision: 2,
        sourceId: current,
        title: "Article",
        url: "https://example.com/article",
      },
      {
        accessedAt: new Date("2026-09-03T00:00:00.000Z"),
        capturedContent: "",
        provider: "Web",
        revision: 1,
        sourceId: empty,
        title: "Empty",
        url: "https://example.com/empty",
      },
    ]);

    const feed = await feedAccess().feed(accountId, { projectId });

    const rows = feed.rows.filter(({ kind }) => kind === "Source");
    expect(rows).toEqual([
      expect.objectContaining({
        body: "Current captured body",
        id: current,
        identity: "Web",
        kind: "Source",
        status: null,
        title: "Article",
      }),
    ]);
  });

  test("shows only Active File Attachments on Feed rows", async () => {
    const db = requireDatabase();
    const kept = `attachment-${crypto.randomUUID()}`;
    const trashed = `attachment-${crypto.randomUUID()}`;
    await db.insert(fileAttachment).values([
      {
        id: kept,
        name: "kept.png",
        projectId,
        scopeType: "Project",
        workspaceId,
      },
      {
        id: trashed,
        name: "trashed.png",
        projectId,
        scopeType: "Project",
        workspaceId,
      },
    ]);
    const record = await createRecord("Attachment row", [kept, trashed]);
    await db
      .update(fileAttachment)
      .set({ lifecycleStatus: "Trash" })
      .where(eq(fileAttachment.id, trashed));

    const feed = await feedAccess().feed(accountId, { projectId });

    expect(feed.rows.find(({ id }) => id === record.id)?.attachments).toEqual([
      { id: kept, name: "kept.png" },
    ]);
  });

  test("shows the Work created by Convert to Work as a related Work and hides it once it is in Trash", async () => {
    const db = requireDatabase();
    const access = feedAccess();
    const record = await createRecord("Convert me");
    const plan = await access.previewConvertToWork(accountId, {
      feedbackId: record.id,
      projectId,
      workType: "Task",
    });
    const conversion = await access.convertToWork(
      accountId,
      confirmation(plan, record.id),
    );

    const linked = await access.feed(accountId, { projectId });
    expect(linked.rows.find(({ id }) => id === record.id)?.related).toEqual([
      {
        id: conversion.origin.workId,
        projectId,
        title: `${conversion.origin.workKey} Convert me`,
        type: "Work",
      },
    ]);

    await db
      .update(work)
      .set({ trashedAt: new Date() })
      .where(eq(work.id, conversion.origin.workId));
    const trashedFeed = await access.feed(accountId, { projectId });
    expect(
      trashedFeed.rows.find(({ id }) => id === record.id)?.related,
    ).toEqual([]);
  });

  test("is owner scoped and stays readable but read-only on an archived Project", async () => {
    const db = requireDatabase();
    const access = feedAccess();
    const record = await createRecord("Archived Feed");

    await expect(
      access.feed(otherAccountId, { projectId }),
    ).rejects.toBeInstanceOf(FeedbackProjectNotFoundError);

    await db
      .update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, projectId));
    const feed = await access.feed(accountId, { projectId });
    expect(feed.readOnly).toBe(true);
    expect(feed.rows.map(({ id }) => id)).toEqual([record.id]);
  });

  test("never changes Feedback status or revision", async () => {
    const db = requireDatabase();
    const record = await createRecord("Unchanged by reading");
    const before = await db
      .select({ revision: feedback.revision, status: feedback.status })
      .from(feedback)
      .where(eq(feedback.id, record.id));

    await feedAccess().feed(accountId, {
      conditions: { status: "New" },
      projectId,
      sort: "Oldest first",
    });

    const after = await db
      .select({ revision: feedback.revision, status: feedback.status })
      .from(feedback)
      .where(eq(feedback.id, record.id));
    expect(after).toEqual(before);
  });
});
