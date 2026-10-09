import { assumptionRecordSchema } from "@cantiara/api/project-source-records";
import type { AssumptionsContext } from "@cantiara/api/uncertainty-records";
import type { Database } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import { document } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import { usageLink, workRelation } from "@cantiara/db/schema/relation";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

const pinnedLocation = z.object({
  documentVersion: z.object({ documentId: z.string(), revision: z.number() }),
  excerpt: z.string(),
});

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
    database
      .select({ link: usageLink, title: document.title })
      .from(usageLink)
      .leftJoin(document, eq(usageLink.sourceRecordId, document.id))
      .where(
        and(
          eq(usageLink.workspaceId, ownedProject.workspaceId),
          eq(usageLink.surfaceRecordType, "Assumption"),
          eq(usageLink.sourceRecordType, "Document"),
          eq(usageLink.kind, "Pinned bind"),
          inArray(usageLink.surfaceRecordId, ids),
        ),
      )
      .orderBy(asc(usageLink.createdAt), asc(usageLink.id)),
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
      ...pins.flatMap(({ link, title }) => {
        const location = pinnedLocation.safeParse(link.location);
        return location.success
          ? [
              {
                id: link.id,
                assumptionId: link.surfaceRecordId,
                documentId: location.data.documentVersion.documentId,
                title: title ?? "Document unavailable",
                revision: location.data.documentVersion.revision,
                excerpt: location.data.excerpt,
              },
            ]
          : [];
      }),
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
