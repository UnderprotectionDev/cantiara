import { z } from "zod";

export const CONTACT_AND_COMPANY_COPY = {
	belongsToCompany: "Belongs to Company",
	company: "Company",
	contact: "Contact",
	createCompany: "Create Company",
	createContact: "Create Contact",
	displayName: "Display name",
	duplicateCandidates: "Duplicate candidates",
	email: "Email",
	name: "Name",
	noCompanies: "No Companies yet.",
	noContacts: "No Contacts yet.",
	noDuplicateCandidates: "No duplicate candidates.",
	openSourceRecord: "Open Source Record",
	strongCopyCandidate: "Strong copy candidate",
	weakSuggestion: "Weak suggestion",
} as const;

export const DUPLICATE_CANDIDATE_REASONS = [
	"same-normalized-email",
	"similar-name",
	"similar-company",
] as const;

export type DuplicateCandidateReason =
	(typeof DUPLICATE_CANDIDATE_REASONS)[number];

export type DuplicateCandidateStrength = "strong" | "weak";

export const CONTACT_KIND = "Contact" as const;
export const COMPANY_KIND = "Company" as const;
export const DOCUMENT_KIND = "Document" as const;
export const FEEDBACK_KIND = "Feedback" as const;
export const PERSONA_DOCUMENT_TYPE = "Persona" as const;

export const sourceLinkSchema = z.object({
	id: z.string().min(1),
	kind: z.string().min(1),
	openSourceRecord: z.literal(CONTACT_AND_COMPANY_COPY.openSourceRecord),
	title: z.string(),
});

export type SourceLink = z.infer<typeof sourceLinkSchema>;

export const emailAliasViewSchema = z.object({
	normalizedEmail: z.string().min(1),
	originalEmail: z.string().min(1),
});

export type EmailAliasView = z.infer<typeof emailAliasViewSchema>;

export const companyAffiliationHistorySchema = z.object({
	companyId: z.string().min(1),
	endedAt: z.string().nullable(),
	name: z.string(),
	startedAt: z.string().min(1),
});

export type CompanyAffiliationHistory = z.infer<
	typeof companyAffiliationHistorySchema
>;

export const companySummarySchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
});

export type CompanySummary = z.infer<typeof companySummarySchema>;

export const contactViewSchema = z.object({
	companyHistory: z.array(companyAffiliationHistorySchema),
	copy: z.object({
		belongsToCompany: z.literal(CONTACT_AND_COMPANY_COPY.belongsToCompany),
		company: z.literal(CONTACT_AND_COMPANY_COPY.company),
		contact: z.literal(CONTACT_AND_COMPANY_COPY.contact),
		openSourceRecord: z.literal(CONTACT_AND_COMPANY_COPY.openSourceRecord),
	}),
	currentCompany: companySummarySchema.nullable(),
	displayName: z.string().nullable(),
	emailAliases: z.array(emailAliasViewSchema),
	id: z.string().min(1),
	relatedFeedback: z.array(sourceLinkSchema),
	relatedPersonaDocuments: z.array(sourceLinkSchema),
	revision: z.number().int().positive(),
	workspaceId: z.string().min(1),
});

export type ContactView = z.infer<typeof contactViewSchema>;

export const companyViewSchema = z.object({
	copy: z.object({
		belongsToCompany: z.literal(CONTACT_AND_COMPANY_COPY.belongsToCompany),
		company: z.literal(CONTACT_AND_COMPANY_COPY.company),
		openSourceRecord: z.literal(CONTACT_AND_COMPANY_COPY.openSourceRecord),
	}),
	id: z.string().min(1),
	name: z.string().min(1),
	revision: z.number().int().positive(),
	workspaceId: z.string().min(1),
});

export type CompanyView = z.infer<typeof companyViewSchema>;

export const createContactPayloadSchema = z.object({
	companyId: z.string().min(1).optional(),
	displayName: z.string().optional(),
	email: z.string().optional(),
});

export type CreateContactPayload = z.infer<typeof createContactPayloadSchema>;

export const createContactCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createContactPayloadSchema,
	workspaceId: z.string().min(1),
});

export type CreateContactCommand = z.infer<typeof createContactCommandSchema>;

export const createCompanyPayloadSchema = z.object({
	name: z.string(),
});

export const createCompanyCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createCompanyPayloadSchema,
	workspaceId: z.string().min(1),
});

export type CreateCompanyCommand = z.infer<typeof createCompanyCommandSchema>;

export const setContactCompanyPayloadSchema = z.object({
	companyId: z.string().min(1).nullable(),
	contactId: z.string().min(1),
});

export const setContactCompanyCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setContactCompanyPayloadSchema,
	workspaceId: z.string().min(1),
});

export type SetContactCompanyCommand = z.infer<
	typeof setContactCompanyCommandSchema
>;

export const relateContactPersonaPayloadSchema = z.object({
	contactId: z.string().min(1),
	documentId: z.string().min(1),
});

export const relateContactPersonaCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: relateContactPersonaPayloadSchema,
	workspaceId: z.string().min(1),
});

export type RelateContactPersonaCommand = z.infer<
	typeof relateContactPersonaCommandSchema
>;

export const duplicateCandidateContactSchema = z.object({
	displayName: z.string().nullable(),
	id: z.string().min(1),
});

export const duplicateCandidateSchema = z.object({
	copy: z.object({
		strongCopyCandidate: z.literal(
			CONTACT_AND_COMPANY_COPY.strongCopyCandidate
		),
		weakSuggestion: z.literal(CONTACT_AND_COMPANY_COPY.weakSuggestion),
	}),
	left: duplicateCandidateContactSchema,
	reasons: z.array(z.enum(DUPLICATE_CANDIDATE_REASONS)).min(1),
	right: duplicateCandidateContactSchema,
	strength: z.enum(["strong", "weak"]),
});

export type DuplicateCandidate = z.infer<typeof duplicateCandidateSchema>;

export type ContactWriteOutcome =
	| { contact: ContactView; status: "committed" }
	| { contact: ContactView; status: "replayed" }
	| { conflict: "Conflict"; status: "conflict" }
	| { currentValueLabel: "Current value"; status: "stale" }
	| {
			reason:
				| "invalid-command"
				| "target-not-found"
				| "company-not-found"
				| "document-not-found"
				| "persona-document-required";
			status: "rejected";
	  };

export type CompanyWriteOutcome =
	| { company: CompanyView; status: "committed" }
	| { company: CompanyView; status: "replayed" }
	| { conflict: "Conflict"; status: "conflict" }
	| {
			reason: "invalid-command" | "target-not-found" | "missing-name";
			status: "rejected";
	  };

export function normalizeEmailAlias(value: string): string | null {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return null;
	}
	return trimmed.toLowerCase();
}

export function optionalDisplayName(value: string | undefined): string {
	return value?.trim() ?? "";
}

export function normalizeDisplayName(value: string | null): string | null {
	const collapsed = value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
	return collapsed.length > 0 ? collapsed : null;
}
