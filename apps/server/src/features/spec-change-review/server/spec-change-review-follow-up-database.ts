import {
  type SpecChangeReviewFollowUpValue,
  specChangeReviewFollowUpPayloadSchema,
  specFollowUpOrigin,
} from "@cantiara/api/spec-change-review-follow-up";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import {
  specChangeReview,
  specChangeReviewFollowUp,
} from "@cantiara/db/schema/spec-change-review";
import { and, eq } from "drizzle-orm";

import { insertConvertedRecord } from "../../evidence/server/evidence-record-creation";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { toFollowUp } from "./spec-change-review-candidates-database";

/** Locks the account's Project row of the review; the Work key is allocated under it. */
async function lockReviewProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  reviewId: string,
  lock = true,
) {
  const [owned] = await executor
    .select({ projectId: specChangeReview.projectId })
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
  if (!owned) {
    return null;
  }
  const query = executor
    .select()
    .from(project)
    .where(eq(project.id, owned.projectId));
  const [row] = lock ? await query.for("update") : await query;
  return row ?? null;
}

/**
 * The follow-up target is one candidate of one version pair. It creates the
 * single Work through the shared conversion insert (Project key allocation and
 * Origin Location columns behave as for every other conversion) and writes the
 * candidate link row. The mark table, the candidate record and every
 * Test Gap, automation or Refuted Assumption table are unreachable from here.
 */
function createFollowUpTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<SpecChangeReviewFollowUpValue> {
  return {
    // The committed receipt carries the allocated Work key.
    committedValue: (target) => target.value,
    async find(executor, targetId, lock, context) {
      const payload = specChangeReviewFollowUpPayloadSchema.safeParse(
        context?.payload,
      );
      const reviewId = targetId.slice(0, targetId.lastIndexOf(":"));
      if (
        (payload.success && payload.data.reviewId !== reviewId) ||
        !(await lockReviewProject(executor, accountId, reviewId, lock))
      ) {
        return null;
      }
      const query = executor
        .select()
        .from(specChangeReviewFollowUp)
        .where(
          and(
            eq(specChangeReviewFollowUp.id, targetId),
            eq(specChangeReviewFollowUp.reviewId, reviewId),
          ),
        )
        .limit(1);
      const [row] = lock ? await query.for("update") : await query;
      return {
        id: targetId,
        revision: row?.revision ?? 0,
        value: {
          followUp: row ? toFollowUp(row, null) : null,
          plan: null,
        },
      };
    },

    async update(executor, input) {
      const { followUp, plan } = input.nextValue;
      if (!(followUp && plan) || input.expectedRevision !== 0) {
        return null;
      }
      const owner = await lockReviewProject(
        executor,
        accountId,
        followUp.reviewId,
      );
      if (!owner || owner.archivedAt) {
        return null;
      }
      const [existing] = await executor
        .select({ id: specChangeReviewFollowUp.id })
        .from(specChangeReviewFollowUp)
        .where(eq(specChangeReviewFollowUp.id, input.targetId))
        .limit(1);
      if (existing) {
        return null;
      }
      const workKey = await insertWork(executor, owner, input, followUp, plan);
      await executor.insert(specChangeReviewFollowUp).values({
        actorId: accountId,
        createdAt: input.committedAt,
        id: input.targetId,
        recordId: followUp.candidate.recordId,
        recordType: followUp.candidate.recordType,
        revision: 1,
        reviewId: followUp.reviewId,
        sectionId: followUp.candidate.sectionId ?? "",
        workId: followUp.workId,
      });
      return {
        id: input.targetId,
        revision: 1,
        value: {
          followUp: { ...followUp, revision: 1, workKey },
          plan,
        },
      };
    },
  };
}

async function insertWork(
  executor: MutationDatabaseExecutor,
  owner: typeof project.$inferSelect,
  input: {
    committedAt: Date;
    idempotencyKey: { key: string | number };
    payloadFingerprint: string;
  },
  followUp: { workId: string },
  plan: NonNullable<SpecChangeReviewFollowUpValue["plan"]>,
) {
  await insertConvertedRecord(executor, owner, {
    body: plan.work.description,
    committedAt: input.committedAt,
    idempotencyKey: String(input.idempotencyKey.key),
    origin: specFollowUpOrigin(plan),
    payloadFingerprint: input.payloadFingerprint,
    recordId: followUp.workId,
    title: plan.work.title,
    type: "Work",
    workType: plan.work.type,
  });
  return `${owner.shortCode}-${owner.workCount + 1}`;
}

export function createDatabaseFollowUpContract(
  database: Database,
  accountId: string,
) {
  return createDatabaseMutationContract<SpecChangeReviewFollowUpValue>(
    database,
    { target: createFollowUpTarget(accountId) },
  );
}
