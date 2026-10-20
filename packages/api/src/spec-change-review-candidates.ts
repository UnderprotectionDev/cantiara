import { z } from "zod";
import { documentSections } from "./documents";
import {
  fingerprintMutationPayload,
  humanMutationEnvelopeSchema,
  type MutationContract,
} from "./mutation-and-undo";
import type { BrokenReferenceReason, BrokenReferenceView } from "./relations";
import type {
  SpecSectionChangeKind,
  SpecVersionDiff,
} from "./spec-change-review";

const identifierSchema = z.string().trim().min(1).max(255);

/**
 * Spec Change Review candidates: the recorded-link closure of one exact
 * Document version pair, plus per-candidate review metadata. A candidate is
 * derived on read and never stored; only an explicit mark is persisted.
 */

/** Closed catalog of review metadata values (PRD: Bekliyor / Gözden geçirildi / Etkilenmedi). */
export const SPEC_REVIEW_STATES = [
  "Waiting",
  "Reviewed",
  "Not affected",
] as const;
export type SpecReviewState = (typeof SPEC_REVIEW_STATES)[number];
export const specReviewStateSchema = z.enum(SPEC_REVIEW_STATES);
export const SPEC_REVIEW_DEFAULT_STATE: SpecReviewState = "Waiting";

/** The only recorded links a candidate can come from. No similarity, no AI. */
export const SPEC_CANDIDATE_KINDS = [
  "Primary spec",
  "Stable section reference",
  "Inline reference",
  "Live content use",
  "Version-pinned evidence",
  "Explicit relation",
] as const;
export type SpecCandidateKind = (typeof SPEC_CANDIDATE_KINDS)[number];

export const SPEC_CANDIDATE_NOTE_MAX_LENGTH = 500;

/** A candidate is a record and, optionally, an exact stable section id. */
export const specCandidateIdentitySchema = z
  .object({
    recordId: identifierSchema,
    recordType: identifierSchema,
    sectionId: identifierSchema.nullable(),
  })
  .strict();
export type SpecCandidateIdentity = z.infer<typeof specCandidateIdentitySchema>;

export function specCandidateKey(identity: SpecCandidateIdentity) {
  return [
    identity.recordType,
    identity.recordId,
    identity.sectionId ?? "",
  ].join("|");
}

export function specCandidateRecordKey(record: {
  recordId: string;
  recordType: string;
}) {
  return `${record.recordType}|${record.recordId}`;
}

/** One recorded link from the spec Document to a candidate record, as the store read it. */
export interface SpecCandidateLink {
  /** Relation kind or pinned version label; never record content. */
  detail: string | null;
  kind: SpecCandidateKind;
  /** Version-pinned evidence: the pinned revision and start offset. */
  pin: { revision: number; start: number } | null;
  record: { recordId: string; recordType: string };
  /** Exact stable section id when the recorded link names one. */
  sectionId: string | null;
}

export interface SpecCandidateReason {
  detail: string | null;
  kind: SpecCandidateKind;
}

export interface SpecCandidateChangedSection {
  change: SpecSectionChangeKind;
  heading: string;
  sectionId: string;
}

export interface SpecCandidateDraft {
  changedSection: SpecCandidateChangedSection | null;
  identity: SpecCandidateIdentity;
  reasons: SpecCandidateReason[];
}

/** What the founder may see of a candidate record; a broken record carries no name. */
export interface SpecCandidateRecordView {
  broken: BrokenReferenceView | null;
  label: string | null;
  projectId: string | null;
  recordId: string;
  recordType: string;
  title: string | null;
}

export type SpecCandidateRecordResolution =
  | {
      label: string | null;
      projectId: string | null;
      status: "available";
      title: string;
    }
  | {
      at: string | null;
      projectId: string | null;
      reason: BrokenReferenceReason;
      status: "unavailable";
    };

export interface SpecChangeReviewMark {
  candidate: SpecCandidateIdentity;
  id: string;
  note: string | null;
  reviewId: string;
  revision: number;
  state: SpecReviewState;
  updatedAt: string;
}

export interface SpecCandidateReviewMetadata {
  note: string | null;
  /** `0` while the default `Waiting` is implicit and nothing was written. */
  revision: number;
  state: SpecReviewState;
  updatedAt: string | null;
}

export interface SpecChangeReviewCandidate {
  changedSection: SpecCandidateChangedSection | null;
  /** `Document-level candidate`: no exact section bind; never tied to a span. */
  documentLevel: boolean;
  identity: SpecCandidateIdentity;
  key: string;
  nextRevision: number;
  previousRevision: number;
  reasons: SpecCandidateReason[];
  record: SpecCandidateRecordView;
  review: SpecCandidateReviewMetadata;
}

interface VersionBody {
  body: string;
  revision: number;
}

function sectionIdAtOffset(body: string, offset: number): string | null {
  const seen = new Map<string, number>();
  let found: string | null = null;
  for (const section of documentSections(body)) {
    const occurrence = seen.get(section.id) ?? 0;
    seen.set(section.id, occurrence + 1);
    if (section.start > offset) {
      break;
    }
    found = occurrence === 0 ? section.id : `${section.id}#${occurrence + 1}`;
  }
  return found;
}

function linkSectionId(
  link: SpecCandidateLink,
  previous: VersionBody,
  next: VersionBody,
) {
  if (link.sectionId) {
    return link.sectionId;
  }
  if (!link.pin) {
    return null;
  }
  if (link.pin.revision === previous.revision) {
    return sectionIdAtOffset(previous.body, link.pin.start);
  }
  if (link.pin.revision === next.revision) {
    return sectionIdAtOffset(next.body, link.pin.start);
  }
  return null;
}

function reasonOrder(kind: SpecCandidateKind) {
  return SPEC_CANDIDATE_KINDS.indexOf(kind);
}

/**
 * The recorded-link closure of one version pair. Each recorded link becomes
 * (or joins) exactly one candidate keyed by record and exact section id; no
 * other input exists, so a record that only resembles the spec by title or
 * text can never appear. A candidate is tied to a changed section only when
 * its stable section id is among the sections the diff changed.
 */
export function deriveSpecCandidates(input: {
  diff: SpecVersionDiff;
  links: readonly SpecCandidateLink[];
  next: VersionBody;
  previous: VersionBody;
}): SpecCandidateDraft[] {
  const drafts = new Map<string, SpecCandidateDraft>();
  const changed = new Map<
    string,
    { index: number; section: (typeof input.diff.sections)[number] }
  >();
  for (const [index, section] of input.diff.sections.entries()) {
    if (section.sectionId !== null) {
      changed.set(section.sectionId, { index, section });
    }
  }
  for (const link of input.links) {
    const identity: SpecCandidateIdentity = {
      recordId: link.record.recordId,
      recordType: link.record.recordType,
      sectionId: linkSectionId(link, input.previous, input.next),
    };
    const key = specCandidateKey(identity);
    const hit =
      identity.sectionId === null ? undefined : changed.get(identity.sectionId);
    const draft = drafts.get(key) ?? {
      changedSection:
        hit && identity.sectionId !== null
          ? {
              change: hit.section.change,
              heading: hit.section.heading,
              sectionId: identity.sectionId,
            }
          : null,
      identity,
      reasons: [],
    };
    if (
      !draft.reasons.some(
        (reason) => reason.kind === link.kind && reason.detail === link.detail,
      )
    ) {
      draft.reasons.push({ detail: link.detail, kind: link.kind });
    }
    drafts.set(key, draft);
  }
  const diffOrder = (draft: SpecCandidateDraft) => {
    if (draft.changedSection) {
      return changed.get(draft.changedSection.sectionId)?.index ?? 0;
    }
    return draft.identity.sectionId === null
      ? Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER - 1;
  };
  const kindOrder = (draft: SpecCandidateDraft) =>
    Math.min(...draft.reasons.map((reason) => reasonOrder(reason.kind)));
  for (const draft of drafts.values()) {
    draft.reasons.sort(
      (left, right) =>
        reasonOrder(left.kind) - reasonOrder(right.kind) ||
        (left.detail ?? "").localeCompare(right.detail ?? ""),
    );
  }
  return [...drafts.values()].sort(
    (left, right) =>
      diffOrder(left) - diffOrder(right) ||
      kindOrder(left) - kindOrder(right) ||
      specCandidateKey(left.identity).localeCompare(
        specCandidateKey(right.identity),
      ),
  );
}

/**
 * The shared broken-reference presentation: a record the founder cannot read
 * carries no title, label or project, and every unreadable case that is not
 * the founder's own Archived/In Trash record reads as `No access`, so the
 * queue is no oracle for another Workspace.
 */
export function candidateRecordView(
  identity: SpecCandidateIdentity,
  resolution: SpecCandidateRecordResolution | undefined,
  establishedAt: string,
): SpecCandidateRecordView {
  const base = {
    recordId: identity.recordId,
    recordType: identity.recordType,
  };
  if (resolution?.status === "available") {
    return {
      ...base,
      broken: null,
      label: resolution.label,
      projectId: resolution.projectId,
      title: resolution.title,
    };
  }
  const reason: BrokenReferenceReason = resolution?.reason ?? "No access";
  const canOpenSourceRecord = reason === "Archived" || reason === "In Trash";
  return {
    ...base,
    broken: {
      canOpenSourceRecord,
      establishedAt: resolution?.at ?? establishedAt,
      reason,
    },
    label: null,
    projectId: canOpenSourceRecord ? (resolution?.projectId ?? null) : null,
    title: null,
  };
}

/** Joins a candidate with its explicit mark; no mark means the implicit default. */
export function composeSpecCandidates(input: {
  drafts: readonly SpecCandidateDraft[];
  establishedAt: string;
  marks: readonly SpecChangeReviewMark[];
  nextRevision: number;
  previousRevision: number;
  resolutions: ReadonlyMap<string, SpecCandidateRecordResolution>;
}): SpecChangeReviewCandidate[] {
  const marks = new Map(
    input.marks.map((mark) => [specCandidateKey(mark.candidate), mark]),
  );
  return input.drafts.map((draft) => {
    const mark = marks.get(specCandidateKey(draft.identity));
    return {
      changedSection: draft.changedSection,
      documentLevel: draft.identity.sectionId === null,
      identity: draft.identity,
      key: specCandidateKey(draft.identity),
      nextRevision: input.nextRevision,
      previousRevision: input.previousRevision,
      reasons: draft.reasons,
      record: candidateRecordView(
        draft.identity,
        input.resolutions.get(specCandidateRecordKey(draft.identity)),
        input.establishedAt,
      ),
      review: mark
        ? {
            note: mark.note,
            revision: mark.revision,
            state: mark.state,
            updatedAt: mark.updatedAt,
          }
        : {
            note: null,
            revision: 0,
            state: SPEC_REVIEW_DEFAULT_STATE,
            updatedAt: null,
          },
    };
  });
}

/**
 * Marks exactly one candidate of one version pair. There is no bulk shape: a
 * request names one candidate and one value, so "mark all affected" cannot be
 * expressed. The note is optional, short, and stays on this version pair.
 */
export const markSpecChangeReviewCandidateInputSchema =
  humanMutationEnvelopeSchema.extend({
    candidate: specCandidateIdentitySchema,
    note: z.string().trim().max(SPEC_CANDIDATE_NOTE_MAX_LENGTH).nullable(),
    reviewId: identifierSchema,
    state: specReviewStateSchema,
  });

export type MarkSpecChangeReviewCandidateInput = z.input<
  typeof markSpecChangeReviewCandidateInputSchema
>;

export const specChangeReviewMarkPayloadSchema =
  markSpecChangeReviewCandidateInputSchema.pick({
    candidate: true,
    note: true,
    reviewId: true,
    state: true,
  });

export type SpecChangeReviewMarkPayload = z.output<
  typeof specChangeReviewMarkPayloadSchema
>;

/** Metadata only: the value never contains a field of the candidate record. */
export interface SpecChangeReviewMarkValue {
  mark: SpecChangeReviewMark | null;
}

export type SpecChangeReviewMarkContract =
  MutationContract<SpecChangeReviewMarkValue>;

export interface SpecChangeReviewMutationContracts {
  mark: (accountId: string) => SpecChangeReviewMarkContract;
}

/** Deterministic mutation target of one candidate in one version pair. */
export async function specChangeReviewMarkId(
  reviewId: string,
  identity: SpecCandidateIdentity,
) {
  const digest = await fingerprintMutationPayload({
    recordId: identity.recordId,
    recordType: identity.recordType,
    sectionId: identity.sectionId,
  });
  return `${reviewId}:${digest}`;
}
