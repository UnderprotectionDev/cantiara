import { z } from "zod";

/**
 * Personal Data Rights (spec 81): one readable person package for one
 * Contact. It is neither a Selected Export (79) nor a Workspace Exit Package
 * (82), and it is not a restore format. `Erase Personal Data` is a later
 * ticket and is not part of this contract yet.
 */

export const EXPORT_PERSONAL_DATA_LABEL = "Export Personal Data";

export const PERSONAL_DATA_FORMATS = ["JSON", "Markdown"] as const;
export type PersonalDataFormat = (typeof PERSONAL_DATA_FORMATS)[number];

/** The closed list of sources a person package may read, in package order. */
export const PERSONAL_DATA_SOURCES = [
  "Contact",
  "Email aliases",
  "Feedback",
  "Research",
  "Related evidence",
] as const;
export type PersonalDataSource = (typeof PERSONAL_DATA_SOURCES)[number];

/** What a person package never carries; shown in the preview before confirm. */
export const PERSONAL_DATA_EXCLUSIONS = [
  "Secrets, tokens, passwords and sessions",
  "Other Contacts",
  "Operator logs and Workspace history",
  "Any other Workspace records",
] as const;

export const PERSONAL_DATA_PACKAGE_NOTICE =
  "This is a readable copy of one person's data. It is not a Workspace archive and cannot be used to restore records.";

const identifierSchema = z.string().trim().min(1).max(255);

export const personalDataPreviewInputSchema = z
  .object({ contactId: identifierSchema })
  .strict();
export type PersonalDataPreviewInput = z.input<
  typeof personalDataPreviewInputSchema
>;

export const personalDataProduceInputSchema = z
  .object({
    contactId: identifierSchema,
    format: z.enum(PERSONAL_DATA_FORMATS),
    previewFingerprint: z.string().min(1).max(128),
  })
  .strict();
export type PersonalDataProduceInput = z.input<
  typeof personalDataProduceInputSchema
>;

export interface PersonalDataPreviewSource {
  items: Array<{ id: string; label: string }>;
  kind: PersonalDataSource;
}

export interface PersonalDataPreview {
  contactId: string;
  contactLabel: string;
  excluded: readonly string[];
  fingerprint: string;
  notice: string;
  sources: PersonalDataPreviewSource[];
}

export interface PersonalDataArtifact {
  bytes: string;
  fileName: string;
  format: PersonalDataFormat;
  mediaType: string;
  /** Names of removed Secret class keys or credential classes, never values. */
  secretsExcluded: string[];
}

export const PERSONAL_DATA_ERROR_MESSAGES = {
  contact_not_found: "This Contact was not found.",
  preview_required:
    "Review the preview of this person package before exporting it.",
} as const;
export type PersonalDataErrorCode = keyof typeof PERSONAL_DATA_ERROR_MESSAGES;

export class PersonalDataError extends Error {
  readonly code: PersonalDataErrorCode;

  constructor(code: PersonalDataErrorCode) {
    super(PERSONAL_DATA_ERROR_MESSAGES[code]);
    this.name = "PersonalDataError";
    this.code = code;
  }
}

/** Everything the reader finds for one Contact of the account's Workspace. */
export interface PersonalDataSnapshot {
  contact: {
    archivedAt: string | null;
    createdAt: string;
    displayName: string | null;
    emails: string[];
    id: string;
    updatedAt: string;
  };
  evidence: Array<{
    createdAt: string;
    id: string;
    interpretation: string | null;
    role: string;
    sourceRecordId: string;
    targetRecordId: string;
    targetRecordType: string;
  }>;
  feedback: Array<{
    channel: string | null;
    id: string;
    occurredAt: string;
    originalMessage: string;
    status: string;
    title: string;
    url: string | null;
  }>;
  research: Array<{
    data: unknown;
    id: string;
    title: string;
  }>;
}

export interface PersonalDataReader {
  /** `null` when the Contact is not in the account's own Workspace. */
  read: (
    accountId: string,
    contactId: string,
  ) => Promise<PersonalDataSnapshot | null>;
}

export interface PersonalDataRightsAccess {
  preview: (
    accountId: string,
    input: PersonalDataPreviewInput,
  ) => Promise<PersonalDataPreview>;
  produce: (
    accountId: string,
    input: PersonalDataProduceInput,
  ) => Promise<PersonalDataArtifact>;
}
