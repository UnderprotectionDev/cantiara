import type { DocumentsAccess } from "@cantiara/api/documents";
import type { FileAttachmentAccess } from "@cantiara/api/file-attachments";
import type { ProjectSourceRecordsAccess } from "@cantiara/api/project-source-records";
import type { SmartCollectionsAccess } from "@cantiara/api/smart-collections";
import type { TechnicalDiagramsAccess } from "@cantiara/api/technical-diagrams";
import type {
  WikiDocumentSnapshot,
  WikiPublishingAccess,
} from "@cantiara/api/wiki-publishing";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
} from "@cantiara/db/schema/external-surface";
import {
  fileAttachment,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import { usageLink } from "@cantiara/db/schema/relation";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  createWikiPublishing,
  type WikiPublishingFacts,
  type WikiPublishingStore,
  type WikiSourceDocument,
  type WikiSourceRecord,
} from "./wiki-publishing";
import type {
  WikiPublicAssetSource,
  WikiPublicSnapshotReader,
} from "./wiki-publishing-http";

/** The owners this seam reads; injected so no feature imports another's server code. */
export interface WikiPublishingSources {
  documents: DocumentsAccess;
  projectSourceRecords: ProjectSourceRecordsAccess;
  smartCollections: SmartCollectionsAccess;
  technicalDiagrams: TechnicalDiagramsAccess;
}

type DocumentRow = typeof document.$inferSelect;

function titleRecord(
  recordType: string,
  recordId: string,
  title: string,
  version: number | null,
): WikiSourceRecord {
  return {
    fields: [{ name: "Title", value: title }],
    recordId,
    recordType,
    title,
    version,
  };
}

function toSourceDocument(row: DocumentRow): WikiSourceDocument {
  return {
    body: row.body,
    fields: [
      { name: "Title", value: row.title },
      { name: "Body", value: row.body },
    ],
    recordId: row.id,
    recordType: "Document",
    title: row.title,
    version: row.revision,
    workspaceId: row.workspaceId ?? "",
  };
}

function createFacts(
  database: Database,
  sources: WikiPublishingSources,
): WikiPublishingFacts {
  async function workspaceOf(accountId: string) {
    const [row] = await database
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.ownerAccountId, accountId))
      .limit(1);
    return row?.id ?? null;
  }

  async function wikiDocument(accountId: string, documentId: string) {
    const workspaceId = await workspaceOf(accountId);
    if (!workspaceId) {
      return null;
    }
    const [row] = await database
      .select()
      .from(document)
      .where(
        and(
          eq(document.id, documentId),
          eq(document.workspaceId, workspaceId),
          isNull(document.projectId),
        ),
      )
      .limit(1);
    return row ? { row, workspaceId } : null;
  }

  return {
    attachments: async (accountId, documentId) => {
      const found = await wikiDocument(accountId, documentId);
      if (!found) {
        return [];
      }
      const rows = await database
        .select()
        .from(fileAttachment)
        .where(
          and(
            eq(fileAttachment.workspaceId, found.workspaceId),
            eq(fileAttachment.ownerDocumentId, documentId),
            eq(fileAttachment.personalWikiId, accountId),
            eq(fileAttachment.lifecycleStatus, "Active"),
          ),
        )
        .orderBy(asc(fileAttachment.id));
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        version: row.currentVersion,
      }));
    },

    backlinks: async (accountId, documentId) => {
      const found = await wikiDocument(accountId, documentId);
      if (!found) {
        return [];
      }
      const links = await database
        .select({ surfaceRecordId: usageLink.surfaceRecordId })
        .from(usageLink)
        .where(
          and(
            eq(usageLink.workspaceId, found.workspaceId),
            eq(usageLink.sourceRecordType, "Document"),
            eq(usageLink.sourceRecordId, documentId),
            eq(usageLink.surfaceRecordType, "Document"),
            eq(usageLink.kind, "Inline reference"),
          ),
        );
      const ids = [...new Set(links.map((link) => link.surfaceRecordId))];
      if (ids.length === 0) {
        return [];
      }
      const rows = await database
        .select()
        .from(document)
        .where(
          and(
            inArray(document.id, ids),
            eq(document.workspaceId, found.workspaceId),
            isNull(document.projectId),
            isNull(document.archivedAt),
          ),
        )
        .orderBy(asc(document.id));
      return rows.map((row) =>
        titleRecord("Document", row.id, row.title, row.revision),
      );
    },

    childDocuments: async (accountId, documentId) => {
      const found = await wikiDocument(accountId, documentId);
      if (!found) {
        return [];
      }
      const rows = await database
        .select()
        .from(document)
        .where(
          and(
            eq(document.parentDocumentId, documentId),
            eq(document.workspaceId, found.workspaceId),
            isNull(document.archivedAt),
          ),
        )
        .orderBy(asc(document.id));
      return rows.map(toSourceDocument);
    },

    document: async (accountId, documentId) => {
      const found = await wikiDocument(accountId, documentId);
      return found ? toSourceDocument(found.row) : null;
    },

    liveSource: async (accountId, directive) => {
      switch (directive.kind) {
        case "Work": {
          const work = await sources.documents.getLiveWork(
            accountId,
            directive.id,
          );
          return work
            ? {
                ...titleRecord(
                  "Work",
                  work.id,
                  `${work.key} · ${work.title}`,
                  null,
                ),
                fields: [
                  { name: "Key", value: work.key },
                  { name: "Title", value: work.title },
                  { name: "Status", value: work.status },
                ],
                sourceLabel: `Work ${work.key}`,
              }
            : null;
        }
        case "Document section": {
          const section = await sources.documents.getLiveSection?.(
            accountId,
            directive.id,
            directive.sectionId ?? "",
          );
          return section
            ? {
                fields: [
                  { name: "Heading", value: section.heading },
                  { name: "Text", value: section.text },
                ],
                recordId: section.documentId,
                recordType: "Document section",
                sourceLabel: `${section.title} / ${section.heading}`,
                title: section.heading,
                version: null,
              }
            : null;
        }
        case "Smart Collection": {
          const view = await sources.smartCollections.getView(
            accountId,
            directive.id,
            { readOnly: true },
          );
          return view
            ? {
                fields: [
                  ...view.works.map((work) => ({
                    name: `Work ${work.key}`,
                    value: `${work.title} (${work.status})`,
                  })),
                  ...view.projectSourceRecords.map((record) => ({
                    name: `${record.sourceType} ${record.id}`,
                    value: `${record.title} (${record.status})`,
                  })),
                ],
                recordId: view.id,
                recordType: "Smart Collection",
                sourceLabel: `${view.name} view`,
                title: view.name,
                version: null,
              }
            : null;
        }
        default: {
          const diagram = await sources.technicalDiagrams.get(
            accountId,
            directive.id,
            directive.viewId,
          );
          return diagram
            ? {
                ...titleRecord(
                  "Technical Diagram",
                  diagram.id,
                  diagram.title,
                  diagram.revision,
                ),
                sourceLabel: diagram.title,
              }
            : null;
        }
      }
    },

    referenced: async (accountId, reference) => {
      switch (reference.recordType) {
        case "Document": {
          const record = await sources.documents.get(
            accountId,
            reference.recordId,
          );
          return record
            ? titleRecord("Document", record.id, record.title, record.revision)
            : null;
        }
        case "Work": {
          const work = await sources.documents.getLiveWork(
            accountId,
            reference.recordId,
          );
          return work
            ? titleRecord("Work", work.id, `${work.key} · ${work.title}`, null)
            : null;
        }
        case "Technical Diagram": {
          const diagram = await sources.technicalDiagrams.get(
            accountId,
            reference.recordId,
          );
          return diagram
            ? titleRecord(
                "Technical Diagram",
                diagram.id,
                diagram.title,
                diagram.revision,
              )
            : null;
        }
        case "Decision":
        case "Risk":
        case "Assumption":
        case "Open Question":
        case "Milestone":
        case "Project Release":
        case "Production Incident": {
          const record = await sources.projectSourceRecords.find(
            accountId,
            reference.recordType,
            reference.recordId,
          );
          if (!record) {
            return null;
          }
          return titleRecord(
            reference.recordType,
            record.id,
            "name" in record ? record.name : record.title,
            null,
          );
        }
        default:
          return null;
      }
    },
  };
}

const activeWikiSurface = (workspaceId: string, documentId: string) =>
  and(
    eq(externalSurface.workspaceId, workspaceId),
    eq(externalSurface.documentId, documentId),
    isNull(externalSurface.projectId),
    isNull(externalSurface.cancelledAt),
    sql`exists (select 1 from ${externalSurfaceSnapshotRevision} r where r.surface_id = ${externalSurface.id} and r.snapshot ->> 'kind' = 'Wiki Document')`,
  );

function createStore(database: Database): WikiPublishingStore {
  return {
    active: async (workspaceId, documentId) => {
      const [surface] = await database
        .select({
          id: externalSurface.id,
          indexingEnabled: externalSurface.indexingEnabled,
        })
        .from(externalSurface)
        .where(activeWikiSurface(workspaceId, documentId))
        .limit(1);
      if (!surface) {
        return null;
      }
      const [latest] = await database
        .select({
          revision: externalSurfaceSnapshotRevision.revision,
          snapshot: externalSurfaceSnapshotRevision.snapshot,
        })
        .from(externalSurfaceSnapshotRevision)
        .where(eq(externalSurfaceSnapshotRevision.surfaceId, surface.id))
        .orderBy(desc(externalSurfaceSnapshotRevision.revision))
        .limit(1);
      const snapshot = latest?.snapshot as WikiDocumentSnapshot | undefined;
      return latest && snapshot
        ? {
            indexingEnabled: surface.indexingEnabled,
            revision: latest.revision,
            slug: snapshot.slug,
            surfaceId: surface.id,
          }
        : null;
    },

    cancel: async (surfaceId) => {
      await database
        .update(externalSurface)
        .set({ cancelledAt: new Date() })
        .where(
          and(
            eq(externalSurface.id, surfaceId),
            isNull(externalSurface.cancelledAt),
          ),
        );
    },

    setIndexing: async (surfaceId, enabled) => {
      await database
        .update(externalSurface)
        .set({ indexingEnabled: enabled })
        .where(
          and(
            eq(externalSurface.id, surfaceId),
            isNull(externalSurface.cancelledAt),
          ),
        );
    },

    publish: async ({ documentId, snapshot, workspaceId }) =>
      await database.transaction(async (transaction) => {
        // Serialises first publishes of one Document so only one surface is born.
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`wiki-publish:${documentId}`}))`,
        );
        const [existing] = await transaction
          .select({ id: externalSurface.id })
          .from(externalSurface)
          .where(activeWikiSurface(workspaceId, documentId))
          .limit(1);
        // No Project: a Wiki publish never creates a Build in Public surface.
        const surfaceId = existing?.id ?? crypto.randomUUID();
        if (!existing) {
          await transaction.insert(externalSurface).values({
            documentId,
            id: surfaceId,
            projectId: null,
            workspaceId,
          });
        }
        const [latest] = await transaction
          .select({ revision: externalSurfaceSnapshotRevision.revision })
          .from(externalSurfaceSnapshotRevision)
          .where(eq(externalSurfaceSnapshotRevision.surfaceId, surfaceId))
          .orderBy(desc(externalSurfaceSnapshotRevision.revision))
          .limit(1);
        const revision = (latest?.revision ?? 0) + 1;
        await transaction.insert(externalSurfaceSnapshotRevision).values({
          createdAt: new Date(snapshot.approvedAt),
          id: crypto.randomUUID(),
          revision,
          snapshot,
          surfaceId,
        });
        return {
          approvedAt: snapshot.approvedAt,
          documentId,
          projectId: null,
          revision,
          surfaceId,
        };
      }),
  };
}

export function createDatabaseWikiPublishing(
  database: Database,
  sources: WikiPublishingSources,
): WikiPublishingAccess {
  return createWikiPublishing({
    facts: createFacts(database, sources),
    store: createStore(database),
  });
}

/** Latest approved revision of a Wiki surface; the access module has already checked its state. */
export function createDatabaseWikiPublicSnapshots(
  database: Database,
): WikiPublicSnapshotReader {
  return {
    latest: async (surfaceId) => {
      const [latest] = await database
        .select({ snapshot: externalSurfaceSnapshotRevision.snapshot })
        .from(externalSurfaceSnapshotRevision)
        .where(eq(externalSurfaceSnapshotRevision.surfaceId, surfaceId))
        .orderBy(desc(externalSurfaceSnapshotRevision.revision))
        .limit(1);
      const snapshot = latest?.snapshot as WikiDocumentSnapshot | undefined;
      return snapshot?.kind === "Wiki Document" ? snapshot : null;
    },
  };
}

/**
 * Reads the exact approved File Attachment version through the File Attachment
 * owner's `readAsset`; the object-store key and URL never leave that owner.
 */
export function createDatabaseWikiPublicAssets(
  database: Database,
  fileAttachments: FileAttachmentAccess | undefined,
): WikiPublicAssetSource {
  return {
    open: async (surfaceId, file) => {
      if (!fileAttachments) {
        return null;
      }
      const [owner] = await database
        .select({ accountId: workspace.ownerAccountId })
        .from(externalSurface)
        .innerJoin(workspace, eq(workspace.id, externalSurface.workspaceId))
        .where(eq(externalSurface.id, surfaceId))
        .limit(1);
      const [version] = await database
        .select({ id: fileAttachmentVersion.id })
        .from(fileAttachmentVersion)
        .where(
          and(
            eq(fileAttachmentVersion.attachmentId, file.attachmentId),
            eq(fileAttachmentVersion.version, file.version),
          ),
        )
        .limit(1);
      if (!(owner && version)) {
        return null;
      }
      try {
        const asset = await fileAttachments.readAsset(owner.accountId, {
          attachmentId: file.attachmentId,
          variant: "original",
          versionId: version.id,
        });
        return {
          bytes: asset.bytes,
          contentType: asset.contentType,
          fileName: asset.fileName,
        };
      } catch {
        // A missing or unreadable file reads as gone; nothing about it is explained.
        return null;
      }
    },
  };
}
