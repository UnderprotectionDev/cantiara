import { z } from "zod";

const identifierSchema = z.string().trim().min(1).max(255);
const revisionSchema = z.number().int().nonnegative().safe();
const timestampSchema = z.string().datetime({ offset: true });

export const contactDisplayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required when provided.")
  .max(255, "Display name must be 255 characters or fewer.");

export const companyNameSchema = z
  .string()
  .trim()
  .min(1, "Company name is required.")
  .max(255, "Company name must be 255 characters or fewer.");

export function normalizeContactEmail(email: string) {
  return email.trim().toLocaleLowerCase("en-US");
}

export const contactEmailSchema = z
  .string()
  .trim()
  .max(320, "Email must be 320 characters or fewer.")
  .email("Enter a valid email address.")
  .transform(normalizeContactEmail);

/**
 * Every field here is identity. Plan, subscription, ARR/MRR, revenue,
 * contract, sales stage, geo segment and commercial score are deliberately
 * not part of the contract, and `.strict()` rejects them on input.
 */
export const createContactInputSchema = z
  .object({
    companyId: identifierSchema.optional(),
    displayName: contactDisplayNameSchema.optional(),
    email: contactEmailSchema.optional(),
  })
  .strict();

export type CreateContactInput = z.input<typeof createContactInputSchema>;
export type ParsedCreateContactInput = z.output<
  typeof createContactInputSchema
>;

export const createCompanyInputSchema = z
  .object({ name: companyNameSchema })
  .strict();

export type CreateCompanyInput = z.input<typeof createCompanyInputSchema>;
export type ParsedCreateCompanyInput = z.output<
  typeof createCompanyInputSchema
>;

/** `companyId: null` clears the current `Belongs to Company` link. */
export const setContactCompanyInputSchema = z
  .object({
    companyId: identifierSchema.nullable(),
    contactId: identifierSchema,
    expectedRevision: revisionSchema.optional(),
  })
  .strict();

export type SetContactCompanyInput = z.input<
  typeof setContactCompanyInputSchema
>;
export type ParsedSetContactCompanyInput = z.output<
  typeof setContactCompanyInputSchema
>;

/**
 * `displayName: null` clears the name. `email` adds a normalized alias; it
 * never replaces an existing one, so identity stays the Contact id.
 */
export const updateContactInputSchema = z
  .object({
    contactId: identifierSchema,
    displayName: contactDisplayNameSchema.nullable().optional(),
    email: contactEmailSchema.optional(),
    expectedRevision: revisionSchema.optional(),
  })
  .strict();

export type UpdateContactInput = z.input<typeof updateContactInputSchema>;
export type ParsedUpdateContactInput = z.output<
  typeof updateContactInputSchema
>;

export const contactPersonaInputSchema = z
  .object({
    contactId: identifierSchema,
    documentId: identifierSchema,
  })
  .strict();

export type ContactPersonaInput = z.input<typeof contactPersonaInputSchema>;

export const contactIdentityInputSchema = z
  .object({ contactId: identifierSchema })
  .strict();

export type ContactIdentityInput = z.input<typeof contactIdentityInputSchema>;

export const companySchema = z
  .object({
    archivedAt: timestampSchema.nullable(),
    contactCount: z.number().int().nonnegative().safe(),
    createdAt: timestampSchema,
    id: identifierSchema,
    name: companyNameSchema,
    revision: revisionSchema,
  })
  .strict();

export type Company = z.infer<typeof companySchema>;

const companyReferenceSchema = z
  .object({
    archivedAt: timestampSchema.nullable(),
    id: identifierSchema,
    name: companyNameSchema,
  })
  .strict();

export const contactCompanyHistoryEntrySchema = z
  .object({
    company: companyReferenceSchema,
    endedAt: timestampSchema.nullable(),
    startedAt: timestampSchema,
  })
  .strict();

export type ContactCompanyHistoryEntry = z.infer<
  typeof contactCompanyHistoryEntrySchema
>;

/** A Persona is a Document; the profile only points at it. */
export const contactPersonaDocumentSchema = z
  .object({
    archivedAt: timestampSchema.nullable(),
    documentId: identifierSchema,
    projectId: identifierSchema,
    title: z.string().trim().min(1).max(255),
  })
  .strict();

export type ContactPersonaDocument = z.infer<
  typeof contactPersonaDocumentSchema
>;

export const contactSchema = z
  .object({
    archivedAt: timestampSchema.nullable(),
    company: companyReferenceSchema.nullable(),
    companyHistory: z.array(contactCompanyHistoryEntrySchema),
    createdAt: timestampSchema,
    displayName: contactDisplayNameSchema.nullable(),
    emails: z.array(z.string().min(3).max(320)),
    id: identifierSchema,
    personaDocuments: z.array(contactPersonaDocumentSchema),
    revision: revisionSchema,
  })
  .strict();

export type Contact = z.infer<typeof contactSchema>;

/**
 * `strong`: the Contacts share a normalized email alias. `weak`: only a
 * similar name or shared Company. Neither strength merges anything; a
 * candidate is a read-only suggestion.
 */
export const duplicateCandidateSchema = z
  .object({
    contactIds: z.array(identifierSchema).min(2),
    reasons: z.array(z.enum(["Same email", "Similar name", "Same Company"])),
    strength: z.enum(["strong", "weak"]),
  })
  .strict();

export type DuplicateCandidate = z.infer<typeof duplicateCandidateSchema>;

/**
 * `survivorId` is the Contact the founder keeps; `retiredId` is the copy that
 * ends as a contentless redirect. Nothing is written until `mergeContacts`.
 */
export const mergeContactsInputSchema = z
  .object({
    expectedRetiredRevision: revisionSchema.optional(),
    expectedSurvivorRevision: revisionSchema.optional(),
    retiredId: identifierSchema,
    survivorId: identifierSchema,
  })
  .strict()
  .refine((input) => input.retiredId !== input.survivorId, {
    message: "Choose two different Contacts to merge.",
    path: ["retiredId"],
  });

export type MergeContactsInput = z.input<typeof mergeContactsInputSchema>;
export type ParsedMergeContactsInput = z.output<
  typeof mergeContactsInputSchema
>;

export const mergePreviewInputSchema = z
  .object({ retiredId: identifierSchema, survivorId: identifierSchema })
  .strict()
  .refine((input) => input.retiredId !== input.survivorId, {
    message: "Choose two different Contacts to merge.",
    path: ["retiredId"],
  });

export type MergePreviewInput = z.input<typeof mergePreviewInputSchema>;
export type ParsedMergePreviewInput = z.output<typeof mergePreviewInputSchema>;

/** A field both Contacts fill differently; the survivor's value is kept. */
export const mergeFieldConflictSchema = z
  .object({
    field: z.enum(["Display name", "Company"]),
    retiredValue: z.string(),
    survivorValue: z.string(),
  })
  .strict();

export type MergeFieldConflict = z.infer<typeof mergeFieldConflictSchema>;

/**
 * Everything `mergeContacts` will rewrite onto the survivor. Kanıt Rolü,
 * user comments, evidence quality and priority criteria are deliberately not
 * part of it.
 */
export const mergePreviewSchema = z
  .object({
    addedEmails: z.array(z.string()),
    adoptedDisplayName: z.string().nullable(),
    companyOutcome: z.enum(["Keep survivor", "Adopt retired", "None"]),
    feedbackIds: z.array(identifierSchema),
    fieldConflicts: z.array(mergeFieldConflictSchema),
    personaDocuments: z.array(contactPersonaDocumentSchema),
    retired: contactSchema,
    survivor: contactSchema,
  })
  .strict();

export type MergePreview = z.infer<typeof mergePreviewSchema>;

export const mergeResultSchema = z
  .object({
    mergeId: identifierSchema,
    retiredId: identifierSchema,
    survivor: contactSchema,
  })
  .strict();

export type MergeResult = z.infer<typeof mergeResultSchema>;

/**
 * A Contact opened by id. A retired id resolves to its survivor with the
 * origin visible in `redirectedFrom`; the retired id is never a Contact.
 */
export const contactResolutionSchema = z
  .object({
    contact: contactSchema,
    feedbackIds: z.array(identifierSchema),
    redirectedFrom: identifierSchema.nullable(),
  })
  .strict();

export type ContactResolution = z.infer<typeof contactResolutionSchema>;

export const mergeUndoPreviewInputSchema = z
  .object({ retiredId: identifierSchema })
  .strict();

export type MergeUndoPreviewInput = z.input<typeof mergeUndoPreviewInputSchema>;

/** The founder's answer for a field changed since the merge. */
export const mergeUndoResolutionSchema = z.enum([
  "Keep current value",
  "Restore previous value",
]);

export type MergeUndoResolution = z.infer<typeof mergeUndoResolutionSchema>;

export const undoMergeInputSchema = z
  .object({
    expectedSurvivorRevision: revisionSchema,
    resolutions: z
      .object({ displayName: mergeUndoResolutionSchema.optional() })
      .strict()
      .optional(),
    retiredId: identifierSchema,
  })
  .strict();

export type UndoMergeInput = z.input<typeof undoMergeInputSchema>;
export type ParsedUndoMergeInput = z.output<typeof undoMergeInputSchema>;

/** A merge-attributed value on the survivor that was edited after the merge. */
export const mergeUndoConflictSchema = z
  .object({
    currentValue: z.string().nullable(),
    field: z.enum(["Display name"]),
    previousValue: z.string().nullable(),
  })
  .strict();

export type MergeUndoConflict = z.infer<typeof mergeUndoConflictSchema>;

/** Content that no longer exists, so undo cannot bring it back. */
export const mergeUndoMissingSchema = z
  .object({
    count: z.number().int().positive().safe(),
    kind: z.enum(["Feedback link", "Persona link", "Company link"]),
  })
  .strict();

export type MergeUndoMissing = z.infer<typeof mergeUndoMissingSchema>;

/**
 * What `undoMerge` will give back to the retired Contact. Values and links
 * the merge did not attribute, and every later unrelated edit, stay on the
 * survivor. `unrestorable` is the part that cannot come back.
 */
export const mergeUndoPreviewSchema = z
  .object({
    conflicts: z.array(mergeUndoConflictSchema),
    mergeId: identifierSchema,
    restoredCompany: z.string().nullable(),
    restoredDisplayName: z.string().nullable(),
    restoredEmails: z.array(z.string()),
    restoredFeedbackIds: z.array(identifierSchema),
    restoredPersonaDocuments: z.array(contactPersonaDocumentSchema),
    retiredId: identifierSchema,
    survivor: contactSchema,
    unrestorable: z.array(mergeUndoMissingSchema),
  })
  .strict();

export type MergeUndoPreview = z.infer<typeof mergeUndoPreviewSchema>;

export const undoMergeResultSchema = z
  .object({
    mergeId: identifierSchema,
    restored: contactSchema,
    survivor: contactSchema,
    unrestorable: z.array(mergeUndoMissingSchema),
  })
  .strict();

export type UndoMergeResult = z.infer<typeof undoMergeResultSchema>;

export const linkContactFeedbackInputSchema = z
  .object({ contactId: identifierSchema, feedbackId: identifierSchema })
  .strict();

export type LinkContactFeedbackInput = z.input<
  typeof linkContactFeedbackInputSchema
>;

export interface ContactMergeInputs {
  retired: Contact;
  retiredFeedbackIds: string[];
  survivor: Contact;
  survivorFeedbackIds: string[];
}

export interface ContactStore {
  createCompany: (
    workspaceId: string,
    input: ParsedCreateCompanyInput,
  ) => Promise<Company>;
  createContact: (
    workspaceId: string,
    input: ParsedCreateContactInput,
  ) => Promise<Contact>;
  findWorkspaceId: (accountId: string) => Promise<string | null>;
  getContact: (workspaceId: string, contactId: string) => Promise<Contact>;
  linkFeedback: (
    workspaceId: string,
    input: z.output<typeof linkContactFeedbackInputSchema>,
  ) => Promise<string[]>;
  linkPersona: (
    workspaceId: string,
    input: z.output<typeof contactPersonaInputSchema>,
  ) => Promise<Contact>;
  listCompanies: (workspaceId: string) => Promise<Company[]>;
  listContacts: (workspaceId: string) => Promise<Contact[]>;
  mergeContacts: (
    workspaceId: string,
    input: ParsedMergeContactsInput,
    actorAccountId: string,
  ) => Promise<MergeResult>;
  previewMergeUndo: (
    workspaceId: string,
    input: z.output<typeof mergeUndoPreviewInputSchema>,
  ) => Promise<MergeUndoPreview>;
  readMergeInputs: (
    workspaceId: string,
    input: ParsedMergePreviewInput,
  ) => Promise<ContactMergeInputs>;
  resolveContact: (
    workspaceId: string,
    contactId: string,
  ) => Promise<ContactResolution>;
  setCompany: (
    workspaceId: string,
    input: ParsedSetContactCompanyInput,
  ) => Promise<Contact>;
  undoMerge: (
    workspaceId: string,
    input: ParsedUndoMergeInput,
    actorAccountId: string,
  ) => Promise<UndoMergeResult>;
  unlinkPersona: (
    workspaceId: string,
    input: z.output<typeof contactPersonaInputSchema>,
  ) => Promise<Contact>;
  updateContact: (
    workspaceId: string,
    input: ParsedUpdateContactInput,
  ) => Promise<Contact>;
}

export interface ContactsAccess {
  createCompany: (
    accountId: string,
    input: CreateCompanyInput,
  ) => Promise<Company>;
  createContact: (
    accountId: string,
    input: CreateContactInput,
  ) => Promise<Contact>;
  getContact: (
    accountId: string,
    input: ContactIdentityInput,
  ) => Promise<Contact>;
  linkFeedback: (
    accountId: string,
    input: LinkContactFeedbackInput,
  ) => Promise<string[]>;
  linkPersona: (
    accountId: string,
    input: ContactPersonaInput,
  ) => Promise<Contact>;
  listCompanies: (accountId: string) => Promise<Company[]>;
  listContacts: (accountId: string) => Promise<Contact[]>;
  listDuplicateCandidates: (accountId: string) => Promise<DuplicateCandidate[]>;
  mergeContacts: (
    accountId: string,
    input: MergeContactsInput,
  ) => Promise<MergeResult>;
  previewMerge: (
    accountId: string,
    input: MergePreviewInput,
  ) => Promise<MergePreview>;
  previewMergeUndo: (
    accountId: string,
    input: MergeUndoPreviewInput,
  ) => Promise<MergeUndoPreview>;
  resolveContact: (
    accountId: string,
    input: ContactIdentityInput,
  ) => Promise<ContactResolution>;
  setCompany: (
    accountId: string,
    input: SetContactCompanyInput,
  ) => Promise<Contact>;
  undoMerge: (
    accountId: string,
    input: UndoMergeInput,
  ) => Promise<UndoMergeResult>;
  unlinkPersona: (
    accountId: string,
    input: ContactPersonaInput,
  ) => Promise<Contact>;
  updateContact: (
    accountId: string,
    input: UpdateContactInput,
  ) => Promise<Contact>;
}
