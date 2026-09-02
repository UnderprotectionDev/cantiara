import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	isRecord,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { getProject } from "../../project-shell/server/project-shell";
import {
	type CreateDocumentCommand,
	createDocumentCommandSchema,
	DOCUMENT_SCOPE_KIND,
	DOCUMENT_STARTER_SKELETONS,
	type DocumentLiveFiles,
	type DocumentScope,
	type DocumentType,
	type DocumentView,
	type DocumentWriteOutcome,
	emptyHeadingDocumentBody,
	isDocumentType,
	type MaterializeStarterSkeletonDocumentsCommand,
	materializeStarterSkeletonDocumentsCommandSchema,
	type StarterSkeletonDocumentsOutcome,
	type UpdateDocumentCommand,
	updateDocumentCommandSchema,
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

export async function materializeStarterSkeletonDocuments(
	prisma: PrismaClient,
	command: unknown,
	_deps: DocumentWriteDeps = {}
): Promise<StarterSkeletonDocumentsOutcome> {
	const parsed =
		materializeStarterSkeletonDocumentsCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const project = await getProject(prisma, parsed.data.payload.projectId);
	if (!project || project.workspaceId !== parsed.data.workspaceId) {
		return { reason: "project-not-found", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	const selectedNames = new Set(
		project.selectedSkeletons
			.filter((skeleton) => skeleton.surface === "Document")
			.map((skeleton) => skeleton.name)
	);
	const skeletons = DOCUMENT_STARTER_SKELETONS.filter((skeleton) =>
		selectedNames.has(skeleton.name)
	);
	return await prisma.$transaction((tx) =>
		materializeInTransaction(
			tx,
			parsed.data,
			commandKey,
			fingerprint,
			skeletons
		)
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
	const body = command.payload.body ?? "";
	const created = await tx.document.create({
		data: {
			body,
			id: crypto.randomUUID(),
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
	const nextTitle =
		command.payload.title === undefined
			? current.title
			: command.payload.title.trim();
	const nextType = command.payload.type ?? current.type;
	const nextBody = command.payload.body ?? current.body;
	const updated = await tx.document.update({
		data: {
			body: nextBody,
			revision: current.revision + 1,
			title: nextTitle,
			type: nextType,
		},
		where: { id: current.id },
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

async function materializeInTransaction(
	tx: PrismaTransaction,
	command: MaterializeStarterSkeletonDocumentsCommand,
	commandKey: string,
	fingerprint: string,
	skeletons: readonly (typeof DOCUMENT_STARTER_SKELETONS)[number][]
): Promise<StarterSkeletonDocumentsOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replaySkeletonsOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const startedAt = Date.now();
	const created = await Promise.all(
		skeletons.map((skeleton, index) =>
			tx.document.create({
				data: {
					body: emptyHeadingDocumentBody(skeleton.emptyHeadings),
					createdAt: new Date(startedAt + index),
					id: crypto.randomUUID(),
					projectId: command.payload.projectId,
					revision: 1,
					scopeKind: DOCUMENT_SCOPE_KIND.project,
					title: skeleton.name,
					type: skeleton.type,
					workspaceId: command.workspaceId,
				},
			})
		)
	);
	const documents = created.map(toView);
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: documents[0]?.revision ?? 0,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(documents),
			targetId: documents[0]?.id ?? command.payload.projectId,
		},
	});
	return { documents, status: "committed" };
}

async function replaySkeletonsOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<StarterSkeletonDocumentsOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = JSON.parse(existing.resultValue) as unknown;
	if (!Array.isArray(stored)) {
		return { documents: [], status: "replayed" };
	}
	const ids = stored.flatMap((entry) =>
		isRecord(entry) && typeof entry.id === "string" ? [entry.id] : []
	);
	const rows = await Promise.all(
		ids.map((id) => tx.document.findUnique({ where: { id } }))
	);
	return {
		documents: rows.flatMap((row) => (row ? [toView(row)] : [])),
		status: "replayed",
	};
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

function toView(row: DocumentRow): DocumentView {
	const scope: DocumentScope =
		row.scopeKind === DOCUMENT_SCOPE_KIND.project && row.projectId
			? { kind: DOCUMENT_SCOPE_KIND.project, projectId: row.projectId }
			: { kind: DOCUMENT_SCOPE_KIND.personalWiki };
	return {
		body: row.body,
		id: row.id,
		liveFilePath: null,
		revision: row.revision,
		scope,
		title: row.title,
		type: row.type as DocumentType,
	};
}
