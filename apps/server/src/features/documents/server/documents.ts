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
	type ArchiveDocumentCommand,
	archiveDocumentCommandSchema,
	type CreateDocumentCommand,
	type CreateDocumentFolderCommand,
	createDocumentCommandSchema,
	createDocumentFolderCommandSchema,
	DOCUMENT_MAX_DEPTH,
	DOCUMENT_SCOPE_KIND,
	type DocumentArchivePreview,
	type DocumentFolderView,
	type DocumentFolderWriteOutcome,
	type DocumentHierarchyPreview,
	type DocumentInDocTag,
	type DocumentLiveFiles,
	type DocumentScope,
	type DocumentType,
	type DocumentView,
	type DocumentWriteOutcome,
	isDocumentType,
	type PlaceDocumentCommand,
	placeDocumentCommandSchema,
	resolveInDocTags,
	type UpdateDocumentCommand,
	updateDocumentCommandSchema,
} from "./documents-model";

type PrismaTransaction = Prisma.TransactionClient;

interface DocumentRow {
	archivedAt: Date | null;
	body: string;
	folderId: string | null;
	id: string;
	parentId: string | null;
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
	const tags = await inDocTagsFor(prisma, [row.id]);
	return toView(row, tags.get(row.id) ?? []);
}

export async function listDocuments(
	prisma: PrismaClient,
	input: { archived?: boolean; scope: DocumentScope; workspaceId: string }
): Promise<DocumentView[]> {
	if (
		!("document" in prisma) ||
		typeof prisma.document?.findMany !== "function"
	) {
		return [];
	}
	const archived = input.archived === true;
	const rows = await prisma.document.findMany({
		orderBy: { createdAt: "asc" },
		where:
			input.scope.kind === DOCUMENT_SCOPE_KIND.project
				? {
						archivedAt: archived ? { not: null } : null,
						projectId: input.scope.projectId,
						scopeKind: DOCUMENT_SCOPE_KIND.project,
						workspaceId: input.workspaceId,
					}
				: {
						archivedAt: archived ? { not: null } : null,
						projectId: null,
						scopeKind: DOCUMENT_SCOPE_KIND.personalWiki,
						workspaceId: input.workspaceId,
					},
	});
	const tags = await inDocTagsFor(
		prisma,
		rows.map((row) => row.id)
	);
	return rows.map((row) => toView(row, tags.get(row.id) ?? []));
}

export async function listDocumentFolders(
	prisma: PrismaClient,
	input: { scope: DocumentScope; workspaceId: string }
): Promise<DocumentFolderView[]> {
	if (
		!("documentFolder" in prisma) ||
		typeof prisma.documentFolder?.findMany !== "function"
	) {
		return [];
	}
	const rows = await prisma.documentFolder.findMany({
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
	return rows.map(toFolderView);
}

export async function createDocumentFolder(
	prisma: PrismaClient,
	command: unknown
): Promise<DocumentFolderWriteOutcome> {
	const parsed = createDocumentFolderCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const name = parsed.data.payload.name.trim();
	if (name.length === 0) {
		return { reason: "title-required", status: "rejected" };
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
		createFolderInTransaction(tx, parsed.data, commandKey, fingerprint, name)
	);
}

export async function previewDocumentPlacement(
	prisma: PrismaClient,
	input: {
		documentId: string;
		folderId: string | null;
		parentId: string | null;
		workspaceId: string;
	}
): Promise<DocumentHierarchyPreview> {
	const current = await prisma.document.findUnique({
		where: { id: input.documentId },
	});
	if (!current || current.workspaceId !== input.workspaceId) {
		return { reason: "document-not-found", status: "blocked" };
	}
	return await evaluatePlacement(prisma, current, input);
}

export async function placeDocument(
	prisma: PrismaClient,
	command: unknown
): Promise<DocumentWriteOutcome> {
	const parsed = placeDocumentCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		placeInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function previewDocumentArchive(
	prisma: PrismaClient,
	input: { documentId: string; workspaceId: string }
): Promise<DocumentArchivePreview> {
	const current = await prisma.document.findUnique({
		where: { id: input.documentId },
	});
	if (!current || current.workspaceId !== input.workspaceId) {
		return { reason: "document-not-found", status: "blocked" };
	}
	const children = await prisma.document.findMany({
		orderBy: { createdAt: "asc" },
		select: { title: true },
		where: { parentId: current.id },
	});
	return {
		childTitles: children.map((child) => child.title),
		documentId: current.id,
		status: "ok",
	};
}

export async function archiveDocument(
	prisma: PrismaClient,
	command: unknown
): Promise<DocumentWriteOutcome> {
	return await setArchived(prisma, command, true);
}

export async function unarchiveDocument(
	prisma: PrismaClient,
	command: unknown
): Promise<DocumentWriteOutcome> {
	return await setArchived(prisma, command, false);
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
			archivedAt: null,
			body,
			folderId: null,
			id: crypto.randomUUID(),
			parentId: null,
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
	await syncInDocTags(tx, created);
	const view = await viewFromTx(tx, created);
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
	await syncInDocTags(tx, updated);
	const view = await viewFromTx(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { document: view, status: "committed" };
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
		return { document: await viewFromTx(tx, live), status: "replayed" };
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

async function createFolderInTransaction(
	tx: PrismaTransaction,
	command: CreateDocumentFolderCommand,
	commandKey: string,
	fingerprint: string,
	name: string
): Promise<DocumentFolderWriteOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const live = await tx.documentFolder.findUnique({
			where: { id: existing.targetId },
		});
		if (live) {
			return { folder: toFolderView(live), status: "replayed" };
		}
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const created = await tx.documentFolder.create({
		data: {
			id: crypto.randomUUID(),
			name,
			projectId:
				command.payload.scope.kind === DOCUMENT_SCOPE_KIND.project
					? command.payload.scope.projectId
					: null,
			revision: 1,
			scopeKind: command.payload.scope.kind,
			workspaceId: command.workspaceId,
		},
	});
	const view = toFolderView(created);
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: view.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(view),
			targetId: view.id,
		},
	});
	return { folder: view, status: "committed" };
}

async function placeInTransaction(
	tx: PrismaTransaction,
	command: PlaceDocumentCommand,
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
	const preview = await evaluatePlacement(tx, current, {
		folderId: command.payload.folderId,
		parentId: command.payload.parentId,
		workspaceId: command.workspaceId,
	});
	if (preview.status === "blocked") {
		return { reason: preview.reason, status: "rejected" };
	}
	const updated = await tx.document.update({
		data: {
			folderId: preview.folderId,
			parentId: preview.parentId,
		},
		where: { id: current.id },
	});
	const view = await viewFromTx(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { document: view, status: "committed" };
}

async function setArchived(
	prisma: PrismaClient,
	command: unknown,
	archived: boolean
): Promise<DocumentWriteOutcome> {
	const parsed = archiveDocumentCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		archived,
		documentId: parsed.data.payload.documentId,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		setArchivedInTransaction(tx, parsed.data, commandKey, fingerprint, archived)
	);
}

async function setArchivedInTransaction(
	tx: PrismaTransaction,
	command: ArchiveDocumentCommand,
	commandKey: string,
	fingerprint: string,
	archived: boolean
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
	const updated = await tx.document.update({
		data: {
			archivedAt: archived ? new Date() : null,
			revision: current.revision + 1,
		},
		where: { id: current.id },
	});
	const view = await viewFromTx(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { document: view, status: "committed" };
}

async function evaluatePlacement(
	db: PrismaClient | PrismaTransaction,
	current: DocumentRow,
	input: {
		folderId: string | null;
		parentId: string | null;
		workspaceId: string;
	}
): Promise<DocumentHierarchyPreview> {
	if (input.folderId) {
		const folder = await db.documentFolder.findUnique({
			where: { id: input.folderId },
		});
		if (!folder || folder.workspaceId !== input.workspaceId) {
			return { reason: "folder-not-found", status: "blocked" };
		}
		if (!sameScope(current, folder)) {
			return { reason: "folder-not-found", status: "blocked" };
		}
	}
	if (!input.parentId) {
		return {
			depth: 1,
			folderId: input.folderId,
			parentId: null,
			status: "ok",
		};
	}
	if (input.parentId === current.id) {
		return { reason: "cycle", status: "blocked" };
	}
	const parent = await db.document.findUnique({
		where: { id: input.parentId },
	});
	if (!parent || parent.workspaceId !== input.workspaceId) {
		return { reason: "parent-not-found", status: "blocked" };
	}
	if (!sameScope(current, parent)) {
		return { reason: "cross-scope-parent", status: "blocked" };
	}
	const tree = await loadHierarchy(db, input.workspaceId);
	if (isAncestor(tree, current.id, parent.id)) {
		return { reason: "cycle", status: "blocked" };
	}
	const parentDepth = depthOf(tree, parent.id);
	const subtreeHeight = heightBelow(tree, current.id);
	const placedDepth = parentDepth + 1;
	if (placedDepth + subtreeHeight > DOCUMENT_MAX_DEPTH) {
		return { reason: "depth-exceeded", status: "blocked" };
	}
	return {
		depth: placedDepth,
		folderId: input.folderId,
		parentId: parent.id,
		status: "ok",
	};
}

function sameScope(
	left: { projectId: string | null; scopeKind: string },
	right: { projectId: string | null; scopeKind: string }
): boolean {
	return (
		left.scopeKind === right.scopeKind && left.projectId === right.projectId
	);
}

interface HierarchyMap {
	children: Map<string, string[]>;
	parentById: Map<string, string | null>;
}

async function loadHierarchy(
	db: PrismaClient | PrismaTransaction,
	workspaceId: string
): Promise<HierarchyMap> {
	const rows: Array<{ id: string; parentId: string | null }> =
		await db.document.findMany({
			select: { id: true, parentId: true },
			where: { workspaceId },
		});
	const parentById = new Map<string, string | null>();
	const children = new Map<string, string[]>();
	for (const row of rows) {
		parentById.set(row.id, row.parentId);
		if (!row.parentId) {
			continue;
		}
		const list = children.get(row.parentId) ?? [];
		list.push(row.id);
		children.set(row.parentId, list);
	}
	return { children, parentById };
}

function isAncestor(
	tree: HierarchyMap,
	ancestorId: string,
	nodeId: string
): boolean {
	let cursor: string | null = nodeId;
	const seen = new Set<string>();
	while (cursor) {
		if (cursor === ancestorId) {
			return true;
		}
		if (seen.has(cursor)) {
			return true;
		}
		seen.add(cursor);
		cursor = tree.parentById.get(cursor) ?? null;
	}
	return false;
}

function depthOf(tree: HierarchyMap, documentId: string): number {
	let depth = 1;
	let cursor: string | null = documentId;
	const seen = new Set<string>();
	while (cursor) {
		if (seen.has(cursor)) {
			break;
		}
		seen.add(cursor);
		const nextParent: string | null = tree.parentById.get(cursor) ?? null;
		if (!nextParent) {
			break;
		}
		depth += 1;
		cursor = nextParent;
	}
	return depth;
}

function heightBelow(tree: HierarchyMap, documentId: string): number {
	const children = tree.children.get(documentId) ?? [];
	if (children.length === 0) {
		return 0;
	}
	return 1 + Math.max(...children.map((child) => heightBelow(tree, child)));
}

async function syncInDocTags(
	tx: PrismaTransaction,
	row: DocumentRow
): Promise<void> {
	if (!("tag" in tx) || typeof tx.tag?.findMany !== "function") {
		return;
	}
	const dictionary = await tx.tag.findMany({
		select: { id: true, name: true },
		where: { workspaceId: row.workspaceId },
	});
	const { resolved } = resolveInDocTags(row.body, dictionary);
	const resolvedIds = new Set(resolved.map((tag) => tag.id));
	const existing = await tx.tagInlineUse.findMany({
		where: { documentId: row.id },
	});
	const stale = existing.filter((use) => !resolvedIds.has(use.tagId));
	if (stale.length > 0) {
		await tx.tagInlineUse.deleteMany({
			where: { id: { in: stale.map((use) => use.id) } },
		});
	}
	await Promise.all(
		resolved.map((tag) => {
			const current = existing.find((use) => use.tagId === tag.id);
			if (current) {
				return tx.tagInlineUse.update({
					data: { body: row.body, revision: current.revision + 1 },
					where: { id: current.id },
				});
			}
			return tx.tagInlineUse.create({
				data: {
					body: row.body,
					documentId: row.id,
					id: crypto.randomUUID(),
					revision: 1,
					tagId: tag.id,
				},
			});
		})
	);
}

async function inDocTagsFor(
	prisma: PrismaClient | PrismaTransaction,
	documentIds: string[]
): Promise<Map<string, DocumentInDocTag[]>> {
	const grouped = new Map<string, DocumentInDocTag[]>();
	if (
		documentIds.length === 0 ||
		!("tagInlineUse" in prisma) ||
		typeof prisma.tagInlineUse?.findMany !== "function"
	) {
		return grouped;
	}
	const uses = await prisma.tagInlineUse.findMany({
		include: { tag: { select: { id: true, name: true } } },
		orderBy: { createdAt: "asc" },
		where: { documentId: { in: documentIds } },
	});
	for (const use of uses) {
		const list = grouped.get(use.documentId) ?? [];
		list.push({ id: use.tag.id, name: use.tag.name });
		grouped.set(use.documentId, list);
	}
	return grouped;
}

async function viewFromTx(
	tx: PrismaTransaction,
	row: DocumentRow
): Promise<DocumentView> {
	const tags = await inDocTagsFor(tx, [row.id]);
	return toView(row, tags.get(row.id) ?? []);
}

function toFolderView(row: {
	id: string;
	name: string;
	projectId: string | null;
	revision: number;
	scopeKind: string;
}): DocumentFolderView {
	return {
		id: row.id,
		name: row.name,
		revision: row.revision,
		scope: scopeOf(row),
	};
}

function toView(
	row: DocumentRow,
	inDocTags: readonly DocumentInDocTag[] = []
): DocumentView {
	return {
		archived: row.archivedAt !== null,
		body: row.body,
		folderId: row.folderId,
		id: row.id,
		inDocTags,
		liveFilePath: null,
		parentId: row.parentId,
		revision: row.revision,
		scope: scopeOf(row),
		title: row.title,
		type: row.type as DocumentType,
	};
}

function scopeOf(row: {
	projectId: string | null;
	scopeKind: string;
}): DocumentScope {
	return row.scopeKind === DOCUMENT_SCOPE_KIND.project && row.projectId
		? { kind: DOCUMENT_SCOPE_KIND.project, projectId: row.projectId }
		: { kind: DOCUMENT_SCOPE_KIND.personalWiki };
}
