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
    reasons: z.array(
      z.enum(["Same email", "Similar name", "Same Company and name"]),
    ),
    strength: z.enum(["strong", "weak"]),
  })
  .strict();

export type DuplicateCandidate = z.infer<typeof duplicateCandidateSchema>;

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
  linkPersona: (
    workspaceId: string,
    input: z.output<typeof contactPersonaInputSchema>,
  ) => Promise<Contact>;
  listCompanies: (workspaceId: string) => Promise<Company[]>;
  listContacts: (workspaceId: string) => Promise<Contact[]>;
  setCompany: (
    workspaceId: string,
    input: ParsedSetContactCompanyInput,
  ) => Promise<Contact>;
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
  linkPersona: (
    accountId: string,
    input: ContactPersonaInput,
  ) => Promise<Contact>;
  listCompanies: (accountId: string) => Promise<Company[]>;
  listContacts: (accountId: string) => Promise<Contact[]>;
  listDuplicateCandidates: (accountId: string) => Promise<DuplicateCandidate[]>;
  setCompany: (
    accountId: string,
    input: SetContactCompanyInput,
  ) => Promise<Contact>;
  unlinkPersona: (
    accountId: string,
    input: ContactPersonaInput,
  ) => Promise<Contact>;
  updateContact: (
    accountId: string,
    input: UpdateContactInput,
  ) => Promise<Contact>;
}
