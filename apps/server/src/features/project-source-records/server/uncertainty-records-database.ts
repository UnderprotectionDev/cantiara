import { assumptionRecordSchema } from "@cantiara/api/project-source-records";
import type { AssumptionsContext } from "@cantiara/api/uncertainty-records";
import type { Database } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import { document } from "@cantiara/db/schema/document";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { usageLink, workRelation } from "@cantiara/db/schema/relation";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const pinnedLocation = z.object({
  documentVersion: z.object({ documentId: z.string(), revision: z.number() }),
  excerpt: z.string(),
  projectId: z.string().optional(),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().positive().optional(),
});

export async function readUncertaintyDocumentPins(
  database: Database,
  ownedProject: typeof project.$inferSelect,
  sourceType: "Assumption" | "Open Question",
  recordIds: string[],
) {
  const pins = await database
    .select({
      link: usageLink,
      title: document.title,
      documentProjectId: document.projectId,
    })
    .from(usageLink)
    .leftJoin(document, eq(usageLink.sourceRecordId, document.id))
    .where(
      and(
        eq(usageLink.workspaceId, ownedProject.workspaceId),
        eq(usageLink.surfaceRecordType, sourceType),
        eq(usageLink.sourceRecordType, "Document"),
        eq(usageLink.kind, "Pinned bind"),
        inArray(usageLink.surfaceRecordId, recordIds),
      ),
    )
    .orderBy(asc(usageLink.createdAt), asc(usageLink.id));
  const parsedPins = pins.flatMap(({ link, title, documentProjectId }) => {
    const parsed = pinnedLocation.safeParse(link.location);
    return parsed.success &&
      parsed.data.documentVersion.documentId === link.sourceRecordId
      ? [{ link, title, documentProjectId, location: parsed.data }]
      : [];
  });
  const legacyIds = parsedPins
    .filter(
      (pin) =>
        pin.location.projectId === undefined &&
        pin.documentProjectId !== ownedProject.id,
    )
    .map((pin) => pin.link.sourceRecordId);
  const history =
    legacyIds.length === 0
      ? []
      : await database
          .select({
            before: sql<unknown>`jsonb_build_object('id', ${mutationHistory.previousValue}->'document'->'id', 'projectId', ${mutationHistory.previousValue}->'document'->'projectId', 'revision', ${mutationHistory.previousValue}->'document'->'revision')`,
            after: sql<unknown>`jsonb_build_object('id', ${mutationHistory.nextValue}->'document'->'id', 'projectId', ${mutationHistory.nextValue}->'document'->'projectId', 'revision', ${mutationHistory.nextValue}->'document'->'revision')`,
          })
          .from(mutationHistory)
          .where(inArray(mutationHistory.targetId, legacyIds));
  const scopeSnapshot = z.object({
    id: z.string(),
    projectId: z.string(),
    revision: z.number().int(),
  });
  const verifiedVersions = new Set(
    history
      .flatMap((entry) => [entry.before, entry.after])
      .flatMap((snapshot) => {
        const parsed = scopeSnapshot.safeParse(snapshot);
        return parsed.success && parsed.data.projectId === ownedProject.id
          ? [`${parsed.data.id}:${parsed.data.revision}`]
          : [];
      }),
  );
  return parsedPins
    .filter(
      ({ location, documentProjectId }) =>
        location.projectId === ownedProject.id ||
        (location.projectId === undefined &&
          (documentProjectId === ownedProject.id ||
            verifiedVersions.has(
              `${location.documentVersion.documentId}:${location.documentVersion.revision}`,
            ))),
    )
    .map((pin) => ({
      ...pin,
      title:
        pin.documentProjectId === ownedProject.id
          ? (pin.title ?? "Document unavailable")
          : "Document unavailable",
    }));
}

export async function readAssumptionsContext(
  database: Database,
  ownedProject: typeof project.$inferSelect,
): Promise<AssumptionsContext> {
  const rows = await database
    .select()
    .from(assumption)
    .where(eq(assumption.projectId, ownedProject.id))
    .orderBy(asc(assumption.createdAt), asc(assumption.id));
  const records = rows.map((row) =>
    assumptionRecordSchema.parse({
      ...row,
      sourceType: "Assumption",
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }),
  );
  if (records.length === 0) {
    return {
      records,
      evidence: [],
      readOnly: ownedProject.archivedAt !== null,
    };
  }
  const ids = records.map((record) => record.id);
  const [pins, workEvidence] = await Promise.all([
    readUncertaintyDocumentPins(database, ownedProject, "Assumption", ids),
    database
      .select({
        link: workRelation,
        title: work.title,
        revision: work.revision,
      })
      .from(workRelation)
      .innerJoin(work, eq(workRelation.sourceWorkId, work.id))
      .innerJoin(project, eq(work.projectId, project.id))
      .where(
        and(
          eq(workRelation.targetProjectId, ownedProject.id),
          eq(project.workspaceId, ownedProject.workspaceId),
          eq(workRelation.targetRecordType, "Assumption"),
          eq(workRelation.kind, "Evidence"),
          isNull(workRelation.deletedAt),
          inArray(workRelation.targetRecordId, ids),
        ),
      ),
  ]);
  return {
    records,
    readOnly: ownedProject.archivedAt !== null,
    evidence: [
      ...pins.map(({ link, title, location }) => ({
        id: link.id,
        assumptionId: link.surfaceRecordId,
        documentId: location.documentVersion.documentId,
        title,
        revision: location.documentVersion.revision,
        excerpt: location.excerpt,
      })),
      ...workEvidence.map(({ link, title, revision }) => ({
        id: link.id,
        assumptionId: link.targetRecordId,
        documentId: null,
        title,
        revision,
        excerpt: null,
      })),
    ],
  };
}
