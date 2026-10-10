import { z } from "zod";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const id = z.string().trim().min(1).max(255);
const text = z.string().trim().min(1).max(20_000);
const optionalText = z.string().trim().max(20_000).nullable().default(null);
export const RESEARCH_SESSION_STATUS_OPTIONS = [
  "Planned",
  "Completed",
  "Cancelled",
] as const;
export const RESEARCH_SESSION_CONSENT_OPTIONS = [
  "Not asked",
  "Allowed",
  "Not allowed",
  "Not applicable",
] as const;
export const researchSessionConsentSchema = z.enum(
  RESEARCH_SESSION_CONSENT_OPTIONS,
);
export type ResearchSessionConsent = z.infer<
  typeof researchSessionConsentSchema
>;

export function researchSessionConsentGates(consent: ResearchSessionConsent) {
  const allowed = consent === "Allowed" || consent === "Not applicable";
  return {
    quote: allowed,
    identifyingNote: allowed,
    file: allowed,
    share: allowed,
    publish: allowed,
    convert: allowed,
  };
}

export const researchSessionFieldsSchema = z
  .object({
    title: text.max(255),
    purpose: text,
    questionGuide: optionalText,
    status: z.enum(RESEARCH_SESSION_STATUS_OPTIONS).default("Planned"),
    scheduledAt: z.iso.datetime({ offset: true }).nullable().default(null),
    durationMinutes: z.number().int().min(1).max(1440).nullable().default(null),
    channel: optionalText,
    facilitator: optionalText,
    scopeNote: optionalText,
    participantContactId: id.nullable().default(null),
    consent: researchSessionConsentSchema.default("Not asked"),
    consentNote: optionalText,
  })
  .strict();
export type ResearchSessionFields = z.infer<typeof researchSessionFieldsSchema>;
export const saveResearchSessionInputSchema = humanMutationEnvelopeSchema
  .extend({
    id,
    projectId: id,
    fields: researchSessionFieldsSchema,
  })
  .strict();
export type SaveResearchSessionInput = z.input<
  typeof saveResearchSessionInputSchema
>;
export const researchSessionProjectInputSchema = z
  .object({ projectId: id })
  .strict();

const contentIdentity = { id, relationIds: z.array(id).max(100).default([]) };
export const researchSessionContentInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...contentIdentity,
      kind: z.literal("Participant quote"),
      text,
      speakerLabel: optionalText,
    })
    .strict(),
  z
    .object({
      ...contentIdentity,
      kind: z.literal("Identifying personal note"),
      text,
    })
    .strict(),
  z
    .object({
      ...contentIdentity,
      kind: z.literal("File Attachment"),
      fileId: id,
      fileVersionId: id,
    })
    .strict(),
]);
export type ResearchSessionContentInput = z.infer<
  typeof researchSessionContentInputSchema
>;
const capturedContentSchema = z
  .object({
    consentAtCapture: researchSessionConsentSchema,
    content: researchSessionContentInputSchema,
  })
  .strict();
export type ResearchSessionCapturedContent = z.infer<
  typeof capturedContentSchema
>;

export function assertResearchSessionConsent(consent: ResearchSessionConsent) {
  if (!researchSessionConsentGates(consent).quote) {
    throw new Error("Consent does not allow this Research Session operation.");
  }
}

/** Call only with the persisted Consent, inside the owning write transaction. */
export function captureResearchSessionContent(
  consent: ResearchSessionConsent,
  rawInput: unknown,
): ResearchSessionCapturedContent {
  assertResearchSessionConsent(consent);
  return {
    consentAtCapture: consent,
    content: researchSessionContentInputSchema.parse(rawInput),
  };
}

export const researchSessionRecordSchema = researchSessionFieldsSchema
  .extend({
    id,
    projectId: id,
    sourceType: z.literal("Research Session"),
    revision: z.number().int().positive().safe(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    participantConsentAtLink: researchSessionConsentSchema.default("Not asked"),
    consentRecordedBy: id,
    consentRecordedAt: z.iso.datetime({ offset: true }),
    content: z.array(capturedContentSchema).max(1000).default([]),
  })
  .strict();
export type ResearchSessionRecord = z.infer<typeof researchSessionRecordSchema>;
export const captureResearchSessionInputSchema = humanMutationEnvelopeSchema
  .extend({ id, projectId: id, content: researchSessionContentInputSchema })
  .strict();
export type CaptureResearchSessionInput = z.input<
  typeof captureResearchSessionInputSchema
>;

export const researchSessionSnapshotSelectionSchema = z
  .object({
    contentIds: z.array(id).max(1000).default([]),
    participant: z.boolean().default(false),
    consent: z.boolean().default(false),
  })
  .strict();
type SnapshotSelection = z.infer<typeof researchSessionSnapshotSelectionSchema>;
export type ResearchSessionSnapshotItem =
  | { kind: "Contact"; contactId: string }
  | { kind: "Consent"; value: ResearchSessionConsent; note: string | null }
  | ResearchSessionContentInput;

/** Detached, explicitly selected candidates for a NEW approval, never a live external read. */
export function researchSessionSnapshotPreview(
  rawSession: ResearchSessionRecord,
  rawSelection: SnapshotSelection,
): ResearchSessionSnapshotItem[] {
  const session = researchSessionRecordSchema.parse(rawSession);
  const selection = researchSessionSnapshotSelectionSchema.parse(rawSelection);
  if (!researchSessionConsentGates(session.consent).share) {
    return [];
  }
  const result: ResearchSessionSnapshotItem[] = [];
  for (const item of session.content) {
    if (
      selection.contentIds.includes(item.content.id) &&
      researchSessionConsentGates(item.consentAtCapture).share
    ) {
      const { relationIds: _relationIds, ...content } = item.content;
      result.push({ ...content, relationIds: [] });
    }
  }
  if (
    selection.participant &&
    session.participantContactId &&
    researchSessionConsentGates(session.participantConsentAtLink).share
  ) {
    result.push({ kind: "Contact", contactId: session.participantContactId });
  }
  if (selection.consent) {
    result.push({
      kind: "Consent",
      value: session.consent,
      note: session.consentNote,
    });
  }
  return structuredClone(result);
}

export interface ResearchSessionsAccess {
  capture: (
    accountId: string,
    input: CaptureResearchSessionInput,
  ) => Promise<ResearchSessionRecord>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<{ records: ResearchSessionRecord[]; readOnly: boolean } | null>;
  save: (
    accountId: string,
    input: SaveResearchSessionInput,
  ) => Promise<ResearchSessionRecord>;
}

/** Consent counterpart for the later convert workflow; produces no target record. */
export function researchSessionConvertPreview(
  rawSession: ResearchSessionRecord,
  contentId: string,
) {
  const session = researchSessionRecordSchema.parse(rawSession);
  assertResearchSessionConsent(session.consent);
  const item = session.content.find(
    (candidate) => candidate.content.id === contentId,
  );
  if (!item) {
    throw new Error("Research Session content is unavailable.");
  }
  assertResearchSessionConsent(item.consentAtCapture);
  return structuredClone({
    sessionId: session.id,
    sessionRevision: session.revision,
    content: item.content,
  });
}
