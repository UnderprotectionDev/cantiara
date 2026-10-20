import {
  featuresBoundToPrimarySpec,
  type SpecChangeReviewSummary,
} from "@cantiara/api/spec-change-review";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import { specChangeReview } from "@cantiara/db/schema/spec-change-review";
import { work } from "@cantiara/db/schema/work";
import { and, desc, eq } from "drizzle-orm";

import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";
import type { SpecChangeReviewStore } from "./spec-change-review";
import {
  readMarks,
  resolveCandidateRecords,
} from "./spec-change-review-candidates-database";
import { readRecordedLinks } from "./spec-change-review-links-database";

/**
 * Opens a Spec Change Review for every Feature whose `Primary spec` is the
 * saved Document. Runs in the transaction of the Document version save, so a
 * saved version and its review pair commit or roll back together; an earlier
 * pair is never touched. Replaying the same version is a no-op.
 */
export async function openSpecChangeReviews(
  executor: MutationDatabaseExecutor,
  input: {
    createdAt: Date;
    documentId: string;
    nextRevision: number;
    previousRevision: number;
    projectId: string | null;
  },
) {
  if (input.projectId === null || input.previousRevision < 1) {
    return;
  }
  const bound = await executor
    .select({
      id: work.id,
      primarySpecId: work.primarySpecId,
      projectId: work.projectId,
      trashedAt: work.trashedAt,
      type: work.type,
    })
    .from(work)
    .where(
      and(
        eq(work.projectId, input.projectId),
        eq(work.primarySpecId, input.documentId),
      ),
    );
  const features = featuresBoundToPrimarySpec(bound, input.documentId);
  if (features.length === 0) {
    return;
  }
  await executor
    .insert(specChangeReview)
    .values(
      features.map((feature) => ({
        createdAt: input.createdAt,
        documentId: input.documentId,
        featureId: feature.id,
        id: crypto.randomUUID(),
        nextRevision: input.nextRevision,
        previousRevision: input.previousRevision,
        projectId: input.projectId as string,
      })),
    )
    .onConflictDoNothing();
}

function toSummary(row: {
  review: typeof specChangeReview.$inferSelect;
  documentTitle: string;
  featureKey: string;
  featureTitle: string;
}): SpecChangeReviewSummary {
  return {
    createdAt: row.review.createdAt.toISOString(),
    documentId: row.review.documentId,
    documentTitle: row.documentTitle,
    featureId: row.review.featureId,
    featureKey: row.featureKey,
    featureTitle: row.featureTitle,
    id: row.review.id,
    nextRevision: row.review.nextRevision,
    previousRevision: row.review.previousRevision,
    projectId: row.review.projectId,
  };
}

export function createDatabaseSpecChangeReviewStore(
  database: Database,
): SpecChangeReviewStore {
  const reviewRows = () =>
    database
      .select({
        documentTitle: document.title,
        featureKey: work.key,
        featureTitle: work.title,
        review: specChangeReview,
      })
      .from(specChangeReview)
      .innerJoin(project, eq(specChangeReview.projectId, project.id))
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .innerJoin(document, eq(specChangeReview.documentId, document.id))
      .innerJoin(work, eq(specChangeReview.featureId, work.id));

  return {
    marks: (accountId, reviewId) => readMarks(database, accountId, reviewId),
    recordedLinks: (accountId, review) =>
      readRecordedLinks(database, accountId, review),
    resolveRecords: (accountId, records) =>
      resolveCandidateRecords(database, accountId, records),
    async find(accountId, reviewId) {
      const [row] = await reviewRows()
        .where(
          and(
            eq(specChangeReview.id, reviewId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .limit(1);
      return row ? toSummary(row) : null;
    },
    async list(accountId, projectId) {
      const [owned] = await database
        .select({ id: project.id })
        .from(project)
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(project.id, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .limit(1);
      if (!owned) {
        return null;
      }
      const rows = await reviewRows()
        .where(
          and(
            eq(specChangeReview.projectId, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .orderBy(
          desc(specChangeReview.createdAt),
          desc(specChangeReview.nextRevision),
        );
      return rows.map(toSummary);
    },
  };
}
