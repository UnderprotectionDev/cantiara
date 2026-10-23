import { z } from "zod";

import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const identifierSchema = z.string().trim().min(1).max(255);
const timestampSchema = z.string().datetime({ offset: true });

export const RELEASE_COMMUNICATION_UI_LABELS = {
  accessObservation: "Access observation",
  changelog: "Changelog",
  closeAssessment: "Close assessment",
  couldNotLearn: "Could not learn",
  lookAgain: "Look again",
  notObserved: "Not observed",
  observed: "Observed",
  outcomeObservation: "Outcome observation",
  partiallyObserved: "Partially observed",
  reassessImpact: "Reassess impact",
  releaseNotes: "Release notes",
  whyWasThisDone: "Why was this done?",
} as const;

export const OBSERVATION_ASSESSMENTS = [
  RELEASE_COMMUNICATION_UI_LABELS.observed,
  RELEASE_COMMUNICATION_UI_LABELS.partiallyObserved,
  RELEASE_COMMUNICATION_UI_LABELS.notObserved,
  RELEASE_COMMUNICATION_UI_LABELS.couldNotLearn,
] as const;

export const observationAssessmentSchema = z.enum(OBSERVATION_ASSESSMENTS);
export type ObservationAssessment = z.infer<typeof observationAssessmentSchema>;

export const OBSERVATION_KINDS = ["access", "outcome"] as const;
export const observationKindSchema = z.enum(OBSERVATION_KINDS);
export type ObservationKind = z.infer<typeof observationKindSchema>;

/** Evidence types an observation may bind (PRD 12: Source, Feedback, validation, File attachment). */
export const OBSERVATION_EVIDENCE_TYPES = [
  "Source",
  "Feedback",
  "Validation Record",
  "File Attachment",
] as const;

export const observationEvidenceRefSchema = z
  .object({
    sourceId: identifierSchema,
    sourceType: z.enum(OBSERVATION_EVIDENCE_TYPES),
  })
  .strict();
export type ObservationEvidenceRef = z.infer<
  typeof observationEvidenceRefSchema
>;

/* -------------------------------------------------------------------------- */
/* Release notes and changelog                                                 */
/* -------------------------------------------------------------------------- */

export const RELEASE_NOTE_BODY_MAX = 20_000;

export const releaseNoteBodySchema = z
  .string()
  .trim()
  .min(1, "Release notes need text.")
  .max(RELEASE_NOTE_BODY_MAX, "Release notes are too long.");

/** One individually selected record; only the listed fields are approved for publication. */
export const whyTrailItemSchema = z
  .object({
    approvedFields: z
      .array(z.string().trim().min(1).max(100))
      .max(20)
      .default([]),
    sourceId: identifierSchema,
    sourceType: z.string().trim().min(1).max(100),
  })
  .strict();
export type WhyTrailItem = z.infer<typeof whyTrailItemSchema>;

export const releaseNoteStatusSchema = z.enum(["Draft", "Published"]);

export const releaseNoteSchema = z
  .object({
    body: releaseNoteBodySchema,
    createdAt: timestampSchema,
    id: identifierSchema,
    projectId: identifierSchema,
    publishedAt: timestampSchema.nullable(),
    releaseId: identifierSchema,
    revision: z.number().int().min(0).safe(),
    scopeWorkIds: z.array(identifierSchema).min(1),
    status: releaseNoteStatusSchema,
    tagIds: z.array(identifierSchema),
    updatedAt: timestampSchema,
    whyTrail: z.array(whyTrailItemSchema),
  })
  .strict();
export type ReleaseNote = z.infer<typeof releaseNoteSchema>;

export const releaseNoteDraftInputSchema = z
  .object({
    body: releaseNoteBodySchema,
    releaseId: identifierSchema,
    scopeWorkIds: z
      .array(identifierSchema)
      .min(1, "Release notes bind to at least one Work in scope.")
      .max(200),
    tagIds: z.array(identifierSchema).max(50).default([]),
    whyTrail: z.array(whyTrailItemSchema).max(50).default([]),
  })
  .strict();
export type ReleaseNoteDraftInput = z.input<typeof releaseNoteDraftInputSchema>;

export const saveReleaseNoteDraftInputSchema = releaseNoteDraftInputSchema
  .extend({
    baseRevision: z.number().int().nonnegative().safe(),
    noteId: identifierSchema.optional(),
  })
  .strict();

export const saveReleaseNoteDraftMutationInputSchema =
  humanMutationEnvelopeSchema
    .extend(releaseNoteDraftInputSchema.shape)
    .extend({ noteId: identifierSchema.optional() })
    .strict();

export const releaseNotesInputSchema = z
  .object({ releaseId: identifierSchema })
  .strict();

export const releaseNotePreviewInputSchema = z
  .object({ noteId: identifierSchema })
  .strict();

export const PUBLISH_SAFETY_CHECKS = [
  "placeholder",
  "sensitive-data",
  "closed-world",
  "indirect-leak",
] as const;

export interface PublishSafetyFinding {
  check: (typeof PUBLISH_SAFETY_CHECKS)[number];
  message: string;
  /** Where the finding sits: `body` or the item it concerns. */
  target: string;
}

export interface PublishPreviewScopeItem {
  currentPublicLabel: string | null;
  internalStatus: string;
  proposedPublicLabel: string | null;
  title: string;
  workId: string;
}

export interface PublishPreviewWhyTrail {
  /** The only fields that would become public; each value is the snapshot. */
  proposedFields: { name: string; value: string }[];
  sourceId: string;
  sourceType: string;
}

export interface PublishPreviewEvent {
  id: string;
  title: string;
}

export interface PublishPreview {
  /** Build in Public events that would join the public stream when approved. */
  buildInPublicEvents: PublishPreviewEvent[];
  changelogLinks: { href: string; label: string }[];
  findings: PublishSafetyFinding[];
  /** Stale when the draft or its sources change before publish. */
  fingerprint: string;
  noteId: string;
  releaseId: string;
  scope: PublishPreviewScopeItem[];
  whyTrail: PublishPreviewWhyTrail[];
  /** The preview writes nothing; cancel is simply leaving it. */
  written: false;
}

export const publishReleaseNoteInputSchema = humanMutationEnvelopeSchema
  .extend({
    approval: z
      .object({
        buildInPublicEventIds: z.array(identifierSchema).max(200),
        changelogLinkHrefs: z.array(z.string().trim().min(1).max(2000)).max(50),
        fingerprint: z.string().trim().min(1).max(200),
        publicLabels: z
          .array(
            z
              .object({
                label: z.string().trim().min(1).max(100),
                workId: identifierSchema,
              })
              .strict(),
          )
          .max(200),
        whyTrail: z
          .array(
            z
              .object({
                approvedFields: z.array(z.string().trim().min(1)).max(20),
                sourceId: identifierSchema,
                sourceType: z.string().trim().min(1).max(100),
              })
              .strict(),
          )
          .max(50),
      })
      .strict(),
    noteId: identifierSchema,
  })
  .strict();
export type PublishReleaseNoteInput = z.infer<
  typeof publishReleaseNoteInputSchema
>;

export interface ChangelogEntry {
  approvedAt: string;
  body: string;
  /** Only the Build in Public events and links approved item by item. */
  buildInPublicEventIds: string[];
  changelogLinks: { href: string; label: string }[];
  noteId: string;
  publicLabels: { label: string; workId: string }[];
  releaseId: string;
  revision: number;
  /** Existing project tags only; the changelog has no tag system of its own. */
  tagIds: string[];
  whyTrail: PublishPreviewWhyTrail[];
}

export const changelogInputSchema = z
  .object({
    projectId: identifierSchema,
    tagIds: z.array(identifierSchema).max(50).default([]),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Reassess impact                                                             */
/* -------------------------------------------------------------------------- */

export const OBSERVATION_TEXT_MAX = 5000;

export interface ObservationRevision {
  assessment: ObservationAssessment;
  authorId: string;
  evidence: ObservationEvidenceRef[];
  observedAt: string;
  revision: number;
  savedAt: string;
  text: string;
}

export interface Observation {
  assessment: ObservationAssessment;
  authorId: string;
  evidence: ObservationEvidenceRef[];
  id: string;
  kind: ObservationKind;
  observedAt: string;
  /** Earlier values stay readable; a correction never rewrites them. */
  previous: ObservationRevision[];
  revision: number;
  roundId: string;
  /** When the current value was saved; `observedAt` is the founder's date. */
  savedAt: string;
  text: string;
}

export const REASSESSMENT_CLOSE_REASONS = ["Close assessment"] as const;

export interface ReassessmentRound {
  access: Observation | null;
  /** Action-needed while open with a field not yet explicitly judged. */
  actionNeeded: boolean;
  closedAt: string | null;
  closeReason: (typeof REASSESSMENT_CLOSE_REASONS)[number] | null;
  id: string;
  outcome: Observation | null;
  releaseId: string;
  /** One-based, per Release; later rounds never replace earlier ones. */
  sequence: number;
  startedAt: string;
}

export const startReassessmentInputSchema = humanMutationEnvelopeSchema
  .extend({
    /** `Look again` date; only schedules the personal reminder. */
    lookAgainAt: timestampSchema.optional(),
    releaseId: identifierSchema,
  })
  .strict();

export const recordObservationInputSchema = humanMutationEnvelopeSchema
  .extend({
    assessment: observationAssessmentSchema,
    evidence: z.array(observationEvidenceRefSchema).max(20).default([]),
    kind: observationKindSchema,
    observedAt: timestampSchema.optional(),
    roundId: identifierSchema,
    text: z.string().trim().max(OBSERVATION_TEXT_MAX).default(""),
  })
  .strict();
export type RecordObservationInput = z.infer<
  typeof recordObservationInputSchema
>;

export const closeAssessmentInputSchema = humanMutationEnvelopeSchema
  .extend({ roundId: identifierSchema })
  .strict();

export const setLookAgainInputSchema = humanMutationEnvelopeSchema
  .extend({ fireAt: timestampSchema, releaseId: identifierSchema })
  .strict();

export const reassessmentInputSchema = z
  .object({ releaseId: identifierSchema })
  .strict();

export interface ReassessmentSideBySideWork {
  expectedOutcome: string | null;
  observedOutcome: string | null;
  sourcePath: string;
  title: string;
  workId: string;
}

export interface ReassessmentView {
  /** Reassessment never gates the Feature or Project Release close. */
  blocksClose: false;
  goal: { id: string; sourcePath: string; title: string } | null;
  hypothesis: string | null;
  releaseId: string;
  /** Oldest first; every round keeps its own observations. */
  rounds: ReassessmentRound[];
  scope: ReassessmentSideBySideWork[];
}

export const RELEASE_COMMUNICATION_ERROR_CODES = [
  "RELEASE_COMMUNICATION_NOT_FOUND",
  "RELEASE_COMMUNICATION_STALE_REVISION",
  "RELEASE_COMMUNICATION_SCOPE_INVALID",
  "RELEASE_COMMUNICATION_NOT_PUBLISHED",
  "RELEASE_COMMUNICATION_PREVIEW_STALE",
  "RELEASE_COMMUNICATION_PREVIEW_BLOCKED",
  "RELEASE_COMMUNICATION_ALREADY_PUBLISHED",
  "RELEASE_COMMUNICATION_ROUND_CLOSED",
  "RELEASE_COMMUNICATION_EVIDENCE_INVALID",
] as const;

export type ReleaseCommunicationErrorCode =
  (typeof RELEASE_COMMUNICATION_ERROR_CODES)[number];

export class ReleaseCommunicationError extends Error {
  readonly code: ReleaseCommunicationErrorCode;

  constructor(code: ReleaseCommunicationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ReleaseCommunicationError";
  }
}

export interface ReleaseCommunicationAccess {
  actionNeeded: (
    accountId: string,
    projectId: string,
  ) => Promise<ReassessmentRound[] | null>;
  changelog: (
    accountId: string,
    input: { projectId: string; tagIds: string[] },
  ) => Promise<ChangelogEntry[] | null>;
  closeAssessment: (
    accountId: string,
    roundId: string,
  ) => Promise<ReassessmentRound | null>;
  listNotes: (
    accountId: string,
    releaseId: string,
  ) => Promise<ReleaseNote[] | null>;
  previewPublish: (
    accountId: string,
    noteId: string,
  ) => Promise<PublishPreview | null>;
  publish: (
    accountId: string,
    input: Omit<
      PublishReleaseNoteInput,
      "baseRevision" | "clientIdempotencyKey"
    >,
  ) => Promise<ChangelogEntry | null>;
  reassessment: (
    accountId: string,
    releaseId: string,
  ) => Promise<ReassessmentView | null>;
  recordObservation: (
    accountId: string,
    input: Omit<RecordObservationInput, "clientIdempotencyKey">,
  ) => Promise<ReassessmentRound | null>;
  saveDraft: (
    accountId: string,
    input: ReleaseNoteDraftInput & { baseRevision: number; noteId?: string },
  ) => Promise<ReleaseNote | null>;
  setLookAgain: (
    accountId: string,
    releaseId: string,
    fireAt: string,
  ) => Promise<boolean>;
  startReassessment: (
    accountId: string,
    input: { lookAgainAt?: string; releaseId: string },
  ) => Promise<ReassessmentRound | null>;
}
