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
	emailAliases: "Email aliases",
	feedbackHistory: "Feedback history",
	fieldConflicts: "Field conflicts",
	mergeContacts: "Merge Contacts",
	mergePreview: "Merge Preview",
	name: "Name",
	noCompanies: "No Companies yet.",
	noContacts: "No Contacts yet.",
	noDuplicateCandidates: "No duplicate candidates.",
	openSourceRecord: "Open Source Record",
	origin: "Origin",
	personaRelations: "Persona",
	relationsToRewrite: "Relations",
	strongCopyCandidate: "Strong copy candidate",
	survivingRecord: "Surviving record",
	weakSuggestion: "Weak suggestion",
} as const;

export const CONTACT_MERGE_EVENT_TYPE = "contact.merge" as const;

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

export const contactOriginSchema = z.object({
	displayName: z.string().nullable(),
	id: z.string().min(1),
});

export type ContactOrigin = z.infer<typeof contactOriginSchema>;

export const contactViewSchema = z.object({
	companyHistory: z.array(companyAffiliationHistorySchema),
	copy: z.object({
		belongsToCompany: z.literal(CONTACT_AND_COMPANY_COPY.belongsToCompany),
		company: z.literal(CONTACT_AND_COMPANY_COPY.company),
		contact: z.literal(CONTACT_AND_COMPANY_COPY.contact),
		mergeContacts: z.literal(CONTACT_AND_COMPANY_COPY.mergeContacts),
		mergePreview: z.literal(CONTACT_AND_COMPANY_COPY.mergePreview),
		openSourceRecord: z.literal(CONTACT_AND_COMPANY_COPY.openSourceRecord),
		origin: z.literal(CONTACT_AND_COMPANY_COPY.origin),
	}),
	currentCompany: companySummarySchema.nullable(),
	displayName: z.string().nullable(),
	emailAliases: z.array(emailAliasViewSchema),
	id: z.string().min(1),
	origin: contactOriginSchema.nullable(),
	relatedFeedback: z.array(sourceLinkSchema),
	relatedPersonaDocuments: z.array(sourceLinkSchema),
	retiredIdentities: z.array(contactOriginSchema),
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

export const CONTACT_MERGE_FIELDS = ["displayName", "currentCompany"] as const;

export type ContactMergeField = (typeof CONTACT_MERGE_FIELDS)[number];

export const contactMergeFieldChoiceSchema = z.enum(["survivor", "duplicate"]);

export const contactMergeFieldChoicesSchema = z.object({
	currentCompany: contactMergeFieldChoiceSchema.optional(),
	displayName: contactMergeFieldChoiceSchema.optional(),
});

export type ContactMergeFieldChoices = z.infer<
	typeof contactMergeFieldChoicesSchema
>;

export const previewContactMergeInputSchema = z.object({
	duplicateId: z.string().min(1),
	survivorId: z.string().min(1),
	workspaceId: z.string().min(1),
});

export type PreviewContactMergeInput = z.infer<
	typeof previewContactMergeInputSchema
>;

export const mergeContactsCommandSchema = z.object({
	actorId: z.string().min(1),
	duplicateBaseRevision: z.number().int().nonnegative(),
	duplicateId: z.string().min(1),
	fieldChoices: contactMergeFieldChoicesSchema.optional(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	previewAcknowledged: z.boolean().optional(),
	survivorBaseRevision: z.number().int().nonnegative(),
	survivorId: z.string().min(1),
	workspaceId: z.string().min(1),
});

export type MergeContactsCommand = z.infer<typeof mergeContactsCommandSchema>;

export const contactMergeConflictSchema = z.object({
	duplicateValue: z.string(),
	field: z.enum(CONTACT_MERGE_FIELDS),
	survivorValue: z.string(),
});

export const contactRelationRewriteSchema = z.object({
	fromId: z.string().min(1),
	fromKind: z.string().min(1),
	rewrittenFromId: z.string().min(1),
	rewrittenToId: z.string().min(1),
	toId: z.string().min(1),
	toKind: z.string().min(1),
	type: z.string().min(1),
});

export const contactMergePreviewSchema = z.object({
	copy: z.object({
		company: z.literal(CONTACT_AND_COMPANY_COPY.company),
		emailAliases: z.literal(CONTACT_AND_COMPANY_COPY.emailAliases),
		feedbackHistory: z.literal(CONTACT_AND_COMPANY_COPY.feedbackHistory),
		fieldConflicts: z.literal(CONTACT_AND_COMPANY_COPY.fieldConflicts),
		mergeContacts: z.literal(CONTACT_AND_COMPANY_COPY.mergeContacts),
		mergePreview: z.literal(CONTACT_AND_COMPANY_COPY.mergePreview),
		origin: z.literal(CONTACT_AND_COMPANY_COPY.origin),
		personaRelations: z.literal(CONTACT_AND_COMPANY_COPY.personaRelations),
		relationsToRewrite: z.literal(CONTACT_AND_COMPANY_COPY.relationsToRewrite),
		survivingRecord: z.literal(CONTACT_AND_COMPANY_COPY.survivingRecord),
	}),
	duplicate: contactViewSchema,
	emailAliases: z.array(emailAliasViewSchema),
	fieldConflicts: z.array(contactMergeConflictSchema),
	relatedFeedback: z.array(sourceLinkSchema),
	relatedPersonaDocuments: z.array(sourceLinkSchema),
	relationsToRewrite: z.array(contactRelationRewriteSchema),
	survivor: contactViewSchema,
});

export type ContactMergePreview = z.infer<typeof contactMergePreviewSchema>;

export const contactMergeAuditSchema = z.object({
	actorAlias: z.string().min(1),
	occurredAt: z.string().min(1),
	retiredAlias: z.string().min(1),
	survivorAlias: z.string().min(1),
	type: z.literal(CONTACT_MERGE_EVENT_TYPE),
});

export type ContactMergeAudit = z.infer<typeof contactMergeAuditSchema>;

export type ContactMergeOutcome =
	| {
			audit: ContactMergeAudit;
			contact: ContactView;
			mergeEventId: string;
			status: "committed";
	  }
	| { contact: ContactView; status: "replayed" }
	| { conflict: "Conflict"; status: "conflict" }
	| { currentValueLabel: "Current value"; status: "stale" }
	| {
			reason:
				| "invalid-command"
				| "target-not-found"
				| "merge-same-contact"
				| "merge-preview-required"
				| "merge-conflicts-unresolved"
				| "retired-identity";
			status: "rejected";
	  };

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
				| "persona-document-required"
				| "retired-identity";
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

export function contactCopy() {
	return {
		belongsToCompany: CONTACT_AND_COMPANY_COPY.belongsToCompany,
		company: CONTACT_AND_COMPANY_COPY.company,
		contact: CONTACT_AND_COMPANY_COPY.contact,
		mergeContacts: CONTACT_AND_COMPANY_COPY.mergeContacts,
		mergePreview: CONTACT_AND_COMPANY_COPY.mergePreview,
		openSourceRecord: CONTACT_AND_COMPANY_COPY.openSourceRecord,
		origin: CONTACT_AND_COMPANY_COPY.origin,
	} as const;
}

export function contactMergePreviewCopy() {
	return {
		company: CONTACT_AND_COMPANY_COPY.company,
		emailAliases: CONTACT_AND_COMPANY_COPY.emailAliases,
		feedbackHistory: CONTACT_AND_COMPANY_COPY.feedbackHistory,
		fieldConflicts: CONTACT_AND_COMPANY_COPY.fieldConflicts,
		mergeContacts: CONTACT_AND_COMPANY_COPY.mergeContacts,
		mergePreview: CONTACT_AND_COMPANY_COPY.mergePreview,
		origin: CONTACT_AND_COMPANY_COPY.origin,
		personaRelations: CONTACT_AND_COMPANY_COPY.personaRelations,
		relationsToRewrite: CONTACT_AND_COMPANY_COPY.relationsToRewrite,
		survivingRecord: CONTACT_AND_COMPANY_COPY.survivingRecord,
	} as const;
}

export function mergeFieldDisplay(value: string | null): string {
	return value ?? "";
}

export function contactMergeConflicts(
	survivor: ContactView,
	duplicate: ContactView
): Array<{
	duplicateValue: string;
	field: ContactMergeField;
	survivorValue: string;
}> {
	const displayName = {
		duplicateValue: mergeFieldDisplay(duplicate.displayName),
		field: "displayName" as const,
		survivorValue: mergeFieldDisplay(survivor.displayName),
	};
	const currentCompany = {
		duplicateValue: mergeFieldDisplay(duplicate.currentCompany?.id ?? null),
		field: "currentCompany" as const,
		survivorValue: mergeFieldDisplay(survivor.currentCompany?.id ?? null),
	};
	return [displayName, currentCompany].filter(
		(row) => row.survivorValue !== row.duplicateValue
	);
}

export function chooseContactMergeFields(
	survivor: ContactView,
	duplicate: ContactView,
	choices: ContactMergeFieldChoices | undefined
):
	| { attributed: Partial<Record<ContactMergeField, string>>; status: "ok" }
	| { status: "unresolved" } {
	const conflicts = contactMergeConflicts(survivor, duplicate);
	if (conflicts.some((conflict) => choices?.[conflict.field] === undefined)) {
		return { status: "unresolved" };
	}
	const attributed: Partial<Record<ContactMergeField, string>> = {};
	for (const conflict of conflicts) {
		if (choices?.[conflict.field] === "duplicate") {
			attributed[conflict.field] = conflict.duplicateValue;
		}
	}
	return { attributed, status: "ok" };
}

export function chosenDisplayName(
	survivor: ContactView,
	attributed: Partial<Record<ContactMergeField, string>>
): string {
	if (attributed.displayName === undefined) {
		return survivor.displayName ?? "";
	}
	return attributed.displayName;
}

export function chosenCompanyId(
	survivor: ContactView,
	attributed: Partial<Record<ContactMergeField, string>>
): string | null {
	if (attributed.currentCompany === undefined) {
		return survivor.currentCompany?.id ?? null;
	}
	if (attributed.currentCompany.length === 0) {
		return null;
	}
	return attributed.currentCompany;
}

export function unionEmailAliases(
	left: ContactView["emailAliases"],
	right: ContactView["emailAliases"]
): ContactView["emailAliases"] {
	const seen = new Set<string>();
	const aliases: ContactView["emailAliases"] = [];
	for (const alias of [...left, ...right]) {
		if (seen.has(alias.normalizedEmail)) {
			continue;
		}
		seen.add(alias.normalizedEmail);
		aliases.push(alias);
	}
	return aliases;
}
