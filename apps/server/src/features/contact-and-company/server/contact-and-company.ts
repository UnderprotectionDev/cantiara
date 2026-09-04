import { createHmac } from "node:crypto";

import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { createRelationInTransaction } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";

import {
	COMPANY_KIND,
	CONTACT_AND_COMPANY_COPY,
	CONTACT_KIND,
	CONTACT_MERGE_EVENT_TYPE,
	CONTACT_MERGE_UNDO_EVENT_TYPE,
	type CompanyView,
	type CompanyWriteOutcome,
	type ContactMergeAudit,
	type ContactMergeField,
	type ContactMergeOutcome,
	type ContactMergePreview,
	type ContactMergeUndoAudit,
	type ContactMergeUndoPreview,
	type ContactOrigin,
	type ContactUndoMergeOutcome,
	type ContactView,
	type ContactWriteOutcome,
	type CreateCompanyCommand,
	type CreateContactCommand,
	chooseContactMergeFields,
	chosenCompanyId,
	chosenDisplayName,
	contactCopy,
	contactMergeConflicts,
	contactMergePreviewCopy,
	contactMergeUndoPreviewCopy,
	createCompanyCommandSchema,
	createContactCommandSchema,
	DOCUMENT_KIND,
	type DuplicateCandidate,
	type DuplicateCandidateReason,
	FEEDBACK_KIND,
	type MergeContactsCommand,
	mergeContactsCommandSchema,
	normalizeDisplayName,
	normalizeEmailAlias,
	optionalDisplayName,
	PERSONA_DOCUMENT_TYPE,
	previewContactMergeInputSchema,
	previewContactMergeUndoInputSchema,
	type RelateContactPersonaCommand,
	relateContactPersonaCommandSchema,
	type SetContactCompanyCommand,
	type SourceLink,
	setContactCompanyCommandSchema,
	type UndoMergeContactsCommand,
	undoMergeContactsCommandSchema,
	unionEmailAliases,
} from "./contact-and-company-model";

type PrismaTransaction = Prisma.TransactionClient;

export async function createContact(
	prisma: PrismaClient,
	command: unknown
): Promise<ContactWriteOutcome> {
	const parsed = createContactCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		createContactInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function createCompany(
	prisma: PrismaClient,
	command: unknown
): Promise<CompanyWriteOutcome> {
	const parsed = createCompanyCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		createCompanyInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function setContactCompany(
	prisma: PrismaClient,
	command: unknown
): Promise<ContactWriteOutcome> {
	const parsed = setContactCompanyCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		setCompanyInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function relateContactPersona(
	prisma: PrismaClient,
	command: unknown
): Promise<ContactWriteOutcome> {
	const parsed = relateContactPersonaCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		relatePersonaInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function getContact(
	prisma: PrismaClient | PrismaTransaction,
	contactId: string,
	workspaceId: string
): Promise<ContactView | null> {
	const row = await prisma.contact.findFirst({
		include: {
			affiliations: { orderBy: { startedAt: "asc" } },
			emailAliases: { orderBy: { createdAt: "asc" } },
		},
		where: { id: contactId, workspaceId },
	});
	if (!row) {
		return null;
	}
	if (row.retiredIntoId) {
		const survivor = await getContact(prisma, row.retiredIntoId, workspaceId);
		if (!survivor) {
			return null;
		}
		return {
			...survivor,
			origin: {
				displayName: optionalDisplayName(row.displayName) || null,
				id: row.id,
			},
		};
	}
	return await hydrateContact(prisma, row);
}

export async function getCompany(
	prisma: PrismaClient,
	companyId: string,
	workspaceId: string
): Promise<CompanyView | null> {
	const row = await prisma.company.findFirst({
		where: { id: companyId, workspaceId },
	});
	if (!row) {
		return null;
	}
	return toCompanyView(row);
}

export async function listContacts(
	prisma: PrismaClient,
	workspaceId: string
): Promise<ContactView[]> {
	const rows = await prisma.contact.findMany({
		include: {
			affiliations: { orderBy: { startedAt: "asc" } },
			emailAliases: { orderBy: { createdAt: "asc" } },
		},
		orderBy: { createdAt: "asc" },
		where: { retiredIntoId: null, workspaceId },
	});
	return await Promise.all(rows.map((row) => hydrateContact(prisma, row)));
}

export async function searchContacts(
	prisma: PrismaClient,
	workspaceId: string,
	text: string
): Promise<ContactView[]> {
	const query = text.trim().toLowerCase();
	if (query.length === 0) {
		return [];
	}
	const contacts = await listContacts(prisma, workspaceId);
	return contacts.filter((contact) => {
		if (contact.id.toLowerCase() === query) {
			return true;
		}
		const name = normalizeDisplayName(contact.displayName);
		return Boolean(name?.includes(query));
	});
}

export async function listContactMergeAudit(
	prisma: PrismaClient
): Promise<ContactMergeAudit[]> {
	const rows = await prisma.auditEvent.findMany({
		orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
		where: { type: CONTACT_MERGE_EVENT_TYPE },
	});
	return rows.map((row) => ({
		actorAlias: row.actorAlias,
		occurredAt: row.occurredAt.toISOString(),
		retiredAlias: row.sessionAlias ?? "",
		survivorAlias: row.accountAlias,
		type: CONTACT_MERGE_EVENT_TYPE,
	}));
}

export async function previewContactMerge(
	prisma: PrismaClient,
	input: unknown
): Promise<
	| ContactMergePreview
	| {
			reason: "target-not-found" | "merge-same-contact" | "retired-identity";
	  }
> {
	const parsed = previewContactMergeInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "target-not-found" };
	}
	if (parsed.data.survivorId === parsed.data.duplicateId) {
		return { reason: "merge-same-contact" };
	}
	const survivorRow = await prisma.contact.findFirst({
		where: {
			id: parsed.data.survivorId,
			workspaceId: parsed.data.workspaceId,
		},
	});
	const duplicateRow = await prisma.contact.findFirst({
		where: {
			id: parsed.data.duplicateId,
			workspaceId: parsed.data.workspaceId,
		},
	});
	if (!(survivorRow && duplicateRow)) {
		return { reason: "target-not-found" };
	}
	if (survivorRow.retiredIntoId || duplicateRow.retiredIntoId) {
		return { reason: "retired-identity" };
	}
	const survivor = await getContact(
		prisma,
		survivorRow.id,
		parsed.data.workspaceId
	);
	const duplicate = await getContact(
		prisma,
		duplicateRow.id,
		parsed.data.workspaceId
	);
	if (!(survivor && duplicate)) {
		return { reason: "target-not-found" };
	}
	return await buildMergePreview(prisma, survivor, duplicate);
}

export async function mergeContacts(
	prisma: PrismaClient,
	command: unknown
): Promise<ContactMergeOutcome> {
	const parsed = mergeContactsCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		duplicateId: parsed.data.duplicateId,
		fieldChoices: parsed.data.fieldChoices ?? {},
		previewAcknowledged: parsed.data.previewAcknowledged ?? false,
		survivorId: parsed.data.survivorId,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		mergeInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function previewContactMergeUndo(
	prisma: PrismaClient,
	input: unknown
): Promise<
	ContactMergeUndoPreview | { reason: "target-not-found" | "retired-identity" }
> {
	const parsed = previewContactMergeUndoInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "target-not-found" };
	}
	const built = await buildUndoPreview(
		prisma,
		parsed.data.mergeEventId,
		parsed.data.survivorId,
		parsed.data.workspaceId
	);
	if (built.status !== "ok") {
		return { reason: built.reason };
	}
	return built.preview;
}

export async function undoMergeContacts(
	prisma: PrismaClient,
	command: unknown
): Promise<ContactUndoMergeOutcome> {
	const parsed = undoMergeContactsCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		mergeEventId: parsed.data.mergeEventId,
		previewAcknowledged: parsed.data.previewAcknowledged ?? false,
		undo: true,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		undoMergeInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function listCompanies(
	prisma: PrismaClient,
	workspaceId: string
): Promise<CompanyView[]> {
	const rows = await prisma.company.findMany({
		orderBy: { name: "asc" },
		where: { workspaceId },
	});
	return rows.map(toCompanyView);
}

export async function listDuplicateCandidates(
	prisma: PrismaClient,
	workspaceId: string
): Promise<DuplicateCandidate[]> {
	const contacts = await listContacts(prisma, workspaceId);
	const pairs: DuplicateCandidate[] = [];
	for (let index = 0; index < contacts.length; index += 1) {
		const first = contacts[index];
		if (!first) {
			continue;
		}
		for (let other = index + 1; other < contacts.length; other += 1) {
			const second = contacts[other];
			if (!second) {
				continue;
			}
			const pair = duplicateCandidateFor(first, second);
			if (pair) {
				pairs.push(pair);
			}
		}
	}
	return pairs;
}

function duplicateCandidateFor(
	first: ContactView,
	second: ContactView
): DuplicateCandidate | null {
	const [left, right] =
		first.id < second.id ? [first, second] : [second, first];
	const emails = new Set(
		left.emailAliases.map((alias) => alias.normalizedEmail)
	);
	const reasons: DuplicateCandidateReason[] = [];
	if (right.emailAliases.some((alias) => emails.has(alias.normalizedEmail))) {
		reasons.push("same-normalized-email");
	}
	const leftName = normalizeDisplayName(left.displayName);
	const rightName = normalizeDisplayName(right.displayName);
	if (leftName && rightName && leftName === rightName) {
		reasons.push("similar-name");
	}
	if (
		left.currentCompany &&
		right.currentCompany &&
		left.currentCompany.id === right.currentCompany.id
	) {
		reasons.push("similar-company");
	}
	if (reasons.length === 0) {
		return null;
	}
	return {
		copy: {
			strongCopyCandidate: CONTACT_AND_COMPANY_COPY.strongCopyCandidate,
			weakSuggestion: CONTACT_AND_COMPANY_COPY.weakSuggestion,
		},
		left: { displayName: left.displayName, id: left.id },
		reasons,
		right: { displayName: right.displayName, id: right.id },
		strength: reasons.includes("same-normalized-email") ? "strong" : "weak",
	};
}

async function createContactInTransaction(
	tx: PrismaTransaction,
	command: CreateContactCommand,
	commandKey: string,
	fingerprint: string
): Promise<ContactWriteOutcome> {
	const workspace = await tx.workspace.findUnique({
		select: { id: true },
		where: { id: command.workspaceId },
	});
	if (!workspace) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockWorkspace(tx, workspace.id);
	const replayed = await replayContactWrite(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	if (command.payload.companyId) {
		const company = await tx.company.findFirst({
			where: {
				id: command.payload.companyId,
				workspaceId: workspace.id,
			},
		});
		if (!company) {
			return { reason: "company-not-found", status: "rejected" };
		}
	}
	const contactId = crypto.randomUUID();
	await tx.contact.create({
		data: {
			displayName: optionalDisplayName(command.payload.displayName),
			id: contactId,
			revision: 1,
			workspaceId: workspace.id,
		},
	});
	const email = command.payload.email
		? normalizeEmailAlias(command.payload.email)
		: null;
	if (email && command.payload.email) {
		await tx.contactEmailAlias.create({
			data: {
				contactId,
				id: crypto.randomUUID(),
				normalizedEmail: email,
				originalEmail: command.payload.email.trim(),
			},
		});
	}
	if (command.payload.companyId) {
		const affiliated = await writeCurrentCompany(
			tx,
			{
				actorId: command.actorId,
				companyId: command.payload.companyId,
				contactId,
				workspaceId: workspace.id,
			},
			`${command.idempotencyKey}:company`
		);
		if (affiliated.status === "rejected") {
			return affiliated;
		}
	}
	const contact = await getContact(tx, contactId, workspace.id);
	if (!contact) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await writeContactReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		contact,
		fingerprint,
	});
	return { contact, status: "committed" };
}

async function createCompanyInTransaction(
	tx: PrismaTransaction,
	command: CreateCompanyCommand,
	commandKey: string,
	fingerprint: string
): Promise<CompanyWriteOutcome> {
	const workspace = await tx.workspace.findUnique({
		select: { id: true },
		where: { id: command.workspaceId },
	});
	if (!workspace) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockWorkspace(tx, workspace.id);
	const replayed = await replayCompanyWrite(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const name = command.payload.name.trim();
	if (name.length === 0) {
		return { reason: "missing-name", status: "rejected" };
	}
	const company = toCompanyView(
		await tx.company.create({
			data: {
				id: crypto.randomUUID(),
				name,
				revision: 1,
				workspaceId: workspace.id,
			},
		})
	);
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: company.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(company),
			targetId: company.id,
		},
	});
	return { company, status: "committed" };
}

async function setCompanyInTransaction(
	tx: PrismaTransaction,
	command: SetContactCompanyCommand,
	commandKey: string,
	fingerprint: string
): Promise<ContactWriteOutcome> {
	const contact = await tx.contact.findFirst({
		where: { id: command.payload.contactId, workspaceId: command.workspaceId },
	});
	if (!contact || contact.retiredIntoId) {
		return {
			reason: contact?.retiredIntoId ? "retired-identity" : "target-not-found",
			status: "rejected",
		};
	}
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayContactWrite(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.contact.findFirst({
		where: { id: contact.id, workspaceId: command.workspaceId },
	});
	if (!locked) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return {
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	if (command.payload.companyId) {
		const company = await tx.company.findFirst({
			where: {
				id: command.payload.companyId,
				workspaceId: command.workspaceId,
			},
		});
		if (!company) {
			return { reason: "company-not-found", status: "rejected" };
		}
	}
	const affiliated = await writeCurrentCompany(
		tx,
		{
			actorId: command.actorId,
			companyId: command.payload.companyId,
			contactId: locked.id,
			workspaceId: command.workspaceId,
		},
		`${command.idempotencyKey}:company`
	);
	if (affiliated.status === "rejected") {
		return affiliated;
	}
	await tx.contact.update({
		data: { revision: locked.revision + 1 },
		where: { id: locked.id },
	});
	const view = await getContact(tx, locked.id, command.workspaceId);
	if (!view) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await writeContactReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		contact: view,
		fingerprint,
	});
	return { contact: view, status: "committed" };
}

async function relatePersonaInTransaction(
	tx: PrismaTransaction,
	command: RelateContactPersonaCommand,
	commandKey: string,
	fingerprint: string
): Promise<ContactWriteOutcome> {
	const contact = await tx.contact.findFirst({
		where: { id: command.payload.contactId, workspaceId: command.workspaceId },
	});
	if (!contact || contact.retiredIntoId) {
		return {
			reason: contact?.retiredIntoId ? "retired-identity" : "target-not-found",
			status: "rejected",
		};
	}
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayContactWrite(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const document = await tx.document.findFirst({
		where: {
			id: command.payload.documentId,
			workspaceId: command.workspaceId,
		},
	});
	if (!document) {
		return { reason: "document-not-found", status: "rejected" };
	}
	if (document.type !== PERSONA_DOCUMENT_TYPE) {
		return { reason: "persona-document-required", status: "rejected" };
	}
	const related = await createRelationInTransaction(tx, {
		actorId: command.actorId,
		from: { id: contact.id, kind: CONTACT_KIND },
		idempotencyKey: `${command.idempotencyKey}:relation`,
		origin: HUMAN_ORIGIN,
		previewAcknowledged: true,
		to: { id: document.id, kind: DOCUMENT_KIND },
		type: RELATIONS_COPY.related,
		viewerWorkspaceId: command.workspaceId,
	});
	if (related.status !== "committed" && related.status !== "replayed") {
		return { reason: "invalid-command", status: "rejected" };
	}
	const view = await getContact(tx, contact.id, command.workspaceId);
	if (!view) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await writeContactReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		contact: view,
		fingerprint,
	});
	return { contact: view, status: "committed" };
}

async function writeCurrentCompany(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		companyId: string | null;
		contactId: string;
		workspaceId: string;
	},
	idempotencyKey: string
): Promise<
	| { status: "ok" }
	| { reason: "invalid-command" | "company-not-found"; status: "rejected" }
> {
	const current = await tx.contactCompanyAffiliation.findFirst({
		where: { contactId: input.contactId, endedAt: null },
	});
	if (current && current.companyId === input.companyId) {
		return { status: "ok" };
	}
	const now = new Date();
	if (current) {
		await tx.contactCompanyAffiliation.update({
			data: { endedAt: now },
			where: { id: current.id },
		});
		await tx.typedRelation.deleteMany({
			where: {
				fromId: input.contactId,
				fromKind: CONTACT_KIND,
				type: RELATIONS_COPY.belongsToCompany,
			},
		});
	}
	if (!input.companyId) {
		return { status: "ok" };
	}
	await tx.contactCompanyAffiliation.create({
		data: {
			companyId: input.companyId,
			contactId: input.contactId,
			id: crypto.randomUUID(),
			startedAt: now,
		},
	});
	const related = await createRelationInTransaction(tx, {
		actorId: input.actorId,
		from: { id: input.contactId, kind: CONTACT_KIND },
		idempotencyKey,
		origin: HUMAN_ORIGIN,
		previewAcknowledged: true,
		to: { id: input.companyId, kind: COMPANY_KIND },
		type: RELATIONS_COPY.belongsToCompany,
		viewerWorkspaceId: input.workspaceId,
	});
	if (related.status !== "committed" && related.status !== "replayed") {
		return { reason: "invalid-command", status: "rejected" };
	}
	return { status: "ok" };
}

async function hydrateContact(
	db: PrismaClient | PrismaTransaction,
	row: {
		affiliations: Array<{
			companyId: string;
			endedAt: Date | null;
			startedAt: Date;
		}>;
		displayName: string;
		emailAliases: Array<{
			normalizedEmail: string;
			originalEmail: string;
		}>;
		id: string;
		revision: number;
		workspaceId: string;
	}
): Promise<ContactView> {
	const companyIds = [
		...new Set(row.affiliations.map((item) => item.companyId)),
	];
	const companies =
		companyIds.length === 0
			? []
			: await db.company.findMany({
					where: { id: { in: companyIds } },
				});
	const nameById = new Map(
		companies.map((company) => [company.id, company.name])
	);
	const currentAffiliation = [...row.affiliations]
		.reverse()
		.find((item) => item.endedAt === null);
	const currentCompany = currentAffiliation
		? {
				id: currentAffiliation.companyId,
				name: nameById.get(currentAffiliation.companyId) ?? "",
			}
		: null;
	const related = await db.typedRelation.findMany({
		orderBy: { establishedAt: "asc" },
		where: {
			OR: [
				{ fromId: row.id, fromKind: CONTACT_KIND },
				{ toId: row.id, toKind: CONTACT_KIND },
			],
		},
	});
	const personaIds = related
		.filter(
			(edge) =>
				edge.type === RELATIONS_COPY.related &&
				edge.fromKind === CONTACT_KIND &&
				edge.toKind === DOCUMENT_KIND
		)
		.map((edge) => edge.toId);
	const personaDocuments =
		personaIds.length === 0
			? []
			: await db.document.findMany({
					where: {
						id: { in: personaIds },
						type: PERSONA_DOCUMENT_TYPE,
						workspaceId: row.workspaceId,
					},
				});
	const relatedPersonaDocuments = personaDocuments.map((document) =>
		toSourceLink(document.id, DOCUMENT_KIND, document.title)
	);
	const feedbackIds = related
		.filter(
			(edge) =>
				edge.type === RELATIONS_COPY.participant &&
				edge.fromKind === FEEDBACK_KIND &&
				edge.toKind === CONTACT_KIND
		)
		.map((edge) => edge.fromId);
	const feedbackRows =
		feedbackIds.length === 0
			? []
			: await db.feedback.findMany({
					select: { id: true, originalMessage: true },
					where: { id: { in: feedbackIds } },
				});
	const feedbackTitleById = new Map(
		feedbackRows.map((item) => [item.id, item.originalMessage])
	);
	const relatedFeedback = feedbackIds.map((id) =>
		toSourceLink(id, FEEDBACK_KIND, feedbackTitleById.get(id) ?? "")
	);
	return {
		companyHistory: row.affiliations.map((item) => ({
			companyId: item.companyId,
			endedAt: item.endedAt ? item.endedAt.toISOString() : null,
			name: nameById.get(item.companyId) ?? "",
			startedAt: item.startedAt.toISOString(),
		})),
		copy: contactCopy(),
		currentCompany,
		displayName: row.displayName.length > 0 ? row.displayName : null,
		emailAliases: row.emailAliases.map((alias) => ({
			normalizedEmail: alias.normalizedEmail,
			originalEmail: alias.originalEmail,
		})),
		id: row.id,
		latestMergeEventId: await loadLatestMergeEventId(db, row.id),
		origin: null,
		relatedFeedback,
		relatedPersonaDocuments,
		retiredIdentities: await loadRetiredIdentities(db, row.id),
		revision: row.revision,
		workspaceId: row.workspaceId,
	};
}

function toCompanyView(row: {
	id: string;
	name: string;
	revision: number;
	workspaceId: string;
}): CompanyView {
	return {
		copy: {
			belongsToCompany: CONTACT_AND_COMPANY_COPY.belongsToCompany,
			company: CONTACT_AND_COMPANY_COPY.company,
			openSourceRecord: CONTACT_AND_COMPANY_COPY.openSourceRecord,
		},
		id: row.id,
		name: row.name,
		revision: row.revision,
		workspaceId: row.workspaceId,
	};
}

function toSourceLink(id: string, kind: string, title: string): SourceLink {
	return {
		id,
		kind,
		openSourceRecord: CONTACT_AND_COMPANY_COPY.openSourceRecord,
		title,
	};
}

async function writeContactReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		contact: ContactView;
		fingerprint: string;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.contact.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.contact),
			targetId: input.contact.id,
		},
	});
}

async function replayContactWrite(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<ContactWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedContact(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { contact: stored, status: "replayed" };
}

async function replayCompanyWrite(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<CompanyWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedCompany(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { company: stored, status: "replayed" };
}

function storedContact(value: string): ContactView | null {
	try {
		const parsed: unknown = JSON.parse(value);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"id" in parsed &&
			"workspaceId" in parsed
		) {
			return parsed as ContactView;
		}
		return null;
	} catch {
		return null;
	}
}

function storedCompany(value: string): CompanyView | null {
	try {
		const parsed: unknown = JSON.parse(value);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"id" in parsed &&
			"name" in parsed
		) {
			return parsed as CompanyView;
		}
		return null;
	} catch {
		return null;
	}
}

async function lockWorkspace(
	tx: PrismaTransaction,
	workspaceId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(
		`contact-and-company:workspace:${workspaceId}`
	);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

async function loadRetiredIdentities(
	db: PrismaClient | PrismaTransaction,
	survivorId: string
): Promise<ContactOrigin[]> {
	const rows = await db.contact.findMany({
		orderBy: { createdAt: "asc" },
		select: { displayName: true, id: true },
		where: { retiredIntoId: survivorId },
	});
	return rows.map((row) => ({
		displayName: row.displayName.length > 0 ? row.displayName : null,
		id: row.id,
	}));
}

async function loadLatestMergeEventId(
	db: PrismaClient | PrismaTransaction,
	survivorId: string
): Promise<string | null> {
	const event = await db.contactMergeEvent.findFirst({
		orderBy: { createdAt: "desc" },
		select: { id: true },
		where: { survivorId },
	});
	return event?.id ?? null;
}

async function buildMergePreview(
	db: PrismaClient | PrismaTransaction,
	survivor: ContactView,
	duplicate: ContactView
): Promise<ContactMergePreview> {
	const relations = await db.typedRelation.findMany({
		orderBy: { establishedAt: "asc" },
		where: {
			OR: [
				{ fromId: duplicate.id, fromKind: CONTACT_KIND },
				{ toId: duplicate.id, toKind: CONTACT_KIND },
			],
		},
	});
	const relatedFeedback = uniqueSourceLinks([
		...survivor.relatedFeedback,
		...duplicate.relatedFeedback,
	]);
	const relatedPersonaDocuments = uniqueSourceLinks([
		...survivor.relatedPersonaDocuments,
		...duplicate.relatedPersonaDocuments,
	]);
	return {
		copy: contactMergePreviewCopy(),
		duplicate,
		emailAliases: unionEmailAliases(
			survivor.emailAliases,
			duplicate.emailAliases
		),
		fieldConflicts: contactMergeConflicts(survivor, duplicate),
		relatedFeedback,
		relatedPersonaDocuments,
		relationsToRewrite: relations.flatMap((relation) => {
			const rewrite = rewriteRelation(relation, survivor.id, duplicate.id);
			if (!rewrite || rewrite.drop) {
				return [];
			}
			return [
				{
					fromId: relation.fromId,
					fromKind: relation.fromKind,
					rewrittenFromId: rewrite.fromId,
					rewrittenToId: rewrite.toId,
					toId: relation.toId,
					toKind: relation.toKind,
					type: relation.type,
				},
			];
		}),
		survivor,
	};
}

function uniqueSourceLinks(links: SourceLink[]): SourceLink[] {
	const seen = new Set<string>();
	const unique: SourceLink[] = [];
	for (const link of links) {
		const key = `${link.kind}:${link.id}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		unique.push(link);
	}
	return unique;
}

function rewriteRelation(
	relation: { fromId: string; fromKind: string; toId: string; toKind: string },
	survivorId: string,
	duplicateId: string
): { drop: boolean; fromId: string; toId: string } | null {
	const fromId = relation.fromId === duplicateId ? survivorId : relation.fromId;
	const toId = relation.toId === duplicateId ? survivorId : relation.toId;
	if (fromId === toId) {
		return { drop: true, fromId, toId };
	}
	if (fromId === relation.fromId && toId === relation.toId) {
		return null;
	}
	return { drop: false, fromId, toId };
}

interface RewrittenContactRelation {
	fromKind: string;
	id: string;
	originalFromId: string;
	originalToId: string;
	rewrittenFromId: string;
	rewrittenToId: string;
	toKind: string;
	type: string;
}

interface StoredMergeAlias {
	normalizedEmail: string;
	originalEmail: string;
	shared: boolean;
}

interface ContactFieldSnapshot {
	currentCompanyId: string | null;
	displayName: string | null;
}

interface RetiredContactSnapshot extends ContactFieldSnapshot {
	id: string;
}

async function mergeInTransaction(
	tx: PrismaTransaction,
	command: MergeContactsCommand,
	commandKey: string,
	fingerprint: string
): Promise<ContactMergeOutcome> {
	if (command.survivorId === command.duplicateId) {
		return { reason: "merge-same-contact", status: "rejected" };
	}
	const pair = await loadLiveMergePair(tx, command);
	if (pair.status !== "ok") {
		return pair.outcome;
	}
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayMergeOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	if (
		pair.survivorRow.revision !== command.survivorBaseRevision ||
		pair.duplicateRow.revision !== command.duplicateBaseRevision
	) {
		return {
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	if (command.previewAcknowledged !== true) {
		return { reason: "merge-preview-required", status: "rejected" };
	}
	const survivor = await getContact(
		tx,
		pair.survivorRow.id,
		command.workspaceId
	);
	const duplicate = await getContact(
		tx,
		pair.duplicateRow.id,
		command.workspaceId
	);
	if (!(survivor && duplicate)) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const chosen = chooseContactMergeFields(
		survivor,
		duplicate,
		command.fieldChoices
	);
	if (chosen.status !== "ok") {
		return { reason: "merge-conflicts-unresolved", status: "rejected" };
	}
	return await commitContactMerge(tx, {
		actorId: command.actorId,
		attributed: chosen.attributed,
		commandKey,
		duplicate,
		fingerprint,
		survivor,
		workspaceId: command.workspaceId,
	});
}

async function loadLiveMergePair(
	tx: PrismaTransaction,
	command: MergeContactsCommand
): Promise<
	| {
			duplicateRow: {
				id: string;
				retiredIntoId: string | null;
				revision: number;
			};
			status: "ok";
			survivorRow: {
				id: string;
				retiredIntoId: string | null;
				revision: number;
			};
	  }
	| { outcome: ContactMergeOutcome; status: "rejected" }
> {
	const survivorRow = await tx.contact.findFirst({
		where: { id: command.survivorId, workspaceId: command.workspaceId },
	});
	const duplicateRow = await tx.contact.findFirst({
		where: { id: command.duplicateId, workspaceId: command.workspaceId },
	});
	if (!(survivorRow && duplicateRow)) {
		return {
			outcome: { reason: "target-not-found", status: "rejected" },
			status: "rejected",
		};
	}
	if (survivorRow.retiredIntoId || duplicateRow.retiredIntoId) {
		return {
			outcome: { reason: "retired-identity", status: "rejected" },
			status: "rejected",
		};
	}
	return { duplicateRow, status: "ok", survivorRow };
}

async function commitContactMerge(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		attributed: Partial<Record<ContactMergeField, string>>;
		commandKey: string;
		duplicate: ContactView;
		fingerprint: string;
		survivor: ContactView;
		workspaceId: string;
	}
): Promise<ContactMergeOutcome> {
	const duplicateAliases = await tx.contactEmailAlias.findMany({
		where: { contactId: input.duplicate.id },
	});
	const survivorAliasKeys = new Set(
		(
			await tx.contactEmailAlias.findMany({
				where: { contactId: input.survivor.id },
			})
		).map((alias) => alias.normalizedEmail)
	);
	const movedEmailAliases: StoredMergeAlias[] = duplicateAliases.map(
		(alias) => ({
			normalizedEmail: alias.normalizedEmail,
			originalEmail: alias.originalEmail,
			shared: survivorAliasKeys.has(alias.normalizedEmail),
		})
	);
	const movedAffiliationIds = (
		await tx.contactCompanyAffiliation.findMany({
			select: { id: true },
			where: { contactId: input.duplicate.id },
		})
	).map((row) => row.id);
	const moved = await rewriteDuplicateRelations(
		tx,
		input.survivor.id,
		input.duplicate.id
	);
	await moveEmailAliases(tx, input.survivor.id, input.duplicate.id);
	await moveAffiliations(
		tx,
		input.survivor.id,
		input.duplicate.id,
		chosenCompanyId(input.survivor, input.attributed)
	);
	await tx.contact.update({
		data: {
			displayName: chosenDisplayName(input.survivor, input.attributed),
			revision: input.survivor.revision + 1,
		},
		where: { id: input.survivor.id },
	});
	await tx.contact.update({
		data: { retiredIntoId: input.survivor.id },
		where: { id: input.duplicate.id },
	});
	const contact = await getContact(tx, input.survivor.id, input.workspaceId);
	if (!contact) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const mergeEventId = crypto.randomUUID();
	await tx.contactMergeEvent.create({
		data: {
			attributedFields: JSON.stringify(input.attributed),
			id: mergeEventId,
			movedRelations: JSON.stringify({
				affiliations: movedAffiliationIds,
				aliases: movedEmailAliases,
				relations: moved,
			}),
			postMergeSurvivor: JSON.stringify({
				currentCompanyId: contact.currentCompany?.id ?? null,
				displayName: contact.displayName,
			}),
			previousSurvivor: JSON.stringify({
				currentCompanyId: input.survivor.currentCompany?.id ?? null,
				displayName: input.survivor.displayName,
			}),
			retiredId: input.duplicate.id,
			retiredSnapshot: JSON.stringify({
				currentCompanyId: input.duplicate.currentCompany?.id ?? null,
				displayName: input.duplicate.displayName,
				id: input.duplicate.id,
			}),
			survivorId: input.survivor.id,
		},
	});
	const occurredAt = new Date();
	const audit = contactMergeAudit({
		actorId: input.actorId,
		occurredAt,
		retiredId: input.duplicate.id,
		survivorId: input.survivor.id,
	});
	await tx.auditEvent.create({
		data: {
			accountAlias: audit.survivorAlias,
			actorAlias: audit.actorAlias,
			id: crypto.randomUUID(),
			occurredAt,
			sessionAlias: audit.retiredAlias,
			type: CONTACT_MERGE_EVENT_TYPE,
		},
	});
	await writeContactReceipt(tx, {
		actorId: input.actorId,
		commandKey: input.commandKey,
		contact,
		fingerprint: input.fingerprint,
	});
	return {
		audit,
		contact,
		mergeEventId,
		status: "committed",
	};
}

async function replayMergeOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<ContactMergeOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedContact(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { contact: stored, status: "replayed" };
}

async function rewriteDuplicateRelations(
	tx: PrismaTransaction,
	survivorId: string,
	duplicateId: string
): Promise<RewrittenContactRelation[]> {
	const relations = await tx.typedRelation.findMany({
		where: {
			OR: [
				{ fromId: duplicateId, fromKind: CONTACT_KIND },
				{ toId: duplicateId, toKind: CONTACT_KIND },
			],
		},
	});
	const survivorRelations = await tx.typedRelation.findMany({
		where: {
			OR: [
				{ fromId: survivorId, fromKind: CONTACT_KIND },
				{ toId: survivorId, toKind: CONTACT_KIND },
			],
		},
	});
	const existingKeys = new Set(
		survivorRelations.map(
			(row) =>
				`${row.type}:${row.fromKind}:${row.fromId}:${row.toKind}:${row.toId}`
		)
	);
	const moved: RewrittenContactRelation[] = [];
	const deleteIds: string[] = [];
	const updates: Array<{ fromId: string; id: string; toId: string }> = [];
	for (const relation of relations) {
		const rewrite = rewriteRelation(relation, survivorId, duplicateId);
		if (!rewrite) {
			continue;
		}
		moved.push({
			fromKind: relation.fromKind,
			id: relation.id,
			originalFromId: relation.fromId,
			originalToId: relation.toId,
			rewrittenFromId: rewrite.fromId,
			rewrittenToId: rewrite.toId,
			toKind: relation.toKind,
			type: relation.type,
		});
		if (rewrite.drop) {
			deleteIds.push(relation.id);
			continue;
		}
		const key = `${relation.type}:${relation.fromKind}:${rewrite.fromId}:${relation.toKind}:${rewrite.toId}`;
		if (existingKeys.has(key)) {
			deleteIds.push(relation.id);
			continue;
		}
		updates.push({
			fromId: rewrite.fromId,
			id: relation.id,
			toId: rewrite.toId,
		});
		existingKeys.add(key);
	}
	if (deleteIds.length > 0) {
		await tx.typedRelation.deleteMany({ where: { id: { in: deleteIds } } });
	}
	await Promise.all(
		updates.map((update) =>
			tx.typedRelation.update({
				data: { fromId: update.fromId, toId: update.toId },
				where: { id: update.id },
			})
		)
	);
	return moved;
}

async function moveEmailAliases(
	tx: PrismaTransaction,
	survivorId: string,
	duplicateId: string
): Promise<void> {
	const survivorAliases = await tx.contactEmailAlias.findMany({
		where: { contactId: survivorId },
	});
	const existing = new Set(
		survivorAliases.map((alias) => alias.normalizedEmail)
	);
	const duplicateAliases = await tx.contactEmailAlias.findMany({
		where: { contactId: duplicateId },
	});
	const toCreate = duplicateAliases.filter((alias) => {
		if (existing.has(alias.normalizedEmail)) {
			return false;
		}
		existing.add(alias.normalizedEmail);
		return true;
	});
	if (toCreate.length > 0) {
		await tx.contactEmailAlias.createMany({
			data: toCreate.map((alias) => ({
				contactId: survivorId,
				id: crypto.randomUUID(),
				normalizedEmail: alias.normalizedEmail,
				originalEmail: alias.originalEmail,
			})),
		});
	}
	await tx.contactEmailAlias.deleteMany({ where: { contactId: duplicateId } });
}

async function moveAffiliations(
	tx: PrismaTransaction,
	survivorId: string,
	duplicateId: string,
	nextCompanyId: string | null
): Promise<void> {
	await tx.contactCompanyAffiliation.updateMany({
		data: { contactId: survivorId },
		where: { contactId: duplicateId },
	});
	const currents = await tx.contactCompanyAffiliation.findMany({
		where: { contactId: survivorId, endedAt: null },
	});
	const now = new Date();
	let kept = false;
	const endIds: string[] = [];
	for (const row of currents) {
		if (nextCompanyId && row.companyId === nextCompanyId && !kept) {
			kept = true;
			continue;
		}
		endIds.push(row.id);
	}
	if (endIds.length > 0) {
		await tx.contactCompanyAffiliation.updateMany({
			data: { endedAt: now },
			where: { id: { in: endIds } },
		});
	}
	await tx.typedRelation.deleteMany({
		where: {
			fromId: survivorId,
			fromKind: CONTACT_KIND,
			type: RELATIONS_COPY.belongsToCompany,
		},
	});
	if (nextCompanyId) {
		const company = await tx.company.findFirst({
			where: { id: nextCompanyId },
		});
		if (company) {
			await tx.typedRelation.create({
				data: {
					fromId: survivorId,
					fromKind: CONTACT_KIND,
					id: crypto.randomUUID(),
					revision: 1,
					toId: nextCompanyId,
					toKind: COMPANY_KIND,
					type: RELATIONS_COPY.belongsToCompany,
				},
			});
		}
	}
}

function contactMergeAudit(input: {
	actorId: string;
	occurredAt: Date;
	retiredId: string;
	survivorId: string;
}): ContactMergeAudit {
	return {
		actorAlias: denetimAlias("actor", input.actorId),
		occurredAt: input.occurredAt.toISOString(),
		retiredAlias: denetimAlias("contact", input.retiredId),
		survivorAlias: denetimAlias("contact", input.survivorId),
		type: CONTACT_MERGE_EVENT_TYPE,
	};
}

function denetimAlias(kind: string, id: string): string {
	return createHmac("sha256", "cantiara-denetim-kaydi")
		.update(`${kind}:${id}`)
		.digest("hex");
}

function contactMergeUndoAudit(input: {
	actorId: string;
	occurredAt: Date;
	retiredId: string;
	survivorId: string;
}): ContactMergeUndoAudit {
	return {
		actorAlias: denetimAlias("actor", input.actorId),
		occurredAt: input.occurredAt.toISOString(),
		retiredAlias: denetimAlias("contact", input.retiredId),
		survivorAlias: denetimAlias("contact", input.survivorId),
		type: CONTACT_MERGE_UNDO_EVENT_TYPE,
	};
}

function parseAttributedFields(
	text: string
): Partial<Record<ContactMergeField, string>> {
	try {
		const parsed: unknown = JSON.parse(text);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		const record = parsed as Record<string, unknown>;
		const attributed: Partial<Record<ContactMergeField, string>> = {};
		if (typeof record.displayName === "string") {
			attributed.displayName = record.displayName;
		}
		if (typeof record.currentCompany === "string") {
			attributed.currentCompany = record.currentCompany;
		}
		return attributed;
	} catch {
		return {};
	}
}

function parseFieldSnapshot(text: string): ContactFieldSnapshot {
	try {
		const parsed: unknown = JSON.parse(text);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return { currentCompanyId: null, displayName: null };
		}
		const record = parsed as Record<string, unknown>;
		return {
			currentCompanyId:
				typeof record.currentCompanyId === "string"
					? record.currentCompanyId
					: null,
			displayName:
				typeof record.displayName === "string" ? record.displayName : null,
		};
	} catch {
		return { currentCompanyId: null, displayName: null };
	}
}

function parseRetiredSnapshot(text: string): RetiredContactSnapshot | null {
	const fields = parseFieldSnapshot(text);
	try {
		const parsed: unknown = JSON.parse(text);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return null;
		}
		const record = parsed as Record<string, unknown>;
		if (typeof record.id !== "string") {
			return null;
		}
		return { ...fields, id: record.id };
	} catch {
		return null;
	}
}

function parseMovedBundle(text: string): {
	affiliations: string[];
	aliases: StoredMergeAlias[];
	relations: RewrittenContactRelation[];
} {
	try {
		const parsed: unknown = JSON.parse(text);
		if (Array.isArray(parsed)) {
			return {
				affiliations: [],
				aliases: [],
				relations: parsed.flatMap(toRewrittenRelation),
			};
		}
		if (!parsed || typeof parsed !== "object") {
			return { affiliations: [], aliases: [], relations: [] };
		}
		const record = parsed as Record<string, unknown>;
		return {
			affiliations: Array.isArray(record.affiliations)
				? record.affiliations.filter(
						(id): id is string => typeof id === "string"
					)
				: [],
			aliases: Array.isArray(record.aliases)
				? record.aliases.filter(isStoredAlias)
				: [],
			relations: Array.isArray(record.relations)
				? record.relations.flatMap(toRewrittenRelation)
				: [],
		};
	} catch {
		return { affiliations: [], aliases: [], relations: [] };
	}
}

function toRewrittenRelation(value: unknown): RewrittenContactRelation[] {
	if (!value || typeof value !== "object") {
		return [];
	}
	const record = value as Record<string, unknown>;
	if (
		typeof record.id !== "string" ||
		typeof record.originalFromId !== "string" ||
		typeof record.originalToId !== "string" ||
		typeof record.rewrittenFromId !== "string" ||
		typeof record.rewrittenToId !== "string" ||
		typeof record.type !== "string"
	) {
		return [];
	}
	return [
		{
			fromKind:
				typeof record.fromKind === "string" ? record.fromKind : CONTACT_KIND,
			id: record.id,
			originalFromId: record.originalFromId,
			originalToId: record.originalToId,
			rewrittenFromId: record.rewrittenFromId,
			rewrittenToId: record.rewrittenToId,
			toKind: typeof record.toKind === "string" ? record.toKind : DOCUMENT_KIND,
			type: record.type,
		},
	];
}

function isStoredAlias(value: unknown): value is StoredMergeAlias {
	if (!value || typeof value !== "object") {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		typeof record.normalizedEmail === "string" &&
		typeof record.originalEmail === "string" &&
		typeof record.shared === "boolean"
	);
}

function otherRelationEnd(
	relation: RewrittenContactRelation,
	survivorId: string,
	retiredId: string
): { id: string; kind: string } {
	if (relation.originalFromId === retiredId) {
		return {
			id: relation.originalToId,
			kind: relation.toKind,
		};
	}
	if (relation.originalToId === retiredId) {
		return {
			id: relation.originalFromId,
			kind: relation.fromKind,
		};
	}
	if (relation.rewrittenFromId === survivorId) {
		return {
			id: relation.rewrittenToId,
			kind: relation.toKind,
		};
	}
	return {
		id: relation.rewrittenFromId,
		kind: relation.fromKind,
	};
}

async function recordStillExists(
	db: PrismaClient | PrismaTransaction,
	kind: string,
	id: string
): Promise<boolean> {
	if (kind === DOCUMENT_KIND) {
		const row = await db.document.findFirst({
			select: { id: true },
			where: { id },
		});
		return Boolean(row);
	}
	if (kind === FEEDBACK_KIND) {
		const row = await db.feedback.findFirst({
			select: { id: true },
			where: { id },
		});
		return Boolean(row);
	}
	if (kind === COMPANY_KIND) {
		const row = await db.company.findFirst({
			select: { id: true },
			where: { id },
		});
		return Boolean(row);
	}
	if (kind === CONTACT_KIND) {
		const row = await db.contact.findFirst({
			select: { id: true },
			where: { id },
		});
		return Boolean(row);
	}
	return true;
}

async function collectUnrestorable(
	db: PrismaClient | PrismaTransaction,
	survivorId: string,
	bundle: {
		aliases: StoredMergeAlias[];
		relations: RewrittenContactRelation[];
	},
	retiredId: string
): Promise<ContactMergeUndoPreview["unrestorable"]> {
	const unrestorable: ContactMergeUndoPreview["unrestorable"] = [];
	const survivorAliases = await db.contactEmailAlias.findMany({
		where: { contactId: survivorId },
	});
	const aliasByNormalized = new Map(
		survivorAliases.map((alias) => [alias.normalizedEmail, alias])
	);
	for (const alias of bundle.aliases) {
		const live = aliasByNormalized.get(alias.normalizedEmail);
		if (!live) {
			unrestorable.push({
				id: alias.normalizedEmail,
				kind: CONTACT_AND_COMPANY_COPY.emailAliases,
				reason: RELATIONS_COPY.permanentlyDeleted,
			});
			continue;
		}
		if (live.originalEmail.length === 0) {
			unrestorable.push({
				id: alias.normalizedEmail,
				kind: CONTACT_AND_COMPANY_COPY.emailAliases,
				reason: RELATIONS_COPY.redactedForSecurity,
			});
		}
	}
	const missingEnds = await Promise.all(
		bundle.relations.map(async (relation) => {
			const other = otherRelationEnd(relation, survivorId, retiredId);
			if (await recordStillExists(db, other.kind, other.id)) {
				return null;
			}
			return {
				id: other.id,
				kind: other.kind,
				reason: RELATIONS_COPY.permanentlyDeleted,
			} as const;
		})
	);
	for (const item of missingEnds) {
		if (item) {
			unrestorable.push(item);
		}
	}
	return unrestorable;
}

function hasLaterAttributedWrite(
	survivor: ContactView,
	attributed: Partial<Record<ContactMergeField, string>>,
	postMerge: ContactFieldSnapshot
): boolean {
	if (
		attributed.displayName !== undefined &&
		(survivor.displayName ?? "") !== (postMerge.displayName ?? "")
	) {
		return true;
	}
	if (
		attributed.currentCompany !== undefined &&
		(survivor.currentCompany?.id ?? "") !== (postMerge.currentCompanyId ?? "")
	) {
		return true;
	}
	return false;
}

async function buildUndoPreview(
	db: PrismaClient | PrismaTransaction,
	mergeEventId: string,
	survivorId: string,
	workspaceId: string
): Promise<
	| { preview: ContactMergeUndoPreview; status: "ok" }
	| { reason: "target-not-found" | "retired-identity"; status: "rejected" }
> {
	const survivorRow = await db.contact.findFirst({
		where: { id: survivorId, workspaceId },
	});
	if (!survivorRow) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (survivorRow.retiredIntoId) {
		return { reason: "retired-identity", status: "rejected" };
	}
	const event = await db.contactMergeEvent.findUnique({
		where: { id: mergeEventId },
	});
	if (!event || event.survivorId !== survivorId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const retired = parseRetiredSnapshot(event.retiredSnapshot);
	if (!retired) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const bundle = parseMovedBundle(event.movedRelations);
	const unrestorable = await collectUnrestorable(
		db,
		survivorId,
		bundle,
		event.retiredId
	);
	return {
		preview: {
			completeRestore: unrestorable.length === 0,
			copy: contactMergeUndoPreviewCopy(),
			emailAliasesToSplit: bundle.aliases.map((alias) => ({
				normalizedEmail: alias.normalizedEmail,
				originalEmail: alias.originalEmail,
			})),
			relationsToSplit: bundle.relations.map((relation) => ({
				fromId: relation.originalFromId,
				fromKind: relation.fromKind,
				rewrittenFromId: relation.rewrittenFromId,
				rewrittenToId: relation.rewrittenToId,
				toId: relation.originalToId,
				toKind: relation.toKind,
				type: relation.type,
			})),
			retiredContact: {
				displayName: retired.displayName,
				id: retired.id,
			},
			unrestorable,
		},
		status: "ok",
	};
}

async function replayUndoOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<ContactUndoMergeOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedContact(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { contact: stored, status: "replayed" };
}

async function undoMergeInTransaction(
	tx: PrismaTransaction,
	command: UndoMergeContactsCommand,
	commandKey: string,
	fingerprint: string
): Promise<ContactUndoMergeOutcome> {
	const survivorRow = await tx.contact.findFirst({
		where: { id: command.survivorId, workspaceId: command.workspaceId },
	});
	if (!survivorRow) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (survivorRow.retiredIntoId) {
		return { reason: "retired-identity", status: "rejected" };
	}
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayUndoOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	if (survivorRow.revision !== command.survivorBaseRevision) {
		return {
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	if (command.previewAcknowledged !== true) {
		return { reason: "merge-preview-required", status: "rejected" };
	}
	const event = await tx.contactMergeEvent.findUnique({
		where: { id: command.mergeEventId },
	});
	if (!event || event.survivorId !== survivorRow.id) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const survivor = await getContact(tx, survivorRow.id, command.workspaceId);
	if (!survivor) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const attributed = parseAttributedFields(event.attributedFields);
	const postMerge = parseFieldSnapshot(event.postMergeSurvivor);
	if (hasLaterAttributedWrite(survivor, attributed, postMerge)) {
		return {
			conflict: MUTATION_COPY.conflict,
			current: survivor,
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "conflict",
		};
	}
	const retired = parseRetiredSnapshot(event.retiredSnapshot);
	if (!retired) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const previous = parseFieldSnapshot(event.previousSurvivor);
	const bundle = parseMovedBundle(event.movedRelations);
	await restoreMovedRelations(
		tx,
		bundle.relations,
		survivor.id,
		event.retiredId
	);
	await restoreMovedAliases(tx, survivor.id, event.retiredId, bundle.aliases);
	await restoreMovedAffiliations(tx, event.retiredId, bundle.affiliations);
	const survivorCompanyId =
		attributed.currentCompany === undefined
			? (survivor.currentCompany?.id ?? null)
			: previous.currentCompanyId;
	const survivorDisplayName =
		attributed.displayName === undefined
			? (survivor.displayName ?? "")
			: (previous.displayName ?? "");
	await applyCurrentCompany(tx, survivor.id, survivorCompanyId);
	await applyCurrentCompany(tx, event.retiredId, retired.currentCompanyId);
	await tx.contact.update({
		data: {
			displayName: survivorDisplayName,
			revision: survivor.revision + 1,
		},
		where: { id: survivor.id },
	});
	await tx.contact.update({
		data: {
			displayName: retired.displayName ?? "",
			retiredIntoId: null,
			revision: { increment: 1 },
		},
		where: { id: event.retiredId },
	});
	await tx.contactMergeEvent.delete({ where: { id: event.id } });
	const contact = await getContact(tx, survivor.id, command.workspaceId);
	if (!contact) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const occurredAt = new Date();
	const audit = contactMergeUndoAudit({
		actorId: command.actorId,
		occurredAt,
		retiredId: event.retiredId,
		survivorId: survivor.id,
	});
	await tx.auditEvent.create({
		data: {
			accountAlias: audit.survivorAlias,
			actorAlias: audit.actorAlias,
			id: crypto.randomUUID(),
			occurredAt,
			sessionAlias: audit.retiredAlias,
			type: CONTACT_MERGE_UNDO_EVENT_TYPE,
		},
	});
	await writeContactReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		contact,
		fingerprint,
	});
	return {
		audit,
		contact,
		restoredContactId: event.retiredId,
		status: "committed",
	};
}

async function restoreMovedRelations(
	tx: PrismaTransaction,
	moved: RewrittenContactRelation[],
	survivorId: string,
	retiredId: string
): Promise<void> {
	if (moved.length === 0) {
		return;
	}
	const existing = await tx.typedRelation.findMany({
		where: { id: { in: moved.map((relation) => relation.id) } },
	});
	const existingIds = new Set(existing.map((row) => row.id));
	await Promise.all(
		moved.map(async (relation) => {
			if (relation.type === RELATIONS_COPY.belongsToCompany) {
				return;
			}
			const other = otherRelationEnd(relation, survivorId, retiredId);
			if (!(await recordStillExists(tx, other.kind, other.id))) {
				if (existingIds.has(relation.id)) {
					await tx.typedRelation.delete({ where: { id: relation.id } });
				}
				return;
			}
			if (existingIds.has(relation.id)) {
				await tx.typedRelation.update({
					data: {
						fromId: relation.originalFromId,
						toId: relation.originalToId,
					},
					where: { id: relation.id },
				});
				return;
			}
			if (relation.fromKind && relation.toKind) {
				await tx.typedRelation.create({
					data: {
						fromId: relation.originalFromId,
						fromKind: relation.fromKind,
						id: relation.id,
						revision: 1,
						toId: relation.originalToId,
						toKind: relation.toKind,
						type: relation.type,
					},
				});
			}
		})
	);
}

async function restoreMovedAliases(
	tx: PrismaTransaction,
	survivorId: string,
	retiredId: string,
	aliases: StoredMergeAlias[]
): Promise<void> {
	const liveAliases = await tx.contactEmailAlias.findMany({
		where: { contactId: survivorId },
	});
	const liveByNormalized = new Map(
		liveAliases.map((alias) => [alias.normalizedEmail, alias])
	);
	const toCreate: StoredMergeAlias[] = [];
	const toDelete: string[] = [];
	for (const alias of aliases) {
		const live = liveByNormalized.get(alias.normalizedEmail);
		if (!live || live.originalEmail.length === 0) {
			continue;
		}
		toCreate.push({
			normalizedEmail: alias.normalizedEmail,
			originalEmail: live.originalEmail,
			shared: alias.shared,
		});
		if (!alias.shared) {
			toDelete.push(live.id);
		}
	}
	if (toCreate.length > 0) {
		await tx.contactEmailAlias.createMany({
			data: toCreate.map((alias) => ({
				contactId: retiredId,
				id: crypto.randomUUID(),
				normalizedEmail: alias.normalizedEmail,
				originalEmail: alias.originalEmail,
			})),
		});
	}
	if (toDelete.length > 0) {
		await tx.contactEmailAlias.deleteMany({
			where: { id: { in: toDelete } },
		});
	}
}

async function restoreMovedAffiliations(
	tx: PrismaTransaction,
	retiredId: string,
	affiliationIds: string[]
): Promise<void> {
	if (affiliationIds.length === 0) {
		return;
	}
	await tx.contactCompanyAffiliation.updateMany({
		data: { contactId: retiredId },
		where: { id: { in: affiliationIds } },
	});
}

async function applyCurrentCompany(
	tx: PrismaTransaction,
	contactId: string,
	companyId: string | null
): Promise<void> {
	const currents = await tx.contactCompanyAffiliation.findMany({
		where: { contactId, endedAt: null },
	});
	const now = new Date();
	let kept = false;
	const endIds: string[] = [];
	for (const row of currents) {
		if (companyId && row.companyId === companyId && !kept) {
			kept = true;
			continue;
		}
		endIds.push(row.id);
	}
	if (endIds.length > 0) {
		await tx.contactCompanyAffiliation.updateMany({
			data: { endedAt: now },
			where: { id: { in: endIds } },
		});
	}
	await tx.typedRelation.deleteMany({
		where: {
			fromId: contactId,
			fromKind: CONTACT_KIND,
			type: RELATIONS_COPY.belongsToCompany,
		},
	});
	if (companyId && kept) {
		await tx.typedRelation.create({
			data: {
				fromId: contactId,
				fromKind: CONTACT_KIND,
				id: crypto.randomUUID(),
				revision: 1,
				toId: companyId,
				toKind: COMPANY_KIND,
				type: RELATIONS_COPY.belongsToCompany,
			},
		});
		return;
	}
	if (companyId && !kept) {
		const company = await tx.company.findFirst({ where: { id: companyId } });
		if (!company) {
			return;
		}
		await tx.contactCompanyAffiliation.create({
			data: {
				companyId,
				contactId,
				id: crypto.randomUUID(),
				startedAt: now,
			},
		});
		await tx.typedRelation.create({
			data: {
				fromId: contactId,
				fromKind: CONTACT_KIND,
				id: crypto.randomUUID(),
				revision: 1,
				toId: companyId,
				toKind: COMPANY_KIND,
				type: RELATIONS_COPY.belongsToCompany,
			},
		});
	}
}
