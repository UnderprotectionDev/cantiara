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
	type CompanyView,
	type CompanyWriteOutcome,
	type ContactView,
	type ContactWriteOutcome,
	type CreateCompanyCommand,
	type CreateContactCommand,
	createCompanyCommandSchema,
	createContactCommandSchema,
	DOCUMENT_KIND,
	type DuplicateCandidate,
	type DuplicateCandidateReason,
	FEEDBACK_KIND,
	normalizeDisplayName,
	normalizeEmailAlias,
	optionalDisplayName,
	PERSONA_DOCUMENT_TYPE,
	type RelateContactPersonaCommand,
	relateContactPersonaCommandSchema,
	type SetContactCompanyCommand,
	type SourceLink,
	setContactCompanyCommandSchema,
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
		where: { workspaceId },
	});
	return await Promise.all(rows.map((row) => hydrateContact(prisma, row)));
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
	if (!contact) {
		return { reason: "target-not-found", status: "rejected" };
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
	if (!contact) {
		return { reason: "target-not-found", status: "rejected" };
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
	const relatedFeedback = related
		.filter(
			(edge) =>
				edge.type === RELATIONS_COPY.participant &&
				edge.fromKind === FEEDBACK_KIND &&
				edge.toKind === CONTACT_KIND
		)
		.map((edge) => toSourceLink(edge.fromId, FEEDBACK_KIND, ""));
	return {
		companyHistory: row.affiliations.map((item) => ({
			companyId: item.companyId,
			endedAt: item.endedAt ? item.endedAt.toISOString() : null,
			name: nameById.get(item.companyId) ?? "",
			startedAt: item.startedAt.toISOString(),
		})),
		copy: {
			belongsToCompany: CONTACT_AND_COMPANY_COPY.belongsToCompany,
			company: CONTACT_AND_COMPANY_COPY.company,
			contact: CONTACT_AND_COMPANY_COPY.contact,
			openSourceRecord: CONTACT_AND_COMPANY_COPY.openSourceRecord,
		},
		currentCompany,
		displayName: row.displayName.length > 0 ? row.displayName : null,
		emailAliases: row.emailAliases.map((alias) => ({
			normalizedEmail: alias.normalizedEmail,
			originalEmail: alias.originalEmail,
		})),
		id: row.id,
		relatedFeedback,
		relatedPersonaDocuments,
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
