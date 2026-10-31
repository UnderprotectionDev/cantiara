import { z } from "zod";

import type { ConfirmGitHubIdentityOperationId } from "./context";
import type {
  SecurityRedactionAccess,
  SecurityRedactionLocator,
  SecurityRedactionLocatorKind,
  SecurityRedactionTargetOutcome,
} from "./security-redaction";

/**
 * Personal Data Rights (spec 81): one readable person package for one
 * Contact, and `Erase Personal Data` for the same Contact. The package is
 * neither a Selected Export (79) nor a Workspace Exit Package (82) and is not
 * a restore format. Erase is neither Trash nor Account closure (84): it
 * consumes the Account Access grant, checks the typed Account name and calls
 * the Security Redaction (78) apply interface; it has no spread engine of its
 * own.
 */

export const EXPORT_PERSONAL_DATA_LABEL = "Export Personal Data";
export const ERASE_PERSONAL_DATA_LABEL = "Erase Personal Data";
export const PERSONAL_DATA_ERASE_OPERATION_ID =
  "personal-data-erase" satisfies ConfirmGitHubIdentityOperationId;
/** The content-free `Reason` every erase writes into the 78 event. */
export const PERSONAL_DATA_ERASE_REASON = "Erase Personal Data";
/** The product warns instead of inviting these (spec 81 story 12). */
export const PERSONAL_DATA_SPECIAL_CATEGORY_WARNING =
  "Health, biometric, government ID, payment card and children's data are not stored as a first-product type. Do not enter them.";
/** The PRD 02 row shown after an erase removed shared or published copies. */
export const PERSONAL_DATA_COPIES_REMOVED_LABEL =
  "Shared and published copies were removed. Cache cleanup is queued.";
/** The longest value Security Redaction accepts as one sensitive value. */
export const PERSONAL_DATA_VALUE_MAX_LENGTH = 4096;

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
  grant_rejected:
    "Confirm GitHub Identity is required to erase. Confirm it again and retry.",
  name_mismatch: "The typed Account name does not match.",
  spread_incomplete:
    "Erase Personal Data did not reach every copy. Retry after confirming GitHub identity again.",
  preview_required:
    "Review the preview of this person package before exporting it.",
} as const;
export type PersonalDataErrorCode = keyof typeof PERSONAL_DATA_ERROR_MESSAGES;

export class PersonalDataError extends Error {
  readonly code: PersonalDataErrorCode;

  constructor(code: PersonalDataErrorCode, options?: { cause?: unknown }) {
    super(PERSONAL_DATA_ERROR_MESSAGES[code], options);
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

const eraseFields = {
  contactId: identifierSchema,
  previewFingerprint: z.string().min(1).max(128),
};

export const personalDataErasePreviewInputSchema = z
  .object({ contactId: identifierSchema })
  .strict();
export type PersonalDataErasePreviewInput = z.input<
  typeof personalDataErasePreviewInputSchema
>;

export const erasePersonalDataInputSchema = z
  .object({
    ...eraseFields,
    /** The Account Access `Confirm GitHub Identity` grant for this erase. */
    grant: z.string().min(1).max(512),
    typedName: z.string().min(1).max(200),
  })
  .strict();
export type ErasePersonalDataInput = z.input<
  typeof erasePersonalDataInputSchema
>;

/** Impact of one erase: nothing is written until the founder confirms it. */
export interface PersonalDataErasePreview {
  contactId: string;
  contactLabel: string;
  /** Copies held outside the Contact's own records, by location only. */
  copies: SecurityRedactionLocator[];
  fingerprint: string;
  /** Always states: irreversible, not Trash, not Account closure. */
  notices: string[];
  /** Spread targets with no source yet: not searched, not claimed clean. */
  notSearched: SecurityRedactionLocatorKind[];
  /** The Contact, Feedback, Research and evidence the erase tombstones. */
  sources: PersonalDataPreviewSource[];
  /** The Account name the founder must type. */
  typedNameTarget: { kind: "Account"; name: string };
}

/** What the tombstone step changed. Counts only, never a value. */
export interface PersonalDataTombstoneCounts {
  contacts: number;
  emailAliases: number;
  evidence: number;
  feedback: number;
  research: number;
}

export interface PersonalDataEraseResult {
  contactId: string;
  /** Per spread target outcome of Security Redaction, counts only. */
  removal: SecurityRedactionTargetOutcome[];
  status: "erased";
  tombstone: PersonalDataTombstoneCounts;
}

/** The signed-in Account: its id and the name its erase types. */
export interface PersonalDataActor {
  accountId: string;
  accountName: string;
}

/**
 * The content-free tombstone writer for the Contact's own records. It runs
 * after Security Redaction removed every other copy; it removes the name,
 * email aliases and original message in place and keeps ids and timestamps.
 */
export interface PersonalDataEraser {
  tombstone: (
    accountId: string,
    contactId: string,
    values: readonly string[],
  ) => Promise<PersonalDataTombstoneCounts>;
}

/** The Security Redaction (78) interface this feature calls. */
export type PersonalDataRedaction = Pick<
  SecurityRedactionAccess,
  "apply" | "preview"
>;

/** Denetim kaydı entry: type, time, aliased actor and the Contact id only. */
export interface PersonalDataAuditEntry {
  accountId: string;
  at: string;
  contactId: string;
  type: "personal-data.exported" | "personal-data.erased";
}

export interface PersonalDataAudit {
  record: (entry: PersonalDataAuditEntry) => Promise<void>;
}

/** Consumes the Account Access grant for `personal-data-erase`; `false` fails closed. */
export type PersonalDataGrantConsumer = (grant: string) => Promise<boolean>;

export interface PersonalDataRightsAccess {
  /**
   * Fixed order so a refusal never writes: preview fingerprint, typed Account
   * name, the grant consumed exactly once, Security Redaction apply for each
   * personal value, then the content-free tombstone and the audit entry.
   */
  erase: (
    actor: PersonalDataActor,
    input: ErasePersonalDataInput,
    consumeGrant: PersonalDataGrantConsumer,
  ) => Promise<PersonalDataEraseResult>;
  preview: (
    accountId: string,
    input: PersonalDataPreviewInput,
  ) => Promise<PersonalDataPreview>;
  /** Read-only: lists impact, writes nothing. */
  previewErase: (
    actor: PersonalDataActor,
    input: PersonalDataErasePreviewInput,
  ) => Promise<PersonalDataErasePreview>;
  produce: (
    accountId: string,
    input: PersonalDataProduceInput,
  ) => Promise<PersonalDataArtifact>;
}
