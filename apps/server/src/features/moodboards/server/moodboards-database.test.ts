import {
  type AddMoodboardVisualInput,
  type CreateMoodboardInput,
  type Moodboard,
  newMoodboard,
  type UpdateMoodboardVisualCaptionInput,
  withAddedVisual,
  withVisualCaption,
} from "@cantiara/api/moodboards";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  fileAttachment,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import { usageLink } from "@cantiara/db/schema/relation";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { createDatabaseMoodboards } from "./moodboards-database";
import { createDatabaseMoodboardMutationContracts } from "./moodboards-mutation-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Moodboards PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `moodboard-${crypto.randomUUID()}`;
  const otherAccountId = `moodboard-other-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const otherWorkspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;
  const otherProjectId = `project-${crypto.randomUUID()}`;

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
  }

  function mutations() {
    return createDatabaseMoodboardMutationContracts(requireDatabase());
  }

  async function create(
    account: string,
    input: CreateMoodboardInput,
  ): Promise<Moodboard> {
    const key = crypto.randomUUID();
    const receipt = await mutations()
      .create(account)
      .mutate(
        {
          actor: { actorId: account, type: "User" },
          baseRevision: 0,
          clientIdempotencyKey: key,
          kind: "human",
          payload: input,
          targetId: key,
        },
        ({ currentRevision, payload }) =>
          newMoodboard({
            id: key,
            now: new Date().toISOString(),
            payload,
            revision: currentRevision + 1,
          }),
      );
    if (!receipt.nextValue.moodboard) {
      throw new Error("Moodboard was not created.");
    }
    return receipt.nextValue.moodboard;
  }

  async function addVisual(
    board: Moodboard,
    input: Omit<AddMoodboardVisualInput, "moodboardId">,
    key = crypto.randomUUID(),
    account = accountId,
  ): Promise<Moodboard> {
    const receipt = await mutations()
      .addVisual(account)
      .mutate(
        {
          actor: { actorId: account, type: "User" },
          baseRevision: board.revision,
          clientIdempotencyKey: key,
          kind: "human",
          payload: { ...input, moodboardId: board.id },
          targetId: board.id,
        },
        ({ currentRevision, currentValue, payload }) =>
          withAddedVisual(currentValue, {
            itemId: key,
            now: new Date().toISOString(),
            payload,
            revision: currentRevision + 1,
          }),
      );
    if (!receipt.nextValue.moodboard) {
      throw new Error("Moodboard is missing.");
    }
    return receipt.nextValue.moodboard;
  }

  async function updateCaption(
    board: Moodboard,
    input: Omit<UpdateMoodboardVisualCaptionInput, "moodboardId">,
  ): Promise<Moodboard> {
    const receipt = await mutations()
      .updateVisualCaption(accountId)
      .mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: board.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          kind: "human",
          payload: { ...input, moodboardId: board.id },
          targetId: board.id,
        },
        ({ currentRevision, currentValue, payload }) =>
          withVisualCaption(currentValue, {
            now: new Date().toISOString(),
            payload,
            revision: currentRevision + 1,
          }),
      );
    if (!receipt.nextValue.moodboard) {
      throw new Error("Moodboard is missing.");
    }
    return receipt.nextValue.moodboard;
  }

  async function insertVersion(
    attachmentId: string,
    versionId: string,
    version: number,
    mimeType: string,
  ) {
    await requireDatabase()
      .insert(fileAttachmentVersion)
      .values({
        attachmentId,
        byteSize: 10,
        contentHash: "a".repeat(64),
        detectedMimeType: mimeType,
        extension: mimeType === "image/png" ? ".png" : ".pdf",
        fileName: `file-${version}`,
        id: versionId,
        mimeType,
        objectKey: `objects/${versionId}`,
        version,
      });
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
        name: "Moodboards",
        shortCode: `MDB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
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

  test("keeps the exact File Attachment version and external-link origin across reads", async () => {
    const db = requireDatabase();
    const attachmentId = `attachment-${crypto.randomUUID()}`;
    const v1 = `version-${crypto.randomUUID()}`;
    const v2 = `version-${crypto.randomUUID()}`;
    await db.insert(fileAttachment).values({
      currentVersion: 2,
      id: attachmentId,
      name: "reference.png",
      projectId,
      scopeType: "Project",
      workspaceId,
    });
    await insertVersion(attachmentId, v1, 1, "image/png");
    await insertVersion(attachmentId, v2, 2, "image/png");

    const board = await create(accountId, { projectId, title: "Direction" });
    const withFile = await addVisual(board, {
      caption: "Older crop on purpose",
      origin: { attachmentVersionId: v1, kind: "File Attachment version" },
    });
    const withLink = await addVisual(withFile, {
      caption: null,
      origin: { kind: "External link", url: "https://example.com/ref?a=1&b=2" },
    });

    const access = createDatabaseMoodboards(db);
    const [read] = (await access.list(accountId, projectId)) ?? [];
    expect(
      read?.items.map(({ origin, caption }) => ({ caption, origin })),
    ).toEqual([
      {
        caption: "Older crop on purpose",
        origin: { attachmentVersionId: v1, kind: "File Attachment version" },
      },
      {
        caption: null,
        origin: {
          kind: "External link",
          url: "https://example.com/ref?a=1&b=2",
        },
      },
    ]);
    expect(read?.revision).toBe(withLink.revision);
    await expect(access.list(otherAccountId, projectId)).resolves.toBeNull();
    await expect(access.get(otherAccountId, board.id)).resolves.toBeNull();
  });

  test("rejects origins that are not an Active image File Attachment version of the same Project", async () => {
    const db = requireDatabase();
    const pdf = `attachment-${crypto.randomUUID()}`;
    const foreign = `attachment-${crypto.randomUUID()}`;
    const trashed = `attachment-${crypto.randomUUID()}`;
    await db.insert(fileAttachment).values([
      { id: pdf, name: "a.pdf", projectId, scopeType: "Project", workspaceId },
      {
        id: foreign,
        name: "b.png",
        projectId: otherProjectId,
        scopeType: "Project",
        workspaceId: otherWorkspaceId,
      },
      {
        id: trashed,
        lifecycleStatus: "Trash",
        name: "c.png",
        projectId,
        scopeType: "Project",
        workspaceId,
      },
    ]);
    const pdfVersion = `version-${crypto.randomUUID()}`;
    const foreignVersion = `version-${crypto.randomUUID()}`;
    const trashedVersion = `version-${crypto.randomUUID()}`;
    await insertVersion(pdf, pdfVersion, 1, "application/pdf");
    await insertVersion(foreign, foreignVersion, 1, "image/png");
    await insertVersion(trashed, trashedVersion, 1, "image/png");
    const board = await create(accountId, { projectId, title: "Direction" });

    await Promise.all(
      [pdfVersion, foreignVersion, trashedVersion, "missing-version"].map(
        (attachmentVersionId) =>
          expect(
            addVisual(board, {
              caption: null,
              origin: { attachmentVersionId, kind: "File Attachment version" },
            }),
          ).rejects.toMatchObject({ code: "MOODBOARD_ORIGIN_UNAVAILABLE" }),
      ),
    );
    const access = createDatabaseMoodboards(db);
    expect((await access.get(accountId, board.id))?.items).toEqual([]);
  });

  test("placing and editing a reference leaves the File Attachment and Wall-bound usage links untouched", async () => {
    const db = requireDatabase();
    const attachmentId = `attachment-${crypto.randomUUID()}`;
    const versionId = `version-${crypto.randomUUID()}`;
    await db.insert(fileAttachment).values({
      id: attachmentId,
      name: "reference.png",
      projectId,
      scopeType: "Project",
      workspaceId,
    });
    await insertVersion(attachmentId, versionId, 1, "image/png");
    const attachmentBefore = await db
      .select()
      .from(fileAttachment)
      .where(eq(fileAttachment.id, attachmentId));
    const versionsBefore = await db
      .select()
      .from(fileAttachmentVersion)
      .where(eq(fileAttachmentVersion.attachmentId, attachmentId));

    const board = await create(accountId, { projectId, title: "Direction" });
    const placed = await addVisual(board, {
      caption: "Why",
      origin: {
        attachmentVersionId: versionId,
        kind: "File Attachment version",
      },
    });
    const [visual] = placed.items;
    if (!visual) {
      throw new Error("Visual is missing.");
    }
    const edited = await updateCaption(placed, {
      caption: "Because",
      itemId: visual.id,
    });

    expect(edited.items[0]).toMatchObject({
      caption: "Because",
      origin: { attachmentVersionId: versionId },
    });
    expect(
      await db
        .select()
        .from(fileAttachment)
        .where(eq(fileAttachment.id, attachmentId)),
    ).toEqual(attachmentBefore);
    expect(
      await db
        .select()
        .from(fileAttachmentVersion)
        .where(eq(fileAttachmentVersion.attachmentId, attachmentId)),
    ).toEqual(versionsBefore);
    expect(
      await db
        .select()
        .from(usageLink)
        .where(eq(usageLink.workspaceId, workspaceId)),
    ).toEqual([]);
  });

  test("a stale revision conflicts and another account cannot create or edit in the Project", async () => {
    const board = await create(accountId, { projectId, title: "Direction" });
    await addVisual(board, {
      caption: null,
      origin: { kind: "External link", url: "https://example.com/a" },
    });

    await expect(
      addVisual(board, {
        caption: null,
        origin: { kind: "External link", url: "https://example.com/b" },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      create(otherAccountId, { projectId, title: "Not mine" }),
    ).rejects.toMatchObject({ code: expect.any(String) });
    await expect(
      addVisual(
        board,
        {
          caption: null,
          origin: { kind: "External link", url: "https://example.com/c" },
        },
        crypto.randomUUID(),
        otherAccountId,
      ),
    ).rejects.toMatchObject({ code: expect.any(String) });
  });
});
