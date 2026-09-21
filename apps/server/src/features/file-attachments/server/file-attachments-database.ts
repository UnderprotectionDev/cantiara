import {
  FILE_ATTACHMENT_QUOTA,
  FILE_ATTACHMENT_TYPE_RULES,
  type FileAttachment,
  type FileAttachmentFinalizeReceipt,
  type FileAttachmentQuota,
  type FileAttachmentScope,
  type FileAttachmentVersion,
  fileAttachmentFinalizeReceiptSchema,
  fileAttachmentQuotaSchema,
  fileAttachmentSchema,
  fileAttachmentVersionSchema,
} from "@cantiara/api/file-attachments";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  fileAttachment,
  fileAttachmentUpload,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import { and, asc, eq, lte, or, sql } from "drizzle-orm";

import {
  type FileAttachmentCommitInput,
  type FileAttachmentCommitResult,
  FileAttachmentError,
  type FileAttachmentRepository,
  type FileAttachmentStoredUpload,
} from "./file-attachments";

type FileAttachmentDatabaseRecord = typeof fileAttachment.$inferSelect;
type FileAttachmentVersionDatabaseRecord =
  typeof fileAttachmentVersion.$inferSelect;
type FileAttachmentUploadDatabaseRecord =
  typeof fileAttachmentUpload.$inferSelect;

function scopeFromColumns(record: {
  personalWikiId: string | null;
  projectId: string | null;
  scopeType: string;
}): FileAttachmentScope {
  if (record.scopeType === "Project" && record.projectId) {
    return { kind: "project", projectId: record.projectId };
  }
  if (record.scopeType === "Personal Wiki" && record.personalWikiId) {
    return { kind: "personalWiki", personalWikiId: record.personalWikiId };
  }
  throw new Error("File Attachment scope is invalid.");
}

function scopeColumns(scope: FileAttachmentScope | null | undefined): {
  personalWikiId: string | null;
  projectId: string | null;
  scopeType: "Personal Wiki" | "Project" | null;
} {
  if (!scope) {
    return {
      personalWikiId: null,
      projectId: null,
      scopeType: null,
    };
  }
  return scope.kind === "project"
    ? {
        personalWikiId: null,
        projectId: scope.projectId,
        scopeType: "Project" as const,
      }
    : {
        personalWikiId: scope.personalWikiId,
        projectId: null,
        scopeType: "Personal Wiki" as const,
      };
}

function requiredScopeColumns(scope: FileAttachmentScope): {
  personalWikiId: string | null;
  projectId: string | null;
  scopeType: "Personal Wiki" | "Project";
} {
  return scope.kind === "project"
    ? {
        personalWikiId: null,
        projectId: scope.projectId,
        scopeType: "Project",
      }
    : {
        personalWikiId: scope.personalWikiId,
        projectId: null,
        scopeType: "Personal Wiki",
      };
}

function previewForExtension(
  extension: string,
): FileAttachmentVersion["preview"] {
  for (const rule of Object.values(FILE_ATTACHMENT_TYPE_RULES)) {
    if (rule.extensions.includes(extension)) {
      return rule.preview;
    }
  }
  return "download";
}

function toVersion(
  record: FileAttachmentVersionDatabaseRecord,
): FileAttachmentVersion {
  return fileAttachmentVersionSchema.parse({
    byteSize: Number(record.byteSize),
    contentHash: record.contentHash,
    createdAt: record.createdAt.toISOString(),
    detectedMimeType: record.detectedMimeType,
    extension: record.extension,
    fileName: record.fileName,
    id: record.id,
    mimeType: record.mimeType,
    number: record.version,
    preview: previewForExtension(record.extension),
  });
}

function toAttachment(
  record: FileAttachmentDatabaseRecord,
  version: FileAttachmentVersionDatabaseRecord,
): FileAttachment {
  return fileAttachmentSchema.parse({
    createdAt: record.createdAt.toISOString(),
    currentVersion: toVersion(version),
    id: record.id,
    lifecycleStatus: record.lifecycleStatus,
    name: record.name,
    revision: record.revision,
    scope: scopeFromColumns(record),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toReceipt(result: FileAttachmentFinalizeReceipt) {
  return fileAttachmentFinalizeReceiptSchema.parse(result);
}

function toStoredUpload(
  record: FileAttachmentUploadDatabaseRecord,
): FileAttachmentStoredUpload {
  const scope =
    record.scopeType === null
      ? null
      : scopeFromColumns({
          personalWikiId: record.personalWikiId,
          projectId: record.projectId,
          scopeType: record.scopeType,
        });
  const result = record.result
    ? fileAttachmentFinalizeReceiptSchema.parse(record.result)
    : null;
  return {
    accountId: record.accountId,
    attachmentId: record.attachmentId,
    baseRevision: record.baseRevision,
    clientIdempotencyKey: record.clientIdempotencyKey,
    declaredMimeType: record.declaredMimeType,
    error: record.error,
    expiresAt: record.expiresAt,
    fileName: record.fileName,
    id: record.id,
    mode: record.mode as "new" | "new-version",
    payloadFingerprint: record.payloadFingerprint,
    result,
    scope,
    status: record.status as FileAttachmentStoredUpload["status"],
    temporaryObjectKey: record.temporaryObjectKey,
    workspaceId: record.workspaceId,
  };
}

async function workspaceIdFor(
  database: Pick<Database, "select">,
  accountId: string,
) {
  const [record] = await database
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return record?.id ?? null;
}

function quotaFromUsage(bytesUsed: number, versionsUsed: number) {
  const quota: FileAttachmentQuota = {
    byteLimit: FILE_ATTACHMENT_QUOTA.maxBytes,
    bytesRemaining: Math.max(0, FILE_ATTACHMENT_QUOTA.maxBytes - bytesUsed),
    bytesUsed,
    isOverLimit:
      bytesUsed > FILE_ATTACHMENT_QUOTA.maxBytes ||
      versionsUsed > FILE_ATTACHMENT_QUOTA.maxVersions,
    isWarning:
      bytesUsed >=
        FILE_ATTACHMENT_QUOTA.maxBytes * FILE_ATTACHMENT_QUOTA.warningRatio ||
      versionsUsed >=
        FILE_ATTACHMENT_QUOTA.maxVersions * FILE_ATTACHMENT_QUOTA.warningRatio,
    versionLimit: FILE_ATTACHMENT_QUOTA.maxVersions,
    versionsRemaining: Math.max(
      0,
      FILE_ATTACHMENT_QUOTA.maxVersions - versionsUsed,
    ),
    versionsUsed,
  };
  return fileAttachmentQuotaSchema.parse(quota);
}

function ensureQuota(
  bytesUsed: number,
  versionsUsed: number,
  addedBytes: number,
) {
  if (
    bytesUsed + addedBytes > FILE_ATTACHMENT_QUOTA.maxBytes ||
    versionsUsed + 1 > FILE_ATTACHMENT_QUOTA.maxVersions
  ) {
    throw new FileAttachmentError(
      "FILE_ATTACHMENT_QUOTA_EXCEEDED",
      "Workspace File Attachment quota has been exceeded.",
    );
  }
}

export function createDatabaseFileAttachments(
  database: Database,
): FileAttachmentRepository {
  const repository: FileAttachmentRepository = {
    async clearTemporaryObject(uploadId) {
      await database
        .update(fileAttachmentUpload)
        .set({ temporaryObjectKey: null })
        .where(eq(fileAttachmentUpload.id, uploadId));
    },

    commitUpload(input: FileAttachmentCommitInput) {
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The finalize transaction keeps quota, target, version, and idempotency writes atomic.
      return database.transaction(async (transaction) => {
        const [uploadRecord] = await transaction
          .select()
          .from(fileAttachmentUpload)
          .where(
            and(
              eq(fileAttachmentUpload.id, input.uploadId),
              eq(fileAttachmentUpload.accountId, input.accountId),
            ),
          )
          .limit(1)
          .for("update");
        if (!uploadRecord) {
          throw new FileAttachmentError(
            "FILE_ATTACHMENT_UPLOAD_NOT_FOUND",
            "The upload is unavailable.",
          );
        }
        if (uploadRecord.status === "committed" && uploadRecord.result) {
          throw new FileAttachmentError(
            "FILE_ATTACHMENT_UPLOAD_REJECTED",
            "The upload was already finalized.",
          );
        }
        if (uploadRecord.status !== "staged") {
          throw new FileAttachmentError(
            "FILE_ATTACHMENT_UPLOAD_REJECTED",
            "The upload is no longer available for finalization.",
          );
        }

        await transaction
          .select({ id: workspace.id })
          .from(workspace)
          .where(eq(workspace.id, input.workspaceId))
          .limit(1)
          .for("update");

        const [usage] = await transaction
          .select({
            bytesUsed: sql<number>`coalesce(sum(${fileAttachmentVersion.byteSize}), 0)`,
            versionsUsed: sql<number>`count(${fileAttachmentVersion.id})`,
          })
          .from(fileAttachmentVersion)
          .innerJoin(
            fileAttachment,
            eq(fileAttachment.id, fileAttachmentVersion.attachmentId),
          )
          .where(eq(fileAttachment.workspaceId, input.workspaceId));
        ensureQuota(
          Number(usage?.bytesUsed ?? 0),
          Number(usage?.versionsUsed ?? 0),
          input.validated.byteSize,
        );

        let attachmentRecord: FileAttachmentDatabaseRecord;
        let versionNumber: number;
        if (input.mode === "new") {
          if (!input.scope) {
            throw new FileAttachmentError(
              "FILE_ATTACHMENT_TARGET_NOT_FOUND",
              "A new File Attachment requires a Project or Personal Wiki.",
            );
          }
          if (input.scope.kind === "project") {
            const [ownedProject] = await transaction
              .select({ id: project.id })
              .from(project)
              .where(
                and(
                  eq(project.id, input.scope.projectId),
                  eq(project.workspaceId, input.workspaceId),
                ),
              )
              .limit(1);
            if (!ownedProject) {
              throw new FileAttachmentError(
                "FILE_ATTACHMENT_TARGET_NOT_FOUND",
                "Project is unavailable.",
              );
            }
          } else if (input.scope.personalWikiId !== input.accountId) {
            throw new FileAttachmentError(
              "FILE_ATTACHMENT_TARGET_NOT_FOUND",
              "Personal Wiki is unavailable.",
            );
          }
          const [inserted] = await transaction
            .insert(fileAttachment)
            .values({
              currentVersion: 1,
              id: input.attachmentId,
              lifecycleStatus: "Active",
              name: input.fileName,
              revision: 0,
              ...requiredScopeColumns(input.scope),
              updatedAt: input.now,
              workspaceId: input.workspaceId,
            })
            .returning();
          if (!inserted) {
            throw new FileAttachmentError(
              "FILE_ATTACHMENT_TARGET_NOT_FOUND",
              "File Attachment could not be created.",
            );
          }
          attachmentRecord = inserted;
          versionNumber = 1;
        } else {
          const [existing] = await transaction
            .select()
            .from(fileAttachment)
            .where(
              and(
                eq(fileAttachment.id, input.attachmentId),
                eq(fileAttachment.workspaceId, input.workspaceId),
              ),
            )
            .limit(1)
            .for("update");
          if (!existing) {
            throw new FileAttachmentError(
              "FILE_ATTACHMENT_TARGET_NOT_FOUND",
              "File Attachment is unavailable.",
            );
          }
          if (
            input.baseRevision !== null &&
            input.baseRevision !== existing.revision
          ) {
            throw new FileAttachmentError(
              "FILE_ATTACHMENT_REVISION_CONFLICT",
              "File Attachment changed. Reload and try again.",
            );
          }
          if (
            input.scope &&
            JSON.stringify(scopeFromColumns(existing)) !==
              JSON.stringify(input.scope)
          ) {
            throw new FileAttachmentError(
              "FILE_ATTACHMENT_TARGET_NOT_FOUND",
              "File Attachment scope changed. Reload and try again.",
            );
          }
          versionNumber = existing.currentVersion + 1;
          const [updated] = await transaction
            .update(fileAttachment)
            .set({
              currentVersion: versionNumber,
              name: input.fileName,
              revision: existing.revision + 1,
              updatedAt: input.now,
            })
            .where(eq(fileAttachment.id, existing.id))
            .returning();
          if (!updated) {
            throw new FileAttachmentError(
              "FILE_ATTACHMENT_TARGET_NOT_FOUND",
              "File Attachment could not be updated.",
            );
          }
          attachmentRecord = updated;
        }

        const [versionRecord] = await transaction
          .insert(fileAttachmentVersion)
          .values({
            attachmentId: input.attachmentId,
            byteSize: input.validated.byteSize,
            contentHash: input.validated.contentHash,
            createdAt: input.now,
            detectedMimeType: input.validated.detectedMimeType,
            extension: input.validated.extension,
            fileName: input.validated.fileName,
            id: input.versionId,
            mimeType: input.validated.mimeType,
            objectKey: input.permanentObjectKey,
            version: versionNumber,
          })
          .returning();
        if (!versionRecord) {
          throw new FileAttachmentError(
            "FILE_ATTACHMENT_TARGET_NOT_FOUND",
            "File Attachment version could not be created.",
          );
        }

        const version = toVersion(versionRecord);
        const attachment = toAttachment(attachmentRecord, versionRecord);
        const receipt = toReceipt({
          attachment,
          idempotent: false,
          status: "committed",
          version,
        });
        await transaction
          .update(fileAttachmentUpload)
          .set({
            completedAt: input.now,
            result: receipt,
            status: "committed",
          })
          .where(eq(fileAttachmentUpload.id, input.uploadId));
        return {
          attachment,
          version,
        } satisfies FileAttachmentCommitResult;
      });
    },

    async findExpiredUploads(now) {
      const records = await database
        .select()
        .from(fileAttachmentUpload)
        .where(
          and(
            lte(fileAttachmentUpload.expiresAt, now),
            or(
              eq(fileAttachmentUpload.status, "staged"),
              eq(fileAttachmentUpload.status, "rejected"),
              eq(fileAttachmentUpload.status, "committed"),
            ),
          ),
        );
      return records.map(toStoredUpload);
    },

    async findUpload(accountId, clientIdempotencyKey) {
      const [record] = await database
        .select()
        .from(fileAttachmentUpload)
        .where(
          and(
            eq(fileAttachmentUpload.accountId, accountId),
            eq(fileAttachmentUpload.clientIdempotencyKey, clientIdempotencyKey),
          ),
        )
        .limit(1);
      return record ? toStoredUpload(record) : null;
    },

    findWorkspaceId(accountId) {
      return workspaceIdFor(database, accountId);
    },

    async getQuota(accountId) {
      const workspaceId = await workspaceIdFor(database, accountId);
      if (!workspaceId) {
        throw new FileAttachmentError(
          "FILE_ATTACHMENT_ACCOUNT_NOT_FOUND",
          "Workspace is unavailable.",
        );
      }
      const [usage] = await database
        .select({
          bytesUsed: sql<number>`coalesce(sum(${fileAttachmentVersion.byteSize}), 0)`,
          versionsUsed: sql<number>`count(${fileAttachmentVersion.id})`,
        })
        .from(fileAttachmentVersion)
        .innerJoin(
          fileAttachment,
          eq(fileAttachment.id, fileAttachmentVersion.attachmentId),
        )
        .where(eq(fileAttachment.workspaceId, workspaceId));
      return quotaFromUsage(
        Number(usage?.bytesUsed ?? 0),
        Number(usage?.versionsUsed ?? 0),
      );
    },

    async insertUpload(input) {
      const scope = scopeColumns(input.scope);
      await database.insert(fileAttachmentUpload).values({
        accountId: input.accountId,
        attachmentId: input.attachmentId,
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        declaredMimeType: input.declaredMimeType,
        error: input.error,
        expiresAt: input.expiresAt,
        fileName: input.fileName,
        id: input.id,
        mode: input.mode,
        payloadFingerprint: input.payloadFingerprint,
        ...scope,
        status: input.status,
        temporaryObjectKey: input.temporaryObjectKey,
        workspaceId: input.workspaceId,
      });
    },

    async list(accountId, scope) {
      const workspaceId = await workspaceIdFor(database, accountId);
      if (!workspaceId) {
        return [];
      }
      const conditions = [eq(fileAttachment.workspaceId, workspaceId)];
      if (scope) {
        if (scope.kind === "project") {
          conditions.push(eq(fileAttachment.projectId, scope.projectId));
        } else {
          conditions.push(
            eq(fileAttachment.personalWikiId, scope.personalWikiId),
          );
        }
      }
      const records = await database
        .select({ attachment: fileAttachment, version: fileAttachmentVersion })
        .from(fileAttachment)
        .innerJoin(
          fileAttachmentVersion,
          and(
            eq(fileAttachmentVersion.attachmentId, fileAttachment.id),
            eq(fileAttachmentVersion.version, fileAttachment.currentVersion),
          ),
        )
        .where(and(...conditions))
        .orderBy(asc(fileAttachment.createdAt));
      return records.map(({ attachment, version }) =>
        toAttachment(attachment, version),
      );
    },

    async markUploadRejected(uploadId, error) {
      await database
        .update(fileAttachmentUpload)
        .set({ completedAt: new Date(), error, status: "rejected" })
        .where(eq(fileAttachmentUpload.id, uploadId));
    },

    async markUploadSwept(uploadId) {
      await database
        .update(fileAttachmentUpload)
        .set({
          completedAt: new Date(),
          status: "swept",
          temporaryObjectKey: null,
        })
        .where(eq(fileAttachmentUpload.id, uploadId));
    },
  };

  return repository;
}
