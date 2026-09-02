import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { getProject } from "../../project-shell/server/project-shell";
import {
	documentsWouldCycle,
	ensureSectionIds,
	stripSectionIds,
	syncDocumentUsageLinks,
	usageTargetsFromBody,
} from "./documents-live";
import {
	applyDocumentTemplatePlaceholders,
	type ConvertDocumentToTemplatePreviewOutcome,
	type CreateDocumentCommand,
	type CreateDocumentTemplateCommand,
	convertDocumentToTemplateCommandSchema,
	createDocumentCommandSchema,
	createDocumentTemplateCommandSchema,
	DOCUMENT_SCOPE_KIND,
	type DocumentLiveFiles,
	type DocumentScope,
	type DocumentTemplateView,
	type DocumentTemplateWriteOutcome,
	type DocumentType,
	type DocumentVersionCompare,
	type DocumentVersionView,
	type DocumentView,
	type DocumentWriteOutcome,
	documentTemplatePlaceholders,
	FORBIDDEN_DOCUMENT_TEMPLATE_PAYLOAD_KEYS,
	type InstantiateDocumentFromTemplateCommand,
	instantiateDocumentFromTemplateCommandSchema,
	isDocumentType,
	PERSONAL_REVIEW_KIND,
	personalReviewSkeleton,
	presentDocumentVersionDiff,
	type RestoreDocumentCommand,
	restoreDocumentCommandSchema,
	type UpdateDocumentCommand,
	type UpdateDocumentTemplateCommand,
	updateDocumentCommandSchema,
	updateDocumentTemplateCommandSchema,
} from "./documents-model";

type PrismaTransaction = Prisma.TransactionClient;

interface DocumentRow {
	body: string;
	id: string;
	projectId: string | null;
	revision: number;
	scopeKind: string;
	title: string;
	type: string;
	workspaceId: string;
}

interface DocumentTemplateRow {
	documentType: string;
	id: string;
	name: string;
	projectId: string | null;
	revision: number;
	scopeKind: string;
	skeleton: string;
	workspaceId: string;
}

export interface DocumentWriteDeps {
	files?: DocumentLiveFiles;
}

export async function createDocument(
	prisma: PrismaClient,
	command: unknown,
	_deps: DocumentWriteDeps = {}
): Promise<DocumentWriteOutcome> {
	const parsed = createDocumentCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const title = parsed.data.payload.title?.trim() ?? "";
	if (title.length === 0) {
		return { reason: "title-required", status: "rejected" };
	}
	const type = parsed.data.payload.type ?? "General";
	if (!isDocumentType(type)) {
		return { reason: "unknown-document-type", status: "rejected" };
	}
	if (parsed.data.payload.scope.kind === DOCUMENT_SCOPE_KIND.project) {
		const project = await getProject(
			prisma,
			parsed.data.payload.scope.projectId
		);
		if (!project || project.workspaceId !== parsed.data.workspaceId) {
			return { reason: "project-not-found", status: "rejected" };
		}
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		createInTransaction(tx, parsed.data, commandKey, fingerprint, type, title)
	);
}

export async function updateDocument(
	prisma: PrismaClient,
	command: unknown,
	_deps: DocumentWriteDeps = {}
): Promise<DocumentWriteOutcome> {
	const parsed = updateDocumentCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (
		parsed.data.payload.type !== undefined &&
		!isDocumentType(parsed.data.payload.type)
	) {
		return { reason: "unknown-document-type", status: "rejected" };
	}
	if (
		parsed.data.payload.title !== undefined &&
		parsed.data.payload.title.trim().length === 0
	) {
		return { reason: "title-required", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		updateInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function getDocument(
	prisma: PrismaClient,
	documentId: string,
	workspaceId?: string
): Promise<DocumentView | null> {
	if (
		!("document" in prisma) ||
		typeof prisma.document?.findUnique !== "function"
	) {
		return null;
	}
	const row = await prisma.document.findUnique({
		where: { id: documentId },
	});
	if (!row) {
		return null;
	}
	if (workspaceId && row.workspaceId !== workspaceId) {
		return null;
	}
	return toView(row);
}

export async function listDocuments(
	prisma: PrismaClient,
	input: { scope: DocumentScope; workspaceId: string }
): Promise<DocumentView[]> {
	if (
		!("document" in prisma) ||
		typeof prisma.document?.findMany !== "function"
	) {
		return [];
	}
	const rows = await prisma.document.findMany({
		orderBy: { createdAt: "asc" },
		where:
			input.scope.kind === DOCUMENT_SCOPE_KIND.project
				? {
						projectId: input.scope.projectId,
						scopeKind: DOCUMENT_SCOPE_KIND.project,
						workspaceId: input.workspaceId,
					}
				: {
						projectId: null,
						scopeKind: DOCUMENT_SCOPE_KIND.personalWiki,
						workspaceId: input.workspaceId,
					},
	});
	return rows.map(toView);
}

export async function createDocumentTemplate(
	prisma: PrismaClient,
	command: unknown
): Promise<DocumentTemplateWriteOutcome> {
	const parsed = createDocumentTemplateCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const forbidden = forbiddenTemplateReason(parsed.data.payload);
	if (forbidden) {
		return { reason: forbidden, status: "rejected" };
	}
	const name = parsed.data.payload.name?.trim() ?? "";
	if (name.length === 0) {
		return { reason: "name-required", status: "rejected" };
	}
	const documentType = parsed.data.payload.documentType ?? "General";
	if (!isDocumentType(documentType)) {
		return { reason: "unknown-document-type", status: "rejected" };
	}
	const scoped = await requireTemplateScope(
		prisma,
		parsed.data.workspaceId,
		parsed.data.payload.scope
	);
	if (scoped) {
		return scoped;
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		createTemplateInTransaction(
			tx,
			parsed.data,
			commandKey,
			fingerprint,
			documentType,
			name,
			parsed.data.payload.skeleton ?? ""
		)
	);
}

export async function updateDocumentTemplate(
	prisma: PrismaClient,
	command: unknown
): Promise<DocumentTemplateWriteOutcome> {
	const parsed = updateDocumentTemplateCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const forbidden = forbiddenTemplateReason(parsed.data.payload);
	if (forbidden) {
		return { reason: forbidden, status: "rejected" };
	}
	if (
		parsed.data.payload.documentType !== undefined &&
		!isDocumentType(parsed.data.payload.documentType)
	) {
		return { reason: "unknown-document-type", status: "rejected" };
	}
	if (
		parsed.data.payload.name !== undefined &&
		parsed.data.payload.name.trim().length === 0
	) {
		return { reason: "name-required", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		updateTemplateInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function previewConvertDocumentToTemplate(
	prisma: PrismaClient,
	documentId: string,
	workspaceId: string
): Promise<ConvertDocumentToTemplatePreviewOutcome> {
	const document = await getDocument(prisma, documentId, workspaceId);
	if (!document) {
		return { reason: "document-not-found", status: "rejected" };
	}
	return {
		preview: {
			name: document.title,
			placeholders: documentTemplatePlaceholders(document.body),
			skeleton: stripSectionIds(document.body),
			sourceDocumentId: document.id,
			sourceRevision: document.revision,
			sourceTitle: document.title,
		},
		status: "ok",
	};
}

export async function convertDocumentToTemplate(
	prisma: PrismaClient,
	command: unknown
): Promise<DocumentTemplateWriteOutcome> {
	const parsed = convertDocumentToTemplateCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const forbidden = forbiddenTemplateReason(parsed.data.payload);
	if (forbidden) {
		return { reason: forbidden, status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction(async (tx) => {
		await lockWorkspace(tx, parsed.data.workspaceId);
		const replayed = await replayTemplateOrConflict(
			tx,
			commandKey,
			fingerprint
		);
		if (replayed) {
			return replayed;
		}
		const current = await tx.document.findUnique({
			where: { id: parsed.data.payload.documentId },
		});
		if (!current || current.workspaceId !== parsed.data.workspaceId) {
			return { reason: "document-not-found", status: "rejected" };
		}
		if (!isDocumentType(current.type)) {
			return { reason: "unknown-document-type", status: "rejected" };
		}
		const name = parsed.data.payload.name?.trim() || current.title;
		const created = await tx.documentTemplate.create({
			data: {
				documentType: current.type,
				id: crypto.randomUUID(),
				name,
				projectId: current.projectId,
				revision: 1,
				scopeKind: current.scopeKind,
				skeleton: stripSectionIds(current.body),
				workspaceId: current.workspaceId,
			},
		});
		const view = toTemplateView(created);
		await writeTemplateReceipt(tx, {
			actorId: parsed.data.actorId,
			commandKey,
			fingerprint,
			view,
		});
		return { status: "committed", template: view };
	});
}

export async function instantiateDocumentFromTemplate(
	prisma: PrismaClient,
	command: unknown
): Promise<DocumentWriteOutcome> {
	const parsed =
		instantiateDocumentFromTemplateCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const forbidden = forbiddenTemplateReason(parsed.data.payload);
	if (forbidden) {
		return { reason: forbidden, status: "rejected" };
	}
	const title = parsed.data.payload.title?.trim() ?? "";
	if (title.length === 0) {
		return { reason: "title-required", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction(async (tx) => {
		await lockWorkspace(tx, parsed.data.workspaceId);
		const replayed = await replayOrConflict(tx, commandKey, fingerprint);
		if (replayed) {
			return replayed;
		}
		const resolved = await resolveInstantiateSource(tx, parsed.data);
		if ("reason" in resolved) {
			return resolved;
		}
		const body = ensureSectionIds(resolved.body);
		const documentId = crypto.randomUUID();
		if (await documentsWouldCycle(tx, documentId, body)) {
			return { reason: "live-section-cycle", status: "rejected" };
		}
		const created = await tx.document.create({
			data: {
				body,
				id: documentId,
				projectId:
					resolved.scope.kind === DOCUMENT_SCOPE_KIND.project
						? resolved.scope.projectId
						: null,
				revision: 1,
				scopeKind: resolved.scope.kind,
				title,
				type: resolved.documentType,
				workspaceId: parsed.data.workspaceId,
			},
		});
		await recordVersion(tx, created);
		await syncDocumentUsageLinks(tx, {
			hostRecordId: created.id,
			targets: usageTargetsFromBody(created.body),
			workspaceId: parsed.data.workspaceId,
		});
		const view = toView(created);
		await writeReceipt(tx, {
			actorId: parsed.data.actorId,
			commandKey,
			fingerprint,
			view,
		});
		return { document: view, status: "committed" };
	});
}

export async function listDocumentTemplates(
	prisma: PrismaClient,
	input: { scope: DocumentScope; workspaceId: string }
): Promise<DocumentTemplateView[]> {
	if (
		!("documentTemplate" in prisma) ||
		typeof prisma.documentTemplate?.findMany !== "function"
	) {
		return [];
	}
	const rows = await prisma.documentTemplate.findMany({
		orderBy: { createdAt: "asc" },
		where:
			input.scope.kind === DOCUMENT_SCOPE_KIND.project
				? {
						projectId: input.scope.projectId,
						scopeKind: DOCUMENT_SCOPE_KIND.project,
						workspaceId: input.workspaceId,
					}
				: {
						projectId: null,
						scopeKind: DOCUMENT_SCOPE_KIND.personalWiki,
						workspaceId: input.workspaceId,
					},
	});
	return rows.map(toTemplateView);
}

export async function getDocumentTemplate(
	prisma: PrismaClient,
	templateId: string,
	workspaceId?: string
): Promise<DocumentTemplateView | null> {
	if (
		!("documentTemplate" in prisma) ||
		typeof prisma.documentTemplate?.findUnique !== "function"
	) {
		return null;
	}
	const row = await prisma.documentTemplate.findUnique({
		where: { id: templateId },
	});
	if (!row) {
		return null;
	}
	if (workspaceId && row.workspaceId !== workspaceId) {
		return null;
	}
	return toTemplateView(row);
}

export async function listDocumentVersions(
	prisma: PrismaClient,
	input: { documentId: string; workspaceId?: string }
): Promise<DocumentVersionView[] | null> {
	const document = await getDocument(
		prisma,
		input.documentId,
		input.workspaceId
	);
	if (!document) {
		return null;
	}
	if (
		!("documentVersion" in prisma) ||
		typeof prisma.documentVersion?.findMany !== "function"
	) {
		return [];
	}
	const rows = await prisma.documentVersion.findMany({
		orderBy: { revision: "asc" },
		where: { documentId: input.documentId },
	});
	return rows.map(toVersionView);
}

export async function compareDocumentVersions(
	prisma: PrismaClient,
	input: {
		documentId: string;
		leftRevision: number;
		rightRevision: number;
		workspaceId?: string;
	}
): Promise<DocumentVersionCompare | null> {
	const versions = await listDocumentVersions(prisma, {
		documentId: input.documentId,
		workspaceId: input.workspaceId,
	});
	if (!versions) {
		return null;
	}
	const left = versions.find(
		(version) => version.revision === input.leftRevision
	);
	const right = versions.find(
		(version) => version.revision === input.rightRevision
	);
	if (!(left && right)) {
		return null;
	}
	return {
		hunks: presentDocumentVersionDiff(left.body, right.body),
		left,
		right,
	};
}

export async function restoreDocumentVersion(
	prisma: PrismaClient,
	command: unknown,
	_deps: DocumentWriteDeps = {}
): Promise<DocumentWriteOutcome> {
	const parsed = restoreDocumentCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		restoreInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateDocumentCommand,
	commandKey: string,
	fingerprint: string,
	type: DocumentType,
	title: string
): Promise<DocumentWriteOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const body = ensureSectionIds(command.payload.body ?? "");
	const documentId = crypto.randomUUID();
	if (await documentsWouldCycle(tx, documentId, body)) {
		return { reason: "live-section-cycle", status: "rejected" };
	}
	const created = await tx.document.create({
		data: {
			body,
			id: documentId,
			projectId:
				command.payload.scope.kind === DOCUMENT_SCOPE_KIND.project
					? command.payload.scope.projectId
					: null,
			revision: 1,
			scopeKind: command.payload.scope.kind,
			title,
			type,
			workspaceId: command.workspaceId,
		},
	});
	await recordVersion(tx, created);
	await syncDocumentUsageLinks(tx, {
		hostRecordId: created.id,
		targets: usageTargetsFromBody(created.body),
		workspaceId: command.workspaceId,
	});
	const view = toView(created);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { document: view, status: "committed" };
}

async function updateInTransaction(
	tx: PrismaTransaction,
	command: UpdateDocumentCommand,
	commandKey: string,
	fingerprint: string
): Promise<DocumentWriteOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const current = await tx.document.findUnique({
		where: { id: command.payload.documentId },
	});
	if (!current || current.workspaceId !== command.workspaceId) {
		return { reason: "document-not-found", status: "rejected" };
	}
	if (current.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const { nextBody, nextTitle, nextType } = nextDocumentFields(
		command,
		current
	);
	if (
		command.payload.body !== undefined &&
		(await documentsWouldCycle(tx, current.id, nextBody))
	) {
		return { reason: "live-section-cycle", status: "rejected" };
	}
	const updated = await tx.document.update({
		data: {
			body: nextBody,
			revision: current.revision + 1,
			title: nextTitle,
			type: nextType,
		},
		where: { id: current.id },
	});
	await recordVersion(tx, updated);
	await syncDocumentUsageLinks(tx, {
		hostRecordId: updated.id,
		targets: usageTargetsFromBody(updated.body),
		workspaceId: command.workspaceId,
	});
	const view = toView(updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { document: view, status: "committed" };
}

function nextDocumentFields(
	command: UpdateDocumentCommand,
	current: DocumentRow
): { nextBody: string; nextTitle: string; nextType: string } {
	return {
		nextBody:
			command.payload.body === undefined
				? current.body
				: ensureSectionIds(command.payload.body),
		nextTitle:
			command.payload.title === undefined
				? current.title
				: command.payload.title.trim(),
		nextType: command.payload.type ?? current.type,
	};
}

async function restoreInTransaction(
	tx: PrismaTransaction,
	command: RestoreDocumentCommand,
	commandKey: string,
	fingerprint: string
): Promise<DocumentWriteOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const current = await tx.document.findUnique({
		where: { id: command.payload.documentId },
	});
	if (!current || current.workspaceId !== command.workspaceId) {
		return { reason: "document-not-found", status: "rejected" };
	}
	if (current.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const source = await tx.documentVersion.findUnique({
		where: {
			documentId_revision: {
				documentId: current.id,
				revision: command.payload.versionRevision,
			},
		},
	});
	if (!source) {
		return { reason: "version-not-found", status: "rejected" };
	}
	const restored = await tx.document.update({
		data: {
			body: source.body,
			revision: current.revision + 1,
			title: source.title,
			type: source.type,
		},
		where: { id: current.id },
	});
	await recordVersion(tx, restored);
	await syncDocumentUsageLinks(tx, {
		hostRecordId: restored.id,
		targets: usageTargetsFromBody(restored.body),
		workspaceId: command.workspaceId,
	});
	const view = toView(restored);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { document: view, status: "committed" };
}

async function recordVersion(
	tx: PrismaTransaction,
	row: DocumentRow
): Promise<void> {
	await tx.documentVersion.create({
		data: {
			body: row.body,
			documentId: row.id,
			id: crypto.randomUUID(),
			revision: row.revision,
			title: row.title,
			type: row.type,
		},
	});
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<DocumentWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.document.findUnique({
		where: { id: existing.targetId },
	});
	if (live) {
		return { document: toView(live), status: "replayed" };
	}
	return { conflict: MUTATION_COPY.conflict, status: "conflict" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		view: DocumentView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.view.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.view),
			targetId: input.view.id,
		},
	});
}

async function lockWorkspace(
	tx: PrismaTransaction,
	workspaceId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`documents:workspace:${workspaceId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

function forbiddenTemplateReason(payload: object): "forbidden-payload" | null {
	for (const key of FORBIDDEN_DOCUMENT_TEMPLATE_PAYLOAD_KEYS) {
		if (key in payload) {
			return "forbidden-payload";
		}
	}
	return null;
}

async function requireTemplateScope(
	prisma: PrismaClient,
	workspaceId: string,
	scope: DocumentScope
): Promise<DocumentTemplateWriteOutcome | null> {
	if (scope.kind !== DOCUMENT_SCOPE_KIND.project) {
		return null;
	}
	const project = await getProject(prisma, scope.projectId);
	if (!project || project.workspaceId !== workspaceId) {
		return { reason: "project-not-found", status: "rejected" };
	}
	return null;
}

async function createTemplateInTransaction(
	tx: PrismaTransaction,
	command: CreateDocumentTemplateCommand,
	commandKey: string,
	fingerprint: string,
	documentType: DocumentType,
	name: string,
	skeleton: string
): Promise<DocumentTemplateWriteOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayTemplateOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const created = await tx.documentTemplate.create({
		data: {
			documentType,
			id: crypto.randomUUID(),
			name,
			projectId:
				command.payload.scope.kind === DOCUMENT_SCOPE_KIND.project
					? command.payload.scope.projectId
					: null,
			revision: 1,
			scopeKind: command.payload.scope.kind,
			skeleton,
			workspaceId: command.workspaceId,
		},
	});
	const view = toTemplateView(created);
	await writeTemplateReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { status: "committed", template: view };
}

async function updateTemplateInTransaction(
	tx: PrismaTransaction,
	command: UpdateDocumentTemplateCommand,
	commandKey: string,
	fingerprint: string
): Promise<DocumentTemplateWriteOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayTemplateOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const current = await tx.documentTemplate.findUnique({
		where: { id: command.payload.templateId },
	});
	if (!current || current.workspaceId !== command.workspaceId) {
		return { reason: "template-not-found", status: "rejected" };
	}
	if (current.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const nextName =
		command.payload.name === undefined
			? current.name
			: command.payload.name.trim();
	const nextType = command.payload.documentType ?? current.documentType;
	const nextSkeleton = command.payload.skeleton ?? current.skeleton;
	const updated = await tx.documentTemplate.update({
		data: {
			documentType: nextType,
			name: nextName,
			revision: current.revision + 1,
			skeleton: nextSkeleton,
		},
		where: { id: current.id },
	});
	const view = toTemplateView(updated);
	await writeTemplateReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { status: "committed", template: view };
}

async function resolveInstantiateSource(
	tx: PrismaTransaction,
	command: InstantiateDocumentFromTemplateCommand
): Promise<
	| {
			body: string;
			documentType: DocumentType;
			scope: DocumentScope;
	  }
	| {
			reason:
				| "invalid-command"
				| "template-not-found"
				| "project-not-found"
				| "unknown-document-type";
			status: "rejected";
	  }
> {
	if (command.payload.preparedKind === PERSONAL_REVIEW_KIND) {
		return await resolvePersonalReviewSource(tx, command);
	}
	return await resolveStoredTemplateSource(tx, command);
}

async function resolvePersonalReviewSource(
	tx: PrismaTransaction,
	command: InstantiateDocumentFromTemplateCommand
): Promise<
	| {
			body: string;
			documentType: DocumentType;
			scope: DocumentScope;
	  }
	| {
			reason: "invalid-command" | "project-not-found";
			status: "rejected";
	  }
> {
	const values = command.payload.placeholderValues ?? {};
	if (command.payload.templateId || !command.payload.scope) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (command.payload.scope.kind === DOCUMENT_SCOPE_KIND.project) {
		const project = await tx.project.findUnique({
			where: { id: command.payload.scope.projectId },
		});
		if (!project || project.workspaceId !== command.workspaceId) {
			return { reason: "project-not-found", status: "rejected" };
		}
	}
	return {
		body: applyDocumentTemplatePlaceholders(personalReviewSkeleton(), values),
		documentType: "General",
		scope: command.payload.scope,
	};
}

async function resolveStoredTemplateSource(
	tx: PrismaTransaction,
	command: InstantiateDocumentFromTemplateCommand
): Promise<
	| {
			body: string;
			documentType: DocumentType;
			scope: DocumentScope;
	  }
	| {
			reason:
				| "invalid-command"
				| "template-not-found"
				| "unknown-document-type";
			status: "rejected";
	  }
> {
	const values = command.payload.placeholderValues ?? {};
	const { preparedKind, templateId } = command.payload;
	if (!templateId || preparedKind) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const row = await tx.documentTemplate.findUnique({
		where: { id: templateId },
	});
	if (!row || row.workspaceId !== command.workspaceId) {
		return { reason: "template-not-found", status: "rejected" };
	}
	if (!isDocumentType(row.documentType)) {
		return { reason: "unknown-document-type", status: "rejected" };
	}
	return {
		body: applyDocumentTemplatePlaceholders(row.skeleton, values),
		documentType: row.documentType,
		scope: scopeFromRow(row),
	};
}

async function replayTemplateOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<DocumentTemplateWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.documentTemplate.findUnique({
		where: { id: existing.targetId },
	});
	if (live) {
		return { status: "replayed", template: toTemplateView(live) };
	}
	return { conflict: MUTATION_COPY.conflict, status: "conflict" };
}

async function writeTemplateReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		view: DocumentTemplateView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.view.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.view),
			targetId: input.view.id,
		},
	});
}

function toTemplateView(row: DocumentTemplateRow): DocumentTemplateView {
	return {
		documentType: row.documentType as DocumentType,
		id: row.id,
		name: row.name,
		placeholders: documentTemplatePlaceholders(row.skeleton),
		revision: row.revision,
		scope: scopeFromRow(row),
		skeleton: row.skeleton,
	};
}

function scopeFromRow(row: {
	projectId: string | null;
	scopeKind: string;
}): DocumentScope {
	return row.scopeKind === DOCUMENT_SCOPE_KIND.project && row.projectId
		? { kind: DOCUMENT_SCOPE_KIND.project, projectId: row.projectId }
		: { kind: DOCUMENT_SCOPE_KIND.personalWiki };
}

function toView(row: DocumentRow): DocumentView {
	return {
		body: row.body,
		id: row.id,
		liveFilePath: null,
		revision: row.revision,
		scope: scopeFromRow(row),
		title: row.title,
		type: row.type as DocumentType,
	};
}

interface DocumentVersionRow {
	body: string;
	documentId: string;
	id: string;
	revision: number;
	title: string;
	type: string;
}

function toVersionView(row: DocumentVersionRow): DocumentVersionView {
	return {
		body: row.body,
		documentId: row.documentId,
		id: row.id,
		revision: row.revision,
		title: row.title,
		type: row.type as DocumentType,
	};
}
