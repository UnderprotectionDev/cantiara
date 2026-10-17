// biome-ignore-all lint/performance/noAwaitInLoops: Rows are read sequentially inside one read-only transaction.
import {
  type EvidenceFlowRow,
  evidenceFlowInputSchema,
  evidenceRoleSchema,
} from "@cantiara/api/document-evidence";
import { versionPinnedEvidenceSchema } from "@cantiara/api/evidence";
import {
  researchSessionConsentGates,
  researchSessionRecordSchema,
} from "@cantiara/api/research-sessions";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { evidenceBinding } from "@cantiara/db/schema/evidence";
import { project } from "@cantiara/db/schema/project";
import { researchSession } from "@cantiara/db/schema/research-session";
import { source, sourceVersion } from "@cantiara/db/schema/source";
import { and, asc, eq } from "drizzle-orm";
import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";
import { evidenceProject, evidenceTarget } from "./evidence-targets";

type Row = typeof evidenceBinding.$inferSelect;
type Pin = ReturnType<typeof versionPinnedEvidenceSchema.parse>;
type BrokenReason = EvidenceFlowRow["source"]["brokenReason"];
interface Live {
  brokenReason: BrokenReason;
  /** The pinned owned component is gone (`Source element no longer exists`). */
  elementMissing?: boolean;
  source: { title: string | null; revision: number } | null;
}

/** Gone rows were permanently deleted; rows another Account owns are only `No access`. */
function unavailable(remaining: boolean): Live {
  return {
    source: null,
    brokenReason: remaining ? "No access" : "Permanently deleted",
  };
}

/** Live Document for a persisted pin: owned and readable, `Archived`, or a safe broken reason. */
export async function liveSource(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workspaceId: string,
  pin: Pin,
) {
  const [row] = await executor
    .select({
      title: document.title,
      revision: document.revision,
      archivedAt: document.archivedAt,
      projectArchivedAt: project.archivedAt,
    })
    .from(document)
    .innerJoin(project, eq(document.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(document.id, pin.source.recordId),
        eq(document.projectId, pin.source.projectId),
        eq(workspace.id, workspaceId),
        eq(workspace.ownerAccountId, accountId),
      ),
    );
  if (row) {
    const archived = Boolean(row.archivedAt || row.projectArchivedAt);
    return {
      source: row,
      brokenReason: archived ? ("Archived" as const) : null,
    };
  }
  const [remaining] = await executor
    .select({ id: document.id })
    .from(document)
    .where(
      and(
        eq(document.id, pin.source.recordId),
        eq(document.projectId, pin.source.projectId),
      ),
    )
    .limit(1);
  return unavailable(Boolean(remaining)) as {
    source: null;
    brokenReason: "No access" | "Permanently deleted";
  };
}

async function liveSourceRecord(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workspaceId: string,
  pin: Pin,
): Promise<Live> {
  const [row] = await executor
    .select({
      revision: source.revision,
      projectArchivedAt: project.archivedAt,
      title: sourceVersion.title,
    })
    .from(source)
    .innerJoin(project, eq(source.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .leftJoin(
      sourceVersion,
      and(
        eq(sourceVersion.sourceId, source.id),
        eq(sourceVersion.revision, pin.source.revision),
      ),
    )
    .where(
      and(
        eq(source.id, pin.source.recordId),
        eq(source.projectId, pin.source.projectId),
        eq(workspace.id, workspaceId),
        eq(workspace.ownerAccountId, accountId),
      ),
    );
  if (row) {
    return {
      source: { title: row.title ?? "Source", revision: row.revision },
      brokenReason: row.projectArchivedAt ? "Archived" : null,
    };
  }
  const [remaining] = await executor
    .select({ id: source.id })
    .from(source)
    .where(
      and(
        eq(source.id, pin.source.recordId),
        eq(source.projectId, pin.source.projectId),
      ),
    )
    .limit(1);
  return unavailable(Boolean(remaining));
}

/** Research Session text follows the live owned session and its current Consent. */
async function liveResearchSession(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workspaceId: string,
  pin: Pin,
): Promise<Live> {
  const [row] = await executor
    .select({ data: researchSession.data, archivedAt: project.archivedAt })
    .from(researchSession)
    .innerJoin(project, eq(researchSession.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(researchSession.id, pin.source.recordId),
        eq(researchSession.projectId, pin.source.projectId),
        eq(workspace.id, workspaceId),
        eq(workspace.ownerAccountId, accountId),
      ),
    );
  if (!row) {
    const [remaining] = await executor
      .select({ id: researchSession.id })
      .from(researchSession)
      .where(
        and(
          eq(researchSession.id, pin.source.recordId),
          eq(researchSession.projectId, pin.source.projectId),
        ),
      )
      .limit(1);
    return unavailable(Boolean(remaining));
  }
  const session = researchSessionRecordSchema.safeParse(row.data);
  if (!session.success) {
    return unavailable(true);
  }
  const live = {
    title: session.data.title,
    revision: session.data.revision,
  };
  const component = session.data.content.find(
    ({ content }) => content.id === pin.source.componentId,
  );
  // Consent closes the session before a missing component is named, so a revoked session never reveals its title.
  const consentOpen =
    researchSessionConsentGates(session.data.consent).convert &&
    (!component ||
      researchSessionConsentGates(component.consentAtCapture).convert);
  if (!consentOpen) {
    return { source: live, brokenReason: "No access" };
  }
  if (pin.source.componentId && !component) {
    return { source: live, brokenReason: null, elementMissing: true };
  }
  return { source: live, brokenReason: row.archivedAt ? "Archived" : null };
}

function flowRow(
  row: Row,
  pin: Pin,
  sourceType: EvidenceFlowRow["sourceType"],
  live: Live,
): EvidenceFlowRow {
  const elementMissing = Boolean(live.elementMissing);
  const readable =
    !elementMissing &&
    (live.brokenReason === null || live.brokenReason === "Archived");
  return {
    id: row.id,
    sourceType,
    pin: readable ? pin : null,
    role: readable ? evidenceRoleSchema.parse(row.role) : null,
    interpretation: readable ? row.interpretation : null,
    source: {
      recordId: pin.source.recordId,
      projectId:
        live.source && !live.brokenReason ? pin.source.projectId : null,
      title:
        live.brokenReason === "No access" ? null : (live.source?.title ?? null),
      brokenReason: live.brokenReason,
      canOpenSourceRecord:
        live.source !== null && live.brokenReason !== "No access",
    },
    elementMissing,
    newerVersionExists: live.source
      ? pin.source.revision < live.source.revision
      : false,
    relatedAt: row.createdAt.toISOString(),
  };
}

const LIVE_READERS = {
  Document: liveSource,
  Source: liveSourceRecord,
  "Research Session": liveResearchSession,
} as const;

/** Read-only derived view of explicit `Kanıtı` bindings; nothing is written or stored. */
export function readEvidenceFlow(
  database: Database,
  accountId: string,
  raw: unknown,
) {
  const { sourceType, ...target } = evidenceFlowInputSchema.parse(raw);
  return database.transaction(
    async (executor) => {
      const owner = await evidenceProject(
        executor,
        accountId,
        target.projectId,
        false,
      );
      if (!(owner && (await evidenceTarget(executor, target, false)))) {
        return null;
      }
      const rows = await executor
        .select()
        .from(evidenceBinding)
        .where(
          and(
            eq(evidenceBinding.targetProjectId, target.projectId),
            eq(evidenceBinding.targetRecordId, target.recordId),
            eq(evidenceBinding.targetRecordType, target.type),
          ),
        )
        .orderBy(asc(evidenceBinding.createdAt), asc(evidenceBinding.id));
      const result: EvidenceFlowRow[] = [];
      for (const row of rows) {
        const pin = versionPinnedEvidenceSchema.parse(row.pin);
        const type = pin.source.recordType;
        if (
          (type !== "Document" &&
            type !== "Source" &&
            type !== "Research Session") ||
          (sourceType && type !== sourceType)
        ) {
          continue;
        }
        const read = LIVE_READERS[type];
        result.push(
          flowRow(
            row,
            pin,
            type,
            await read(executor, accountId, owner.workspaceId, pin),
          ),
        );
      }
      return result;
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
