import { versionPinnedEvidenceSchema } from "@cantiara/api/evidence";
import type { SpecChangeReviewSummary } from "@cantiara/api/spec-change-review";
import type { SpecCandidateLink } from "@cantiara/api/spec-change-review-candidates";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { evidenceBinding } from "@cantiara/db/schema/evidence";
import { project } from "@cantiara/db/schema/project";
import { usageLink, workRelation } from "@cantiara/db/schema/relation";
import { work } from "@cantiara/db/schema/work";
import { and, eq, inArray, isNull } from "drizzle-orm";

async function ownedWorkspaceId(database: Database, accountId: string) {
  const [owned] = await database
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return owned?.id ?? null;
}

function sectionIdOf(location: unknown) {
  if (typeof location !== "object" || location === null) {
    return null;
  }
  const { sectionId } = location as { sectionId?: unknown };
  return typeof sectionId === "string" && sectionId.trim() !== ""
    ? sectionId
    : null;
}

async function primarySpecLinks(
  database: Database,
  workspaceId: string,
  documentId: string,
): Promise<SpecCandidateLink[]> {
  const bound = await database
    .select({ id: work.id })
    .from(work)
    .innerJoin(project, eq(work.projectId, project.id))
    .where(
      and(
        eq(project.workspaceId, workspaceId),
        eq(work.primarySpecId, documentId),
      ),
    );
  return bound.map((row) => ({
    detail: null,
    kind: "Primary spec",
    pin: null,
    record: { recordId: row.id, recordType: "Work" },
    sectionId: null,
  }));
}

async function relationLinks(
  database: Database,
  workspaceId: string,
  documentId: string,
): Promise<SpecCandidateLink[]> {
  const relations = await database
    .select({
      kind: workRelation.kind,
      sourceRecordType: workRelation.sourceRecordType,
      sourceWorkId: workRelation.sourceWorkId,
    })
    .from(workRelation)
    .innerJoin(work, eq(workRelation.sourceWorkId, work.id))
    .innerJoin(project, eq(work.projectId, project.id))
    .where(
      and(
        eq(project.workspaceId, workspaceId),
        eq(workRelation.targetRecordType, "Document"),
        eq(workRelation.targetRecordId, documentId),
        isNull(workRelation.deletedAt),
      ),
    );
  return relations.map((row) => ({
    detail: row.kind === "Primary spec" ? null : row.kind,
    kind: row.kind === "Primary spec" ? "Primary spec" : "Explicit relation",
    pin: null,
    record: { recordId: row.sourceWorkId, recordType: row.sourceRecordType },
    sectionId: null,
  }));
}

function usageCandidateLink(row: {
  kind: string;
  location: unknown;
  surfaceRecordId: string;
  surfaceRecordType: string;
}): SpecCandidateLink {
  const record = {
    recordId: row.surfaceRecordId,
    recordType: row.surfaceRecordType,
  };
  const sectionId = sectionIdOf(row.location);
  if (row.kind === "Inline reference") {
    return {
      detail: null,
      kind: "Inline reference",
      pin: null,
      record,
      sectionId: null,
    };
  }
  if (row.kind === "Section reference" && sectionId) {
    return {
      detail: null,
      kind: "Stable section reference",
      pin: null,
      record,
      sectionId,
    };
  }
  return {
    detail: row.kind === "Section reference" ? "Section reference" : null,
    kind: "Live content use",
    pin: null,
    record,
    sectionId: null,
  };
}

async function usageLinks(
  database: Database,
  workspaceId: string,
  documentId: string,
): Promise<SpecCandidateLink[]> {
  const usages = await database
    .select({
      kind: usageLink.kind,
      location: usageLink.location,
      surfaceRecordId: usageLink.surfaceRecordId,
      surfaceRecordType: usageLink.surfaceRecordType,
    })
    .from(usageLink)
    .where(
      and(
        eq(usageLink.workspaceId, workspaceId),
        eq(usageLink.sourceRecordType, "Document"),
        eq(usageLink.sourceRecordId, documentId),
        inArray(usageLink.kind, [
          "Inline reference",
          "Section reference",
          "Live block",
        ]),
      ),
    );
  return usages
    .filter(
      (row) =>
        !(
          row.surfaceRecordType === "Document" &&
          row.surfaceRecordId === documentId
        ),
    )
    .map(usageCandidateLink);
}

async function evidenceLinks(
  database: Database,
  workspaceId: string,
  documentId: string,
): Promise<SpecCandidateLink[]> {
  const evidence = await database
    .select({
      pin: evidenceBinding.pin,
      targetRecordId: evidenceBinding.targetRecordId,
      targetRecordType: evidenceBinding.targetRecordType,
    })
    .from(evidenceBinding)
    .where(
      and(
        eq(evidenceBinding.workspaceId, workspaceId),
        eq(evidenceBinding.sourceRecordId, documentId),
      ),
    );
  const links: SpecCandidateLink[] = [];
  for (const row of evidence) {
    const pin = versionPinnedEvidenceSchema.safeParse(row.pin);
    if (
      pin.success &&
      pin.data.source.recordType === "Document" &&
      pin.data.source.recordId === documentId
    ) {
      links.push({
        detail: `Pinned to Version ${pin.data.source.revision}`,
        kind: "Version-pinned evidence",
        pin: { revision: pin.data.source.revision, start: pin.data.start },
        record: {
          recordId: row.targetRecordId,
          recordType: row.targetRecordType,
        },
        sectionId: null,
      });
    }
  }
  return links;
}

/**
 * The recorded-link closure of a spec Document: the only places a candidate
 * can come from. Every query is bound to the account's own Workspace, so a
 * link row of another Workspace is never read.
 */
export async function readRecordedLinks(
  database: Database,
  accountId: string,
  { documentId }: Pick<SpecChangeReviewSummary, "documentId">,
): Promise<SpecCandidateLink[]> {
  const workspaceId = await ownedWorkspaceId(database, accountId);
  if (!workspaceId) {
    return [];
  }
  const groups = await Promise.all([
    primarySpecLinks(database, workspaceId, documentId),
    relationLinks(database, workspaceId, documentId),
    usageLinks(database, workspaceId, documentId),
    evidenceLinks(database, workspaceId, documentId),
  ]);
  return groups.flat();
}
