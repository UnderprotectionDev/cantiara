import { createDb, type Database } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  fileAttachmentUpload,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import { and, eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import type {
  FileAttachmentCommitInput,
  FileAttachmentStoredUpload,
  ValidatedFileAttachmentUpload,
} from "./file-attachments";
import { createDatabaseFileAttachments } from "./file-attachments-database";

const databaseUrl = process.env.FILE_ATTACHMENTS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

const NOW = new Date("2026-09-21T10:00:00.000Z");
const EXPIRES_AT = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);

const validatedUpload: ValidatedFileAttachmentUpload = {
  byteSize: 10,
  contentHash: "a".repeat(64),
  detectedMimeType: "image/jpeg",
  extension: ".jpg",
  fileName: "screen.jpg",
  mimeType: "image/jpeg",
  preview: "image",
  type: "image",
};

interface WorkspaceFixture {
  accountId: string;
  projectId: string;
  workspaceId: string;
}

async function seedWorkspace(database: Database): Promise<WorkspaceFixture> {
  const accountId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  await database.insert(user).values({
    id: accountId,
    name: "Founder",
    email: `${accountId}@example.invalid`,
  });
  await database
    .insert(workspace)
    .values({ id: workspaceId, ownerAccountId: accountId });
  await database.insert(project).values({
    id: projectId,
    name: "Files",
    shortCode: "FILE",
    starterConfiguration: "Blank Project",
    workspaceId,
  });
  return { accountId, projectId, workspaceId };
}

function stagedUpload(
  fixture: WorkspaceFixture,
  overrides: Partial<FileAttachmentStoredUpload>,
): FileAttachmentStoredUpload {
  return {
    accountId: fixture.accountId,
    attachmentId: null,
    baseRevision: null,
    clientIdempotencyKey: "key-1",
    declaredMimeType: "image/jpeg",
    error: null,
    expiresAt: EXPIRES_AT,
    fileName: "screen.jpg",
    id: "upload-1",
    mode: "new",
    payloadFingerprint: "b".repeat(64),
    result: null,
    scope: { kind: "project", projectId: fixture.projectId },
    status: "staged",
    temporaryObjectKey: `file-attachments-temporary/${fixture.accountId}/upload-1`,
    workspaceId: fixture.workspaceId,
    ...overrides,
  };
}

function commitInput(
  fixture: WorkspaceFixture,
  overrides: Partial<FileAttachmentCommitInput>,
): FileAttachmentCommitInput {
  return {
    accountId: fixture.accountId,
    attachmentId: "attachment-1",
    baseRevision: null,
    fileName: "screen.jpg",
    mode: "new",
    now: NOW,
    permanentObjectKey: `file-attachments/${fixture.workspaceId}/attachment-1/version-1`,
    scope: { kind: "project", projectId: fixture.projectId },
    uploadId: "upload-1",
    validated: validatedUpload,
    versionId: "version-1",
    workspaceId: fixture.workspaceId,
    ...overrides,
  };
}

describeDatabase("File Attachments PostgreSQL repository", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  let fixture: WorkspaceFixture;

  beforeAll(() => {
    if (!database) {
      throw new Error("FILE_ATTACHMENTS_DATABASE_URL is required");
    }
  });

  beforeEach(async () => {
    if (!database) {
      throw new Error("FILE_ATTACHMENTS_DATABASE_URL is required");
    }
    fixture = await seedWorkspace(database);
  });

  afterEach(async () => {
    if (!database) {
      return;
    }
    // Cascades to the workspace, projects, attachments, versions, and uploads.
    await database.delete(user).where(eq(user.id, fixture.accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("commits a new attachment, version, and receipt in one transaction", async () => {
    if (!database) {
      throw new Error("FILE_ATTACHMENTS_DATABASE_URL is required");
    }
    const repository = createDatabaseFileAttachments(database);
    await repository.insertUpload(stagedUpload(fixture, {}));

    const { attachment, version } = await repository.commitUpload(
      commitInput(fixture, {}),
    );

    expect(attachment).toMatchObject({
      id: "attachment-1",
      lifecycleStatus: "Active",
      name: "screen.jpg",
      revision: 0,
      scope: { kind: "project", projectId: fixture.projectId },
    });
    expect(version).toMatchObject({
      byteSize: 10,
      extension: ".jpg",
      id: "version-1",
      number: 1,
      preview: "image",
    });

    const upload = await repository.findUpload(fixture.accountId, "key-1");
    expect(upload?.status).toBe("committed");
    expect(upload?.result).toMatchObject({
      status: "committed",
      idempotent: false,
    });

    const quota = await repository.getQuota(fixture.accountId);
    expect(quota.bytesUsed).toBe(10);
    expect(quota.versionsUsed).toBe(1);

    const attachments = await repository.list(fixture.accountId, {
      kind: "project",
      projectId: fixture.projectId,
    });
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.currentVersion).toMatchObject({ id: "version-1" });
  });

  test("rolls back a failed Capture promotion without leaving its upload", async () => {
    if (!database) {
      throw new Error("FILE_ATTACHMENTS_DATABASE_URL is required");
    }
    const repository = createDatabaseFileAttachments(database);
    await repository.insertUpload(stagedUpload(fixture, {}));
    const committed = await repository.commitUpload(commitInput(fixture, {}));

    await repository.rollbackCapturePromotion({
      accountId: fixture.accountId,
      attachmentId: committed.attachment.id,
      uploadId: "upload-1",
      versionId: committed.version.id,
    });

    await expect(
      repository.list(fixture.accountId, {
        kind: "project",
        projectId: fixture.projectId,
      }),
    ).resolves.toHaveLength(0);
    await expect(
      repository.findUpload(fixture.accountId, "key-1"),
    ).resolves.toBeNull();
    const versions = await database
      .select({ id: fileAttachmentVersion.id })
      .from(fileAttachmentVersion)
      .where(eq(fileAttachmentVersion.attachmentId, committed.attachment.id));
    expect(versions).toHaveLength(0);
  });

  test("rejects a stale base revision without appending a version", async () => {
    if (!database) {
      throw new Error("FILE_ATTACHMENTS_DATABASE_URL is required");
    }
    const repository = createDatabaseFileAttachments(database);
    await repository.insertUpload(stagedUpload(fixture, {}));
    await repository.commitUpload(commitInput(fixture, {}));

    await repository.insertUpload(
      stagedUpload(fixture, {
        attachmentId: "attachment-1",
        baseRevision: 5,
        clientIdempotencyKey: "key-2",
        id: "upload-2",
        mode: "new-version",
        scope: null,
        temporaryObjectKey: `file-attachments-temporary/${fixture.accountId}/upload-2`,
      }),
    );

    await expect(
      repository.commitUpload(
        commitInput(fixture, {
          attachmentId: "attachment-1",
          baseRevision: 5,
          mode: "new-version",
          permanentObjectKey: `file-attachments/${fixture.workspaceId}/attachment-1/version-2`,
          scope: null,
          uploadId: "upload-2",
          versionId: "version-2",
        }),
      ),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_REVISION_CONFLICT" });

    const versions = await database
      .select({ id: fileAttachmentVersion.id })
      .from(fileAttachmentVersion)
      .where(eq(fileAttachmentVersion.attachmentId, "attachment-1"));
    expect(versions).toHaveLength(1);
  });

  test("rejects a new attachment whose Project belongs to another Workspace", async () => {
    if (!database) {
      throw new Error("FILE_ATTACHMENTS_DATABASE_URL is required");
    }
    const repository = createDatabaseFileAttachments(database);
    await repository.insertUpload(stagedUpload(fixture, {}));

    await expect(
      repository.commitUpload(
        commitInput(fixture, {
          scope: { kind: "project", projectId: crypto.randomUUID() },
        }),
      ),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_TARGET_NOT_FOUND" });

    const uploads = await database
      .select({ status: fileAttachmentUpload.status })
      .from(fileAttachmentUpload)
      .where(eq(fileAttachmentUpload.id, "upload-1"));
    expect(uploads[0]?.status).toBe("staged");
  });

  test("returns only expired staged, rejected, and committed uploads for the sweep", async () => {
    if (!database) {
      throw new Error("FILE_ATTACHMENTS_DATABASE_URL is required");
    }
    const repository = createDatabaseFileAttachments(database);
    const past = new Date(NOW.getTime() - 1000);
    await repository.insertUpload(stagedUpload(fixture, {}));
    const committed = await repository.commitUpload(commitInput(fixture, {}));
    expect(committed.attachment.id).toBe("attachment-1");
    await database
      .update(fileAttachmentUpload)
      .set({ expiresAt: past })
      .where(eq(fileAttachmentUpload.id, "upload-1"));

    await repository.insertUpload(
      stagedUpload(fixture, {
        clientIdempotencyKey: "key-2",
        expiresAt: past,
        id: "upload-staged-expired",
      }),
    );
    await repository.insertUpload(
      stagedUpload(fixture, {
        clientIdempotencyKey: "key-3",
        error: { code: "FILE_ATTACHMENT_MIME_MISMATCH", message: "mismatch" },
        expiresAt: past,
        id: "upload-rejected-expired",
        status: "rejected",
      }),
    );
    await repository.insertUpload(
      stagedUpload(fixture, {
        clientIdempotencyKey: "key-4",
        expiresAt: past,
        id: "upload-swept-expired",
        status: "swept",
      }),
    );
    await repository.insertUpload(
      stagedUpload(fixture, {
        clientIdempotencyKey: "key-5",
        id: "upload-staged-fresh",
      }),
    );

    const expired = await repository.findExpiredUploads(NOW);

    expect(expired.map((upload) => upload.id).sort()).toEqual([
      "upload-1",
      "upload-rejected-expired",
      "upload-staged-expired",
    ]);
  });

  test("records rejections and sweeps with the provided clock", async () => {
    if (!database) {
      throw new Error("FILE_ATTACHMENTS_DATABASE_URL is required");
    }
    const repository = createDatabaseFileAttachments(database);
    await repository.insertUpload(stagedUpload(fixture, {}));
    await repository.insertUpload(
      stagedUpload(fixture, {
        clientIdempotencyKey: "key-2",
        id: "upload-2",
        temporaryObjectKey: `file-attachments-temporary/${fixture.accountId}/upload-2`,
      }),
    );
    const rejectedAt = new Date("2026-09-21T11:00:00.000Z");
    const sweptAt = new Date("2026-09-21T12:00:00.000Z");

    await repository.markUploadRejected(
      "upload-1",
      { code: "FILE_ATTACHMENT_MIME_MISMATCH", message: "mismatch" },
      rejectedAt,
    );
    await repository.markUploadSwept("upload-2", sweptAt);

    const [rejected] = await database
      .select()
      .from(fileAttachmentUpload)
      .where(
        and(
          eq(fileAttachmentUpload.id, "upload-1"),
          eq(fileAttachmentUpload.accountId, fixture.accountId),
        ),
      );
    expect(rejected?.status).toBe("rejected");
    expect(rejected?.completedAt?.toISOString()).toBe(rejectedAt.toISOString());
    expect(rejected?.error).toEqual({
      code: "FILE_ATTACHMENT_MIME_MISMATCH",
      message: "mismatch",
    });

    const [swept] = await database
      .select()
      .from(fileAttachmentUpload)
      .where(eq(fileAttachmentUpload.id, "upload-2"));
    expect(swept?.status).toBe("swept");
    expect(swept?.completedAt?.toISOString()).toBe(sweptAt.toISOString());
    expect(swept?.temporaryObjectKey).toBeNull();
  });
});
