import {
  type SpecChangeReviewMarkValue,
  type SpecChangeReviewMutationContracts,
  specChangeReviewMarkPayloadSchema,
} from "@cantiara/api/spec-change-review-candidates";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import {
  specChangeReview,
  specChangeReviewMark,
} from "@cantiara/db/schema/spec-change-review";
import { and, eq } from "drizzle-orm";

import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { toMark } from "./spec-change-review-candidates-database";

async function ownsReview(
  executor: MutationDatabaseExecutor,
  accountId: string,
  reviewId: string,
) {
  const [owned] = await executor
    .select({ id: specChangeReview.id })
    .from(specChangeReview)
    .innerJoin(project, eq(specChangeReview.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(specChangeReview.id, reviewId),
        eq(workspace.ownerAccountId, accountId),
      ),
    )
    .limit(1);
  return owned !== undefined;
}

/**
 * The mark target is one candidate of one version pair. It writes only the
 * `spec_change_review_mark` row: no candidate record, Work status, relation,
 * planning or Feedback table is reachable from this adapter.
 */
function createMarkTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<SpecChangeReviewMarkValue> {
  return {
    async find(executor, targetId, lock, context) {
      const payload = specChangeReviewMarkPayloadSchema.safeParse(
        context?.payload,
      );
      const reviewId = targetId.slice(0, targetId.lastIndexOf(":"));
      if (
        (payload.success && payload.data.reviewId !== reviewId) ||
        !(await ownsReview(executor, accountId, reviewId))
      ) {
        return null;
      }
      const query = executor
        .select()
        .from(specChangeReviewMark)
        .where(
          and(
            eq(specChangeReviewMark.id, targetId),
            eq(specChangeReviewMark.reviewId, reviewId),
          ),
        )
        .limit(1);
      const [row] = lock ? await query.for("update") : await query;
      return row
        ? {
            id: targetId,
            revision: row.revision,
            value: { mark: toMark(row) },
          }
        : { id: targetId, revision: 0, value: { mark: null } };
    },

    async update(executor, input) {
      const next = input.nextValue.mark;
      if (!(next && (await ownsReview(executor, accountId, next.reviewId)))) {
        return null;
      }
      const fields = {
        note: next.note,
        state: next.state,
        updatedAt: input.committedAt,
      };
      if (input.expectedRevision === 0) {
        const [created] = await executor
          .insert(specChangeReviewMark)
          .values({
            ...fields,
            createdAt: input.committedAt,
            id: input.targetId,
            recordId: next.candidate.recordId,
            recordType: next.candidate.recordType,
            revision: 1,
            reviewId: next.reviewId,
            sectionId: next.candidate.sectionId ?? "",
          })
          .onConflictDoNothing()
          .returning();
        return created
          ? {
              id: input.targetId,
              revision: created.revision,
              value: { mark: toMark(created) },
            }
          : null;
      }
      const [updated] = await executor
        .update(specChangeReviewMark)
        .set({ ...fields, revision: input.expectedRevision + 1 })
        .where(
          and(
            eq(specChangeReviewMark.id, input.targetId),
            eq(specChangeReviewMark.revision, input.expectedRevision),
          ),
        )
        .returning();
      return updated
        ? {
            id: input.targetId,
            revision: updated.revision,
            value: { mark: toMark(updated) },
          }
        : null;
    },
  };
}

export function createDatabaseSpecChangeReviewMutationContracts(
  database: Database,
): SpecChangeReviewMutationContracts {
  return {
    mark: (accountId) =>
      createDatabaseMutationContract<SpecChangeReviewMarkValue>(database, {
        target: createMarkTarget(accountId),
      }),
  };
}
