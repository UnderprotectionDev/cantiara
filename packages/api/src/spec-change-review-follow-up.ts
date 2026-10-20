import { z } from "zod";
import {
  fingerprintMutationPayload,
  humanMutationEnvelopeSchema,
  type MutationContract,
} from "./mutation-and-undo";
import type { SpecChangeReviewSummary } from "./spec-change-review";
import {
  type SpecCandidateChangedSection,
  type SpecCandidateIdentity,
  type SpecCandidateReason,
  type SpecChangeReviewCandidate,
  specCandidateIdentitySchema,
} from "./spec-change-review-candidates";

const identifierSchema = z.string().trim().min(1).max(255);

/**
 * `Create Follow-up Work` of one Spec Change Review candidate (spec 52 #391).
 * Preview first: the plan names the one Work, its Project, starting status,
 * the changed spec versions and why the record is a candidate. Confirming
 * creates exactly that Work with an Origin Location on the spec Document and
 * leaves the review metadata untouched.
 */
export const SPEC_FOLLOW_UP_WORK_TYPES = [
  "Task",
  "Bug",
  "Research",
  "Improvement",
] as const;
export const specFollowUpWorkTypeSchema = z.enum(SPEC_FOLLOW_UP_WORK_TYPES);
export type SpecFollowUpWorkType = z.infer<typeof specFollowUpWorkTypeSchema>;

/** The starting status of every Work the founder creates: the Work lifecycle default. */
export const SPEC_FOLLOW_UP_STARTING_STATUS = "Not Started";

const titleSchema = z.string().trim().min(1).max(255);

export const previewSpecChangeReviewFollowUpInputSchema = z
  .object({
    candidate: specCandidateIdentitySchema,
    reviewId: identifierSchema,
    title: titleSchema.optional(),
    workType: specFollowUpWorkTypeSchema.optional(),
  })
  .strict();
export type PreviewSpecChangeReviewFollowUpInput = z.input<
  typeof previewSpecChangeReviewFollowUpInputSchema
>;

export interface SpecChangeReviewFollowUpPlan {
  candidate: SpecCandidateIdentity;
  /** Why the record is a candidate: the recorded links, never a similarity. */
  candidateSource: {
    changedSection: SpecCandidateChangedSection | null;
    documentLevel: boolean;
    reasons: SpecCandidateReason[];
    record: {
      label: string | null;
      recordType: string;
      title: string;
    };
  };
  /** Exactly one Work; a queue row never becomes a Work by itself. */
  recordCount: 1;
  relation: "Origin";
  reviewId: string;
  specVersions: {
    documentId: string;
    documentTitle: string;
    nextRevision: number;
    previousRevision: number;
  };
  targetProject: { id: string; name: string };
  work: {
    description: string;
    startingStatus: typeof SPEC_FOLLOW_UP_STARTING_STATUS;
    title: string;
    type: SpecFollowUpWorkType;
  };
}

export interface SpecChangeReviewFollowUpPreview {
  /** Identifies the exact plan; confirm is rejected when the state moved on. */
  fingerprint: string;
  plan: SpecChangeReviewFollowUpPlan;
}

function reasonText(reason: SpecCandidateReason) {
  return reason.detail ? `${reason.kind} (${reason.detail})` : reason.kind;
}

/** Pure and deterministic: the same state always yields the same plan. */
export function buildSpecFollowUpPlan(input: {
  candidate: SpecChangeReviewCandidate;
  review: SpecChangeReviewSummary;
  title?: string;
  workType?: SpecFollowUpWorkType;
}): SpecChangeReviewFollowUpPlan {
  const { candidate, review } = input;
  const recordTitle = candidate.record.title ?? "";
  const name = [candidate.record.label, recordTitle].filter(Boolean).join(" ");
  const title = (input.title ?? `Follow up spec change: ${name}`)
    .trim()
    .slice(0, 255);
  const scope = candidate.documentLevel
    ? "Document-level candidate"
    : `Section ${candidate.identity.sectionId}`;
  const description = [
    `Spec "${review.documentTitle}" changed from Version ${review.previousRevision} to Version ${review.nextRevision}.`,
    `Candidate: ${candidate.record.recordType} ${name} (${scope}).`,
    `Why: ${candidate.reasons.map(reasonText).join(", ")}.`,
  ].join("\n");
  return {
    candidate: candidate.identity,
    candidateSource: {
      changedSection: candidate.changedSection,
      documentLevel: candidate.documentLevel,
      reasons: candidate.reasons,
      record: {
        label: candidate.record.label,
        recordType: candidate.record.recordType,
        title: recordTitle,
      },
    },
    recordCount: 1,
    relation: "Origin",
    reviewId: review.id,
    specVersions: {
      documentId: review.documentId,
      documentTitle: review.documentTitle,
      nextRevision: review.nextRevision,
      previousRevision: review.previousRevision,
    },
    targetProject: { id: review.projectId, name: review.projectName },
    work: {
      description,
      startingStatus: SPEC_FOLLOW_UP_STARTING_STATUS,
      title: title || "Follow up spec change",
      type: input.workType ?? "Task",
    },
  };
}

export async function specFollowUpPreview(
  plan: SpecChangeReviewFollowUpPlan,
): Promise<SpecChangeReviewFollowUpPreview> {
  return {
    fingerprint: await fingerprintMutationPayload(
      plan as unknown as Parameters<typeof fingerprintMutationPayload>[0],
    ),
    plan,
  };
}

/** The Origin Location the Work carries; both revisions stay readable. */
export function specFollowUpOrigin(plan: SpecChangeReviewFollowUpPlan) {
  return {
    componentId: plan.reviewId,
    ownerRecordId: plan.specVersions.documentId,
    sourceVersion: `${plan.specVersions.previousRevision} → ${plan.specVersions.nextRevision}`,
  };
}

/**
 * Confirm names the same single candidate, the Work identity and the preview
 * fingerprint it was shown. There is no list of candidates, so a bulk
 * follow-up cannot be expressed.
 */
export const createSpecChangeReviewFollowUpInputSchema =
  humanMutationEnvelopeSchema.extend({
    candidate: specCandidateIdentitySchema,
    previewFingerprint: z.string().trim().length(64),
    reviewId: identifierSchema,
    title: titleSchema.optional(),
    /** Identity of the single new Work; a retry with the same key creates nothing new. */
    workId: identifierSchema,
    workType: specFollowUpWorkTypeSchema.optional(),
  });
export type CreateSpecChangeReviewFollowUpInput = z.input<
  typeof createSpecChangeReviewFollowUpInputSchema
>;

export const specChangeReviewFollowUpPayloadSchema =
  createSpecChangeReviewFollowUpInputSchema.pick({
    candidate: true,
    previewFingerprint: true,
    reviewId: true,
    title: true,
    workId: true,
    workType: true,
  });

/** The link between one candidate of one version pair and the Work it opened. */
export interface SpecChangeReviewFollowUp {
  candidate: SpecCandidateIdentity;
  createdAt: string;
  id: string;
  reviewId: string;
  revision: number;
  workId: string;
  /** Live key and title of the Work; `null` once it no longer exists. */
  workKey: string | null;
  workTitle: string | null;
}

export interface SpecChangeReviewFollowUpValue {
  followUp: SpecChangeReviewFollowUp | null;
  /** What the adapter writes; carried so it needs no second preview. */
  plan: SpecChangeReviewFollowUpPlan | null;
}

export type SpecChangeReviewFollowUpContract =
  MutationContract<SpecChangeReviewFollowUpValue>;

/** Deterministic mutation target of one candidate's follow-up in one version pair. */
export async function specChangeReviewFollowUpId(
  reviewId: string,
  identity: SpecCandidateIdentity,
) {
  const digest = await fingerprintMutationPayload({
    operation: "specChangeReviewFollowUp",
    recordId: identity.recordId,
    recordType: identity.recordType,
    sectionId: identity.sectionId,
  });
  return `${reviewId}:${digest}`;
}
