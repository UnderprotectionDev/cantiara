import { canonicalizeMutationPayload } from "@cantiara/api/mutation-and-undo";
import {
  previewResearchSessionBinding,
  researchBindingPlanSchema,
  researchEvidenceBindingSchema,
} from "@cantiara/api/research-session-bindings";
import type { ResearchSessionRecord } from "@cantiara/api/research-sessions";
import { researchSessionBindingPreview } from "@cantiara/db/schema/research-session";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { writeEvidenceBinding } from "../../evidence/server/evidence-database";
import { MutationConflictError } from "../../mutation-and-undo/server/mutation-contract";
import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";
import {
  createResearchBindingTarget,
  researchBindingTarget,
} from "./research-binding-targets";

/** Invoked only inside the Research Session's atomic mutation transaction. */
export async function commitResearchSessionBinding(
  executor: MutationDatabaseExecutor,
  input: {
    previewId: string;
    session: ResearchSessionRecord;
    accountId: string;
    workspaceId: string;
    baseRevision: number;
    committedAt: Date;
    idempotencyKey: string;
    payloadFingerprint: string;
  },
) {
  const [preview] = await executor
    .select()
    .from(researchSessionBindingPreview)
    .where(
      and(
        eq(researchSessionBindingPreview.id, input.previewId),
        eq(researchSessionBindingPreview.accountId, input.accountId),
        eq(researchSessionBindingPreview.sessionId, input.session.id),
        eq(researchSessionBindingPreview.projectId, input.session.projectId),
      ),
    )
    .for("update");
  if (
    !preview ||
    preview.confirmedBindingId ||
    preview.expiresAt <= input.committedAt
  ) {
    throw new MutationConflictError(input.session.id);
  }
  const plan = researchBindingPlanSchema.parse(preview.plan);
  if (plan.pin.source.revision !== input.baseRevision) {
    throw new MutationConflictError(input.session.id);
  }
  // Rebuild the exact pinned range with CURRENT and capture-time Consent at the commit barrier.
  const current = { ...input.session, revision: input.baseRevision };
  const { componentId } = plan.pin.source;
  if (!componentId) {
    throw new MutationConflictError(input.session.id);
  }
  const rechecked = previewResearchSessionBinding(current, {
    id: input.session.id,
    projectId: input.session.projectId,
    baseRevision: input.baseRevision,
    clientIdempotencyKey: input.idempotencyKey,
    contentId: componentId,
    start: plan.pin.start,
    end: plan.pin.end,
    target: plan.target,
  });
  if (
    canonicalizeMutationPayload(rechecked) !== canonicalizeMutationPayload(plan)
  ) {
    throw new MutationConflictError(input.session.id);
  }
  const target = await researchBindingTarget(
    executor,
    input.accountId,
    plan.target,
    true,
  );
  if (target.project.workspaceId !== input.workspaceId) {
    throw new ORPCError("NOT_FOUND");
  }
  const recordId =
    plan.target.mode === "create" ? crypto.randomUUID() : plan.target.recordId;
  await createResearchBindingTarget(executor, plan, target.project, {
    recordId,
    committedAt: input.committedAt,
    idempotencyKey: input.idempotencyKey,
    payloadFingerprint: input.payloadFingerprint,
  });
  const binding = researchEvidenceBindingSchema.parse({
    id: crypto.randomUUID(),
    pin: plan.pin,
    target: {
      recordId,
      projectId: target.project.id,
      type: plan.target.type,
      label: target.label,
    },
    origin: plan.target.mode === "create",
    actorId: input.accountId,
    createdAt: input.committedAt.toISOString(),
  });
  await writeEvidenceBinding(executor, {
    ...binding,
    workspaceId: input.workspaceId,
    committedAt: input.committedAt,
  });
  await executor
    .update(researchSessionBindingPreview)
    .set({ confirmedBindingId: binding.id })
    .where(eq(researchSessionBindingPreview.id, preview.id));

  return binding;
}
