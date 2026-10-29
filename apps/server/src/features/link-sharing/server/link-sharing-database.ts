import type {
  ApprovedShare,
  LinkSharingAccess,
  LinkSharingRootKind,
  ShareFieldKind,
  ShareManifest,
  ShareRootSummary,
} from "@cantiara/api/link-sharing";
import {
  LINK_SHARING_ROOT_KINDS,
  SHARE_MANIFEST_FORMAT,
} from "@cantiara/api/link-sharing";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
  linkShareVisitorSession,
} from "@cantiara/db/schema/external-surface";
import { feedback } from "@cantiara/db/schema/feedback";
import {
  fileAttachment,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import { moodboard, moodboardItem } from "@cantiara/db/schema/moodboard";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import {
  projectWall,
  projectWallGroup,
  projectWallItem,
} from "@cantiara/db/schema/project-wall";
import { workRelation } from "@cantiara/db/schema/relation";
import { risk } from "@cantiara/db/schema/risk";
import { screen, screenWireframeVersion } from "@cantiara/db/schema/screen";
import { smartCollection } from "@cantiara/db/schema/smart-collection";
import {
  diagramVersion,
  diagramView,
  technicalDiagram,
} from "@cantiara/db/schema/technical-diagram";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import {
  createLinkSharing,
  type LinkSharingSecurityEvents,
  type LinkSharingStore,
  type ShareSource,
  type ShareSourceField,
  type ShareSourceMember,
  type ShareSourcePart,
  type ShareSourceRecord,
  type StoredShareSurface,
} from "./link-sharing";
import type { LinkSharingAudit } from "./link-sharing-audit";
import { createLinkSharingReplay } from "./link-sharing-replay";

const SURFACE_KIND = "Link-limited share";
const LIST_LIMIT = 200;
const POOL_LIMIT = 500;
const YOUTUBE =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/g;

const field = (
  key: string,
  kind: ShareFieldKind,
  label: string,
  value: string | null | undefined,
): ShareSourceField => ({ key, kind, label, value: value ?? null });

const empty = (): Omit<ShareSource, "projectId" | "record"> => ({
  blockers: [],
  members: [],
});

interface LoadedSource extends Omit<ShareSource, "projectId" | "record"> {
  projectId: string;
  record: ShareSourceRecord;
}

function workFields(row: typeof work.$inferSelect): ShareSourceField[] {
  return [
    field("description", "description", "Description", row.description),
    field("type", "classification", "Type", row.type),
    field("status", "status", "Status", row.status),
    field(
      "closureResult",
      "closure-result",
      "Closure result",
      row.closureResult,
    ),
    field(
      "plannedStartDate",
      "planned-start",
      "Planned start",
      row.plannedStartDate,
    ),
    field("targetDate", "due-date", "Target date", row.targetDate),
    field("reappearDate", "reappear-date", "Reappear date", row.reappearDate),
    field(
      "roadmapHorizon",
      "roadmap-horizon",
      "Roadmap horizon",
      row.roadmapHorizon,
    ),
  ];
}

const workRecord = (
  row: typeof work.$inferSelect,
  parts: ShareSourcePart[] = [],
): ShareSourceRecord => ({
  fields: workFields(row),
  id: row.id,
  kind: "Work",
  parts,
  title: row.title,
});

async function titlesOf(
  database: Database,
  sourceType: string,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map();
  }
  const query: Promise<{ id: string; title: string }[]> = (() => {
    switch (sourceType) {
      case "Work":
        return database
          .select({ id: work.id, title: work.title })
          .from(work)
          .where(inArray(work.id, ids));
      case "Decision":
        return database
          .select({ id: decision.id, title: decision.title })
          .from(decision)
          .where(inArray(decision.id, ids));
      case "Risk":
        return database
          .select({ id: risk.id, title: risk.title })
          .from(risk)
          .where(inArray(risk.id, ids));
      case "Technical Diagram":
        return database
          .select({ id: technicalDiagram.id, title: technicalDiagram.title })
          .from(technicalDiagram)
          .where(inArray(technicalDiagram.id, ids));
      case "Smart Collection":
        return database
          .select({ id: smartCollection.id, title: smartCollection.name })
          .from(smartCollection)
          .where(inArray(smartCollection.id, ids));
      default:
        return Promise.resolve([]);
    }
  })();
  const rows = await query;
  return new Map(rows.map((row) => [row.id, row.title]));
}

/** One reader per root kind; each returns only that record and its own parts. */
const readers: Record<
  LinkSharingRootKind,
  (database: Database, id: string) => Promise<LoadedSource | null>
> = {
  async Document(database, id) {
    const [row] = await database
      .select()
      .from(document)
      .where(and(eq(document.id, id), isNull(document.archivedAt)))
      .limit(1);
    if (!row?.projectId) {
      return null;
    }
    const attachments = await database
      .select({
        id: fileAttachment.id,
        current: fileAttachment.currentVersion,
        name: fileAttachment.name,
      })
      .from(fileAttachment)
      .where(
        and(
          eq(fileAttachment.ownerDocumentId, id),
          eq(fileAttachment.lifecycleStatus, "Active"),
        ),
      );
    const versions =
      attachments.length === 0
        ? []
        : await database
            .select()
            .from(fileAttachmentVersion)
            .where(
              inArray(
                fileAttachmentVersion.attachmentId,
                attachments.map((attachment) => attachment.id),
              ),
            );
    const parts: ShareSourcePart[] = [];
    for (const attachment of attachments) {
      const version = versions.find(
        (entry) =>
          entry.attachmentId === attachment.id &&
          entry.version === attachment.current,
      );
      if (version) {
        parts.push({
          detail: `Version ${version.version} · ${version.fileName} · ${version.mimeType}`,
          id: `attachment:${attachment.id}:${version.id}`,
          kind: "Attachment",
          label: `File Attachment: ${attachment.name}`,
        });
      }
    }
    for (const match of new Set(
      [...row.body.matchAll(YOUTUBE)].map((entry) => entry[0]),
    )) {
      parts.push({
        detail: match,
        id: `embed:${match}`,
        kind: "Embed",
        label: "YouTube (Live external source, loads on click)",
      });
    }
    return {
      ...empty(),
      projectId: row.projectId,
      record: {
        fields: [
          field("body", "markdown", "Markdown", row.body),
          field("type", "classification", "Document type", row.type),
        ],
        id: row.id,
        kind: "Document",
        parts,
        title: row.title,
      },
    };
  },

  async Work(database, id) {
    const [row] = await database
      .select()
      .from(work)
      .where(and(eq(work.id, id), isNull(work.trashedAt)))
      .limit(1);
    if (!row) {
      return null;
    }
    const relations = await database
      .select()
      .from(workRelation)
      .where(
        and(
          eq(workRelation.sourceWorkId, id),
          eq(workRelation.sourceRecordType, "Work"),
          isNull(workRelation.deletedAt),
        ),
      );
    return {
      ...empty(),
      projectId: row.projectId,
      record: workRecord(
        row,
        relations.map((relation) => ({
          detail: relation.kind,
          id: `relation:${relation.id}`,
          kind: "Relation" as const,
          label: `${relation.kind}: ${relation.targetLabel}`,
          target: {
            id: relation.targetRecordId,
            kind: relation.targetRecordType,
          },
        })),
      ),
    };
  },

  async Decision(database, id) {
    const [row] = await database
      .select()
      .from(decision)
      .where(eq(decision.id, id))
      .limit(1);
    return row
      ? {
          ...empty(),
          projectId: row.projectId,
          record: {
            fields: [
              field("decision", "markdown", "Decision", row.decision),
              field("rationale", "markdown", "Rationale", row.rationale),
              field("status", "status", "Status", row.life),
            ],
            id: row.id,
            kind: "Decision",
            parts: [],
            title: row.title,
          },
        }
      : null;
  },

  async Risk(database, id) {
    const [row] = await database
      .select()
      .from(risk)
      .where(eq(risk.id, id))
      .limit(1);
    return row
      ? {
          ...empty(),
          projectId: row.projectId,
          record: {
            fields: [
              field(
                "description",
                "description",
                "Description",
                row.description,
              ),
              field("rationale", "markdown", "Rationale", row.rationale),
              field("response", "markdown", "Response", row.response),
              field("impact", "classification", "Impact", row.impact),
              field(
                "probability",
                "classification",
                "Probability",
                row.probability,
              ),
              field("status", "status", "Status", row.life),
            ],
            id: row.id,
            kind: "Risk",
            parts: [],
            title: row.title,
          },
        }
      : null;
  },

  async Feedback(database, id) {
    const [row] = await database
      .select()
      .from(feedback)
      .where(eq(feedback.id, id))
      .limit(1);
    return row
      ? {
          ...empty(),
          projectId: row.projectId,
          record: {
            fields: [
              field(
                "originalMessage",
                "markdown",
                "Original message",
                row.originalMessage,
              ),
              field("channel", "classification", "Channel", row.channel),
              field("url", "url", "URL", row.url),
              field("status", "status", "Status", row.status),
            ],
            id: row.id,
            kind: "Feedback",
            parts: [],
            title: row.title,
          },
        }
      : null;
  },

  async "Production Incident"(database, id) {
    const [row] = await database
      .select()
      .from(productionIncident)
      .where(eq(productionIncident.id, id))
      .limit(1);
    return row
      ? {
          ...empty(),
          projectId: row.projectId,
          record: {
            fields: [
              field("impact", "markdown", "Impact", row.impact),
              field("detectedHow", "markdown", "How detected", row.detectedHow),
              field("rootCause", "markdown", "Root cause", row.rootCause),
              field("resolution", "markdown", "Resolution", row.resolution),
              field("learning", "markdown", "Learning", row.learning),
              field("status", "status", "Status", row.status),
            ],
            id: row.id,
            kind: "Production Incident",
            parts: [],
            title: row.title,
          },
        }
      : null;
  },

  async Milestone(database, id) {
    const [row] = await database
      .select()
      .from(projectMilestone)
      .where(eq(projectMilestone.id, id))
      .limit(1);
    return row
      ? {
          ...empty(),
          projectId: row.projectId,
          record: {
            fields: [
              field(
                "description",
                "description",
                "Description",
                row.description,
              ),
              field("status", "milestone-status", "Status", row.status),
              field("targetDate", "due-date", "Target date", row.targetDate),
            ],
            id: row.id,
            kind: "Milestone",
            parts: [],
            title: row.title,
          },
        }
      : null;
  },

  async "Project Release"(database, id) {
    const [row] = await database
      .select()
      .from(projectRelease)
      .where(eq(projectRelease.id, id))
      .limit(1);
    return row
      ? {
          ...empty(),
          projectId: row.projectId,
          record: {
            fields: [
              field(
                "description",
                "description",
                "Description",
                row.description,
              ),
              field(
                "versionLabel",
                "classification",
                "Version label",
                row.versionLabel,
              ),
              field(
                "intendedOutcome",
                "markdown",
                "Intended outcome",
                row.intendedOutcome,
              ),
              field("status", "release-status", "Status", row.status),
            ],
            id: row.id,
            kind: "Project Release",
            parts: [],
            title: row.name,
          },
        }
      : null;
  },

  async Screen(database, id) {
    const [row] = await database
      .select()
      .from(screen)
      .where(
        and(
          eq(screen.id, id),
          isNull(screen.archivedAt),
          isNull(screen.trashedAt),
        ),
      )
      .limit(1);
    if (!row) {
      return null;
    }
    const versions = await database
      .select({
        createdAt: screenWireframeVersion.createdAt,
        id: screenWireframeVersion.id,
        version: screenWireframeVersion.version,
      })
      .from(screenWireframeVersion)
      .where(eq(screenWireframeVersion.screenId, id))
      .orderBy(desc(screenWireframeVersion.version));
    return {
      blockers:
        versions.length === 0 ? ["Save a Wireframe version first."] : [],
      members: [],
      projectId: row.projectId,
      record: {
        fields: [],
        id: row.id,
        kind: "Screen",
        parts: versions.map((version) => ({
          detail: version.createdAt.toISOString(),
          group: "Wireframe version",
          id: `wireframe:${version.id}`,
          kind: "Version" as const,
          label: `Wireframe version ${version.version}`,
        })),
        title: row.title,
      },
    };
  },

  async "Technical Diagram"(database, id) {
    const [row] = await database
      .select()
      .from(technicalDiagram)
      .where(eq(technicalDiagram.id, id))
      .limit(1);
    if (!row) {
      return null;
    }
    const base = [
      field("type", "classification", "Diagram type", row.type),
      field(
        "authorityMode",
        "classification",
        "Diagram Authority Mode",
        row.authorityMode,
      ),
    ];
    if (row.authorityMode === "External Source Link") {
      return {
        blockers: row.externalUrl
          ? []
          : ["Add the external source link first."],
        members: [],
        projectId: row.projectId,
        record: {
          fields: base,
          id: row.id,
          kind: "Technical Diagram",
          parts: [
            {
              detail: [
                `URL: ${row.externalUrl ?? ""}`,
                `Provider: ${row.externalTool ?? ""}`,
                `Known revision: ${row.externalRevision ?? ""}`,
                `Last checked: ${row.externalCheckedAt?.toISOString() ?? ""}`,
              ].join("\n"),
              group: "Origin snapshot",
              id: "origin",
              kind: "Version",
              label: "Origin snapshot (link card, no iframe)",
            },
          ],
          title: row.title,
        },
      };
    }
    const [versions, views] = await Promise.all([
      database
        .select()
        .from(diagramVersion)
        .where(eq(diagramVersion.diagramId, id))
        .orderBy(desc(diagramVersion.number)),
      database
        .select({ id: diagramView.id, name: diagramView.name })
        .from(diagramView)
        .where(eq(diagramView.diagramId, id))
        .orderBy(asc(diagramView.name)),
    ]);
    return {
      blockers: versions.length === 0 ? ["Save a Diagram Version first."] : [],
      members: [],
      projectId: row.projectId,
      record: {
        fields: base,
        id: row.id,
        kind: "Technical Diagram",
        parts: [
          ...versions.map((version) => ({
            detail: `Revision ${version.revision}`,
            group: "Diagram Version",
            id: `version:${version.id}`,
            kind: "Version" as const,
            label: `Diagram Version ${version.number}: ${version.name}`,
          })),
          ...views.map((view) => ({
            detail: null,
            group: "Diagram View",
            id: `view:${view.id}`,
            kind: "View metadata" as const,
            label: `Diagram View: ${view.name}`,
          })),
        ],
        title: row.title,
      },
    };
  },

  async "Project Wall"(database, id) {
    const [row] = await database
      .select()
      .from(projectWall)
      .where(eq(projectWall.id, id))
      .limit(1);
    if (!row) {
      return null;
    }
    const [cards, groups] = await Promise.all([
      database
        .select()
        .from(projectWallItem)
        .where(eq(projectWallItem.wallId, id))
        .orderBy(asc(projectWallItem.zOrder), asc(projectWallItem.id)),
      database
        .select({ title: projectWallGroup.title })
        .from(projectWallGroup)
        .where(eq(projectWallGroup.wallId, id)),
    ]);
    const titles = new Map<string, string>();
    const found = await Promise.all(
      [...new Set(cards.map((card) => card.sourceType))].map(async (type) => ({
        titles: await titlesOf(
          database,
          type,
          cards
            .filter((card) => card.sourceType === type)
            .map((card) => card.sourceId),
        ),
        type,
      })),
    );
    for (const entry of found) {
      for (const [key, title] of entry.titles) {
        titles.set(`${entry.type}:${key}`, title);
      }
    }
    const parts: ShareSourcePart[] = cards.map((card) => {
      const title =
        titles.get(`${card.sourceType}:${card.sourceId}`) ?? card.sourceId;
      const live = card.sourceType === "Smart Collection";
      return {
        detail: `${card.sourceType} · ${card.density}`,
        id: `card:${card.id}`,
        kind: live ? ("Live collection block" as const) : ("Card" as const),
        label: `${live ? "Smart Collection block" : "Card"}: ${title}`,
      };
    });
    parts.push({
      detail: `${cards.length} cards · ${groups.length} groups: ${groups.map((group) => group.title).join(", ")}`,
      id: "layout",
      kind: "Layout",
      label: "Wall layout and group titles",
    });
    return {
      ...empty(),
      projectId: row.projectId,
      record: {
        fields: [],
        id: row.id,
        kind: "Project Wall",
        parts,
        title: row.title,
      },
    };
  },

  async Moodboard(database, id) {
    const [row] = await database
      .select()
      .from(moodboard)
      .where(eq(moodboard.id, id))
      .limit(1);
    if (!row) {
      return null;
    }
    const items = await database
      .select({ id: moodboardItem.id })
      .from(moodboardItem)
      .where(eq(moodboardItem.moodboardId, id));
    return {
      ...empty(),
      projectId: row.projectId,
      record: {
        fields: [],
        id: row.id,
        kind: "Moodboard",
        parts: [
          {
            detail: `${items.length} items`,
            id: "layout",
            kind: "Layout",
            label: "Moodboard layout",
          },
        ],
        title: row.title,
      },
    };
  },

  async "Smart Collection"(database, id) {
    const [row] = await database
      .select()
      .from(smartCollection)
      .where(eq(smartCollection.id, id))
      .limit(1);
    if (!row) {
      return null;
    }
    const { conditions } = row;
    const members: ShareSourceMember[] =
      row.sourceType === "Work"
        ? (await workPool(database, row.projectId)).map((record) => ({
            matchesFilter: (values) =>
              (!conditions.status || values.status === conditions.status) &&
              (!conditions.type || values.type === conditions.type),
            record,
          }))
        : [];
    return {
      blockers: [],
      members,
      projectId: row.projectId,
      record: {
        fields: [
          field("sourceType", "classification", "Source type", row.sourceType),
        ],
        id: row.id,
        kind: "Smart Collection",
        parts: [
          {
            detail: JSON.stringify(conditions),
            id: "filter",
            kind: "View metadata",
            label: "Collection filter",
          },
        ],
        title: row.name,
      },
    };
  },

  async Roadmap(database, id) {
    const [row] = await database
      .select({ id: project.id, name: project.name })
      .from(project)
      .where(eq(project.id, id))
      .limit(1);
    if (!row) {
      return null;
    }
    return {
      blockers: [],
      members: (await workPool(database, id)).map((record) => ({
        matchesFilter: (values) =>
          values.roadmapHorizon !== null && values.roadmapHorizon !== undefined,
        record,
      })),
      projectId: id,
      record: {
        fields: [],
        id,
        kind: "Roadmap",
        parts: [],
        title: `${row.name} Roadmap`,
      },
    };
  },
};

async function workPool(database: Database, projectId: string) {
  const rows = await database
    .select()
    .from(work)
    .where(
      and(
        eq(work.projectId, projectId),
        isNull(work.trashedAt),
        isNull(work.archivedAt),
      ),
    )
    .orderBy(asc(work.number))
    .limit(POOL_LIMIT);
  return rows.map((row) => workRecord(row));
}

interface RootTable {
  kind: LinkSharingRootKind;
  rows: () => Promise<{ id: string; title: string }[]>;
}

function rootLists(database: Database, projectId: string): RootTable[] {
  return [
    {
      kind: "Document",
      rows: () =>
        database
          .select({ id: document.id, title: document.title })
          .from(document)
          .where(
            and(eq(document.projectId, projectId), isNull(document.archivedAt)),
          )
          .limit(LIST_LIMIT),
    },
    {
      kind: "Work",
      rows: () =>
        database
          .select({ id: work.id, title: work.title })
          .from(work)
          .where(
            and(
              eq(work.projectId, projectId),
              isNull(work.trashedAt),
              isNull(work.archivedAt),
            ),
          )
          .limit(LIST_LIMIT),
    },
    {
      kind: "Decision",
      rows: () =>
        database
          .select({ id: decision.id, title: decision.title })
          .from(decision)
          .where(eq(decision.projectId, projectId))
          .limit(LIST_LIMIT),
    },
    {
      kind: "Risk",
      rows: () =>
        database
          .select({ id: risk.id, title: risk.title })
          .from(risk)
          .where(eq(risk.projectId, projectId))
          .limit(LIST_LIMIT),
    },
    {
      kind: "Feedback",
      rows: () =>
        database
          .select({ id: feedback.id, title: feedback.title })
          .from(feedback)
          .where(eq(feedback.projectId, projectId))
          .limit(LIST_LIMIT),
    },
    {
      kind: "Production Incident",
      rows: () =>
        database
          .select({
            id: productionIncident.id,
            title: productionIncident.title,
          })
          .from(productionIncident)
          .where(eq(productionIncident.projectId, projectId))
          .limit(LIST_LIMIT),
    },
    {
      kind: "Milestone",
      rows: () =>
        database
          .select({ id: projectMilestone.id, title: projectMilestone.title })
          .from(projectMilestone)
          .where(eq(projectMilestone.projectId, projectId))
          .limit(LIST_LIMIT),
    },
    {
      kind: "Project Release",
      rows: () =>
        database
          .select({ id: projectRelease.id, title: projectRelease.name })
          .from(projectRelease)
          .where(eq(projectRelease.projectId, projectId))
          .limit(LIST_LIMIT),
    },
    {
      kind: "Screen",
      rows: () =>
        database
          .select({ id: screen.id, title: screen.title })
          .from(screen)
          .where(
            and(
              eq(screen.projectId, projectId),
              isNull(screen.archivedAt),
              isNull(screen.trashedAt),
            ),
          )
          .limit(LIST_LIMIT),
    },
    {
      kind: "Technical Diagram",
      rows: () =>
        database
          .select({ id: technicalDiagram.id, title: technicalDiagram.title })
          .from(technicalDiagram)
          .where(eq(technicalDiagram.projectId, projectId))
          .limit(LIST_LIMIT),
    },
    {
      kind: "Project Wall",
      rows: () =>
        database
          .select({ id: projectWall.id, title: projectWall.title })
          .from(projectWall)
          .where(eq(projectWall.projectId, projectId))
          .limit(LIST_LIMIT),
    },
    {
      kind: "Moodboard",
      rows: () =>
        database
          .select({ id: moodboard.id, title: moodboard.title })
          .from(moodboard)
          .where(eq(moodboard.projectId, projectId))
          .limit(LIST_LIMIT),
    },
    {
      kind: "Smart Collection",
      rows: () =>
        database
          .select({ id: smartCollection.id, title: smartCollection.name })
          .from(smartCollection)
          .where(eq(smartCollection.projectId, projectId))
          .limit(LIST_LIMIT),
    },
  ];
}

function manifestOf(snapshot: unknown): ShareManifest | null {
  const candidate = snapshot as Partial<ShareManifest> | null;
  return candidate?.format === SHARE_MANIFEST_FORMAT && candidate.version === 1
    ? (candidate as ShareManifest)
    : null;
}

function createStore(database: Database): LinkSharingStore {
  async function ownedProject(accountId: string, projectId: string) {
    const [row] = await database
      .select({ workspaceId: project.workspaceId })
      .from(project)
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
      )
      .limit(1);
    return row ?? null;
  }

  /** The owned, not revoked Link Sharing surface row. */
  async function ownedLiveSurface(
    accountId: string,
    surfaceId: string,
    executor: Pick<Database, "select"> = database,
  ) {
    const [row] = await executor
      .select({
        documentId: externalSurface.documentId,
        expiresAt: externalSurface.expiresAt,
        id: externalSurface.id,
        passwordHash: externalSurface.passwordHash,
        projectId: externalSurface.projectId,
        rootId: externalSurface.rootId,
        rootKind: externalSurface.rootKind,
        workspaceId: externalSurface.workspaceId,
      })
      .from(externalSurface)
      .innerJoin(workspace, eq(workspace.id, externalSurface.workspaceId))
      .where(
        and(
          eq(externalSurface.id, surfaceId),
          eq(externalSurface.surfaceKind, SURFACE_KIND),
          eq(workspace.ownerAccountId, accountId),
          isNull(externalSurface.cancelledAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async function findApproval(accountId: string, approvalId: string) {
    const [row] = await database
      .select({
        fingerprint: externalSurfaceSnapshotRevision.approvalFingerprint,
        passwordHash: externalSurface.passwordHash,
        revision: externalSurfaceSnapshotRevision.revision,
        snapshot: externalSurfaceSnapshotRevision.snapshot,
        surfaceId: externalSurfaceSnapshotRevision.surfaceId,
      })
      .from(externalSurfaceSnapshotRevision)
      .innerJoin(
        externalSurface,
        eq(externalSurface.id, externalSurfaceSnapshotRevision.surfaceId),
      )
      .innerJoin(workspace, eq(workspace.id, externalSurface.workspaceId))
      .where(
        and(
          eq(externalSurfaceSnapshotRevision.approvalId, approvalId),
          eq(workspace.ownerAccountId, accountId),
        ),
      )
      .limit(1);
    const manifest = row ? manifestOf(row.snapshot) : null;
    if (!(row && manifest)) {
      return null;
    }
    const result: ApprovedShare = {
      accessToken: null,
      label: manifest.label,
      lastApprovedAt: manifest.approvedAt,
      passwordProtected: row.passwordHash !== null,
      revision: row.revision,
      surfaceId: row.surfaceId,
    };
    return { fingerprint: row.fingerprint ?? "", result };
  }

  return {
    async commit(commit) {
      const owned = await ownedProject(commit.accountId, commit.projectId);
      if (!owned) {
        return null;
      }
      return database.transaction(async (executor) => {
        let { surfaceId } = commit;
        let passwordProtected = false;
        if (surfaceId) {
          const [existing] = await executor
            .select({
              id: externalSurface.id,
              passwordHash: externalSurface.passwordHash,
            })
            .from(externalSurface)
            .where(
              and(
                eq(externalSurface.id, surfaceId),
                eq(externalSurface.workspaceId, owned.workspaceId),
                eq(externalSurface.surfaceKind, SURFACE_KIND),
                eq(externalSurface.rootKind, commit.root.kind),
                eq(externalSurface.rootId, commit.root.id),
                isNull(externalSurface.cancelledAt),
              ),
            )
            .limit(1);
          if (!existing) {
            return null;
          }
          passwordProtected = existing.passwordHash !== null;
        } else {
          surfaceId = commit.newSurfaceId;
          await executor.insert(externalSurface).values({
            documentId: commit.root.kind === "Document" ? commit.root.id : null,
            id: surfaceId,
            projectId: commit.projectId,
            rootId: commit.root.id,
            rootKind: commit.root.kind,
            surfaceKind: SURFACE_KIND,
            tokenHash: commit.tokenHash,
            workspaceId: owned.workspaceId,
          });
        }
        const [latest] = await executor
          .select({ revision: externalSurfaceSnapshotRevision.revision })
          .from(externalSurfaceSnapshotRevision)
          .where(eq(externalSurfaceSnapshotRevision.surfaceId, surfaceId))
          .orderBy(desc(externalSurfaceSnapshotRevision.revision))
          .limit(1);
        const revision = (latest?.revision ?? 0) + 1;
        const inserted = await executor
          .insert(externalSurfaceSnapshotRevision)
          .values({
            approvalFingerprint: commit.fingerprint,
            approvalId: commit.approvalId,
            createdAt: new Date(commit.manifest.approvedAt),
            id: crypto.randomUUID(),
            placeholdersAcknowledged: commit.placeholdersAcknowledged,
            revision,
            snapshot: commit.manifest,
            surfaceId,
          })
          .onConflictDoNothing({
            target: externalSurfaceSnapshotRevision.approvalId,
          })
          .returning({ id: externalSurfaceSnapshotRevision.id });
        if (inserted.length === 0) {
          // A concurrent retry of the same approval already committed.
          const replay = await findApproval(
            commit.accountId,
            commit.approvalId,
          );
          return replay?.result ?? null;
        }
        return {
          accessToken: null,
          label: commit.manifest.label,
          lastApprovedAt: commit.manifest.approvedAt,
          passwordProtected,
          revision,
          surfaceId,
        };
      });
    },

    findApproval,

    async roots(accountId, projectId) {
      const owned = await ownedProject(accountId, projectId);
      if (!owned) {
        return null;
      }
      const lists = await Promise.all(
        rootLists(database, projectId).map(async (list) =>
          (await list.rows()).map(
            (row): ShareRootSummary => ({
              id: row.id,
              kind: list.kind,
              title: row.title,
            }),
          ),
        ),
      );
      return [
        { id: projectId, kind: "Roadmap", title: "Roadmap" },
        ...lists.flat(),
      ];
    },

    async source(accountId, root) {
      if (!(LINK_SHARING_ROOT_KINDS as readonly string[]).includes(root.kind)) {
        return null;
      }
      const loaded = await readers[root.kind](database, root.id);
      if (!(loaded && (await ownedProject(accountId, loaded.projectId)))) {
        return null;
      }
      return loaded;
    },

    async lifecycle(accountId, surfaceId) {
      const owned = await ownedLiveSurface(accountId, surfaceId);
      return owned
        ? {
            expiresAt: owned.expiresAt,
            passwordProtected: owned.passwordHash !== null,
          }
        : null;
    },

    reshare(commit) {
      return database.transaction(async (executor) => {
        const existing = await executor
          .select({ id: externalSurface.id })
          .from(externalSurface)
          .where(eq(externalSurface.id, commit.newSurfaceId))
          .limit(1);
        const source = await ownedLiveSurface(
          commit.accountId,
          commit.sourceSurfaceId,
          executor,
        );
        if (!source) {
          return null;
        }
        const [revision] = await executor
          .select()
          .from(externalSurfaceSnapshotRevision)
          .where(eq(externalSurfaceSnapshotRevision.surfaceId, source.id))
          .orderBy(desc(externalSurfaceSnapshotRevision.revision))
          .limit(1);
        const manifest = revision ? manifestOf(revision.snapshot) : null;
        if (!(revision && manifest)) {
          return null;
        }
        const share = {
          accessToken: null,
          label: manifest.label,
          lastApprovedAt: manifest.approvedAt,
          passwordProtected: source.passwordHash !== null,
          revision: 1,
          surfaceId: commit.newSurfaceId,
        };
        if (existing.length > 0) {
          return { created: false, share };
        }
        await executor.insert(externalSurface).values({
          documentId: source.documentId,
          expiresAt: commit.expiresAt,
          id: commit.newSurfaceId,
          passwordHash: source.passwordHash,
          projectId: source.projectId,
          rootId: source.rootId,
          rootKind: source.rootKind,
          surfaceKind: SURFACE_KIND,
          tokenHash: commit.tokenHash,
          workspaceId: source.workspaceId,
        });
        await executor.insert(externalSurfaceSnapshotRevision).values({
          createdAt: revision.createdAt,
          id: crypto.randomUUID(),
          placeholdersAcknowledged: revision.placeholdersAcknowledged,
          revision: 1,
          snapshot: revision.snapshot,
          surfaceId: commit.newSurfaceId,
        });
        return { created: true, share };
      });
    },

    async revoke(accountId, surfaceId, at) {
      const owned = await ownedLiveSurface(accountId, surfaceId);
      if (!owned) {
        return null;
      }
      // Terminal: the cancellation and the epoch bump land together, and the
      // surface's sessions are removed; nothing reads them again.
      return database.transaction(async (executor) => {
        const [changed] = await executor
          .update(externalSurface)
          .set({
            accessEpoch: sql`${externalSurface.accessEpoch} + 1`,
            cancelledAt: at,
          })
          .where(
            and(
              eq(externalSurface.id, surfaceId),
              isNull(externalSurface.cancelledAt),
            ),
          )
          .returning({ accessEpoch: externalSurface.accessEpoch });
        if (!changed) {
          return null;
        }
        await executor
          .delete(linkShareVisitorSession)
          .where(eq(linkShareVisitorSession.surfaceId, surfaceId));
        return changed;
      });
    },

    async updateExpiry(accountId, surfaceId, expiresAt, endSessions) {
      const owned = await ownedLiveSurface(accountId, surfaceId);
      if (!owned) {
        return null;
      }
      const [changed] = await database
        .update(externalSurface)
        .set({
          expiresAt,
          ...(endSessions
            ? { accessEpoch: sql`${externalSurface.accessEpoch} + 1` }
            : {}),
        })
        .where(
          and(
            eq(externalSurface.id, surfaceId),
            isNull(externalSurface.cancelledAt),
          ),
        )
        .returning({ accessEpoch: externalSurface.accessEpoch });
      return changed ?? null;
    },

    async updateAccess(accountId, surfaceId, patch) {
      const [owned] = await database
        .select({ id: externalSurface.id })
        .from(externalSurface)
        .innerJoin(workspace, eq(workspace.id, externalSurface.workspaceId))
        .where(
          and(
            eq(externalSurface.id, surfaceId),
            eq(externalSurface.surfaceKind, SURFACE_KIND),
            eq(workspace.ownerAccountId, accountId),
            isNull(externalSurface.cancelledAt),
          ),
        )
        .limit(1);
      if (!owned) {
        return null;
      }
      // One statement: the new hash and the bumped epoch land together, so
      // every Paylaşım erişim oturumu minted before it stops authorizing.
      const [changed] = await database
        .update(externalSurface)
        .set({
          accessEpoch: sql`${externalSurface.accessEpoch} + 1`,
          ...(patch.passwordHash === undefined
            ? {}
            : { passwordHash: patch.passwordHash }),
          ...(patch.tokenHash === undefined
            ? {}
            : { tokenHash: patch.tokenHash }),
        })
        .where(eq(externalSurface.id, surfaceId))
        .returning({
          accessEpoch: externalSurface.accessEpoch,
          passwordHash: externalSurface.passwordHash,
        });
      return changed
        ? {
            accessEpoch: changed.accessEpoch,
            passwordProtected: changed.passwordHash !== null,
          }
        : null;
    },

    async surface(accountId, root, surfaceId) {
      const [row] = await database
        .select({
          expiresAt: externalSurface.expiresAt,
          id: externalSurface.id,
          passwordHash: externalSurface.passwordHash,
        })
        .from(externalSurface)
        .innerJoin(workspace, eq(workspace.id, externalSurface.workspaceId))
        .where(
          and(
            eq(workspace.ownerAccountId, accountId),
            eq(externalSurface.surfaceKind, SURFACE_KIND),
            eq(externalSurface.rootKind, root.kind),
            eq(externalSurface.rootId, root.id),
            isNull(externalSurface.cancelledAt),
            surfaceId ? eq(externalSurface.id, surfaceId) : undefined,
          ),
        )
        .orderBy(desc(externalSurface.createdAt))
        .limit(1);
      if (!row) {
        return null;
      }
      const [revision] = await database
        .select()
        .from(externalSurfaceSnapshotRevision)
        .where(eq(externalSurfaceSnapshotRevision.surfaceId, row.id))
        .orderBy(desc(externalSurfaceSnapshotRevision.revision))
        .limit(1);
      const manifest = revision ? manifestOf(revision.snapshot) : null;
      return revision && manifest
        ? ({
            approvedAt: manifest.approvedAt,
            expiresAt: row.expiresAt,
            manifest,
            passwordProtected: row.passwordHash !== null,
            revision: revision.revision,
            surfaceId: row.id,
          } satisfies StoredShareSurface)
        : null;
    },
  };
}

export function createDatabaseLinkSharing(
  database: Database,
  options: {
    audit?: LinkSharingAudit;
    events?: LinkSharingSecurityEvents;
  } = {},
): LinkSharingAccess {
  return createLinkSharing(createStore(database), options);
}

/**
 * Restore replay of the Link Sharing events against the surface rows. It only
 * ever cancels a row or raises its access epoch (see `link-sharing-replay.ts`).
 */
export function createDatabaseLinkSharingReplay(
  database: Database,
  events: Pick<LinkSharingSecurityEvents, "list">,
) {
  return createLinkSharingReplay(events, {
    async cancel(surfaceId, at, belowEpoch) {
      await database
        .update(externalSurface)
        .set({ cancelledAt: at })
        .where(
          and(
            eq(externalSurface.id, surfaceId),
            eq(externalSurface.surfaceKind, SURFACE_KIND),
            isNull(externalSurface.cancelledAt),
            belowEpoch === undefined
              ? undefined
              : lt(externalSurface.accessEpoch, belowEpoch),
          ),
        );
    },
    async raiseEpoch(surfaceId, epoch) {
      await database
        .update(externalSurface)
        .set({ accessEpoch: epoch })
        .where(
          and(
            eq(externalSurface.id, surfaceId),
            eq(externalSurface.surfaceKind, SURFACE_KIND),
            lt(externalSurface.accessEpoch, epoch),
          ),
        );
    },
  });
}
