import type { Prisma, PrismaClient } from "@cantiara/db";

import { FILE_SCOPE_KIND } from "../../file-attachments/server/file-attachments-model";
import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { PROJECT_LIFECYCLE } from "../../project-shell/server/project-shell-model";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	exportOutcomeFromMarkdown,
	freezeLiveBlocksToMarkdown,
} from "./documents-export";
import { presentLiveDocumentBody } from "./documents-live";
import {
	copyDocumentCommandSchema,
	DOCUMENT_OWNED_FILE_KIND,
	DOCUMENT_SCOPE_KIND,
	type DocumentExportOutcome,
	type DocumentExternalSurfaces,
	type DocumentMovePreview,
	type DocumentScope,
	type DocumentView,
	type DocumentWriteOutcome,
	exportDocumentPayloadSchema,
	type MoveDocumentCommand,
	moveDocumentCommandSchema,
} from "./documents-model";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export interface DocumentPortabilityDeps {
	clock?: { now: () => Date };
	surfaces?: DocumentExternalSurfaces;
	toView: (
		tx: Prisma.TransactionClient,
		row: PortabilityDocumentRow
	) => Promise<DocumentView>;
}

export interface PortabilityDocumentRow {
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

export async function previewDocumentMove(
	prisma: PrismaClient,
	input: {
		childDocumentIds: readonly string[];
		documentId: string;
		target: DocumentScope;
		workspaceId: string;
	},
	deps: DocumentPortabilityDeps
): Promise<DocumentMovePreview> {
	const current = await prisma.document.findUnique({
		where: { id: input.documentId },
	});
	if (!current || current.workspaceId !== input.workspaceId) {
		return { reason: "document-not-found", status: "blocked" };
	}
	return await evaluateMove(prisma, current, input, deps);
}

export async function moveDocument(
	prisma: PrismaClient,
	command: unknown,
	deps: DocumentPortabilityDeps
): Promise<DocumentWriteOutcome> {
	const parsed = moveDocumentCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		moveInTransaction(tx, parsed.data, commandKey, fingerprint, deps)
	);
}

export async function copyDocument(
	prisma: PrismaClient,
	command: unknown,
	deps: DocumentPortabilityDeps
): Promise<DocumentWriteOutcome> {
	const parsed = copyDocumentCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		copyInTransaction(tx, parsed.data, commandKey, fingerprint, deps)
	);
}

export async function exportDocument(
	prisma: PrismaClient,
	input: unknown,
	deps: DocumentPortabilityDeps
): Promise<DocumentExportOutcome> {
	const parsed = exportDocumentPayloadSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const current = await prisma.document.findUnique({
		where: { id: parsed.data.documentId },
	});
	if (!current) {
		return { reason: "document-not-found", status: "rejected" };
	}
	const presented = await presentLiveDocumentBody(prisma, {
		body: current.body,
		workspaceId: current.workspaceId,
	});
	const attachments = await ownedAttachments(prisma, current.workspaceId, [
		current.id,
	]);
	const frozen = freezeLiveBlocksToMarkdown({
		attachments: attachments.map((file) => ({
			filename: file.filename,
			id: file.id,
			versionNumber: file.versionNumber,
		})),
		blocks: presented.blocks,
		body: current.body,
		documentId: current.id,
		exportedAt: exportClock(deps),
		revision: current.revision,
		title: current.title,
	});
	return exportOutcomeFromMarkdown(
		parsed.data.format,
		frozen.markdown,
		frozen.manifest
	);
}

async function moveInTransaction(
	tx: Prisma.TransactionClient,
	command: MoveDocumentCommand,
	commandKey: string,
	fingerprint: string,
	deps: DocumentPortabilityDeps
): Promise<DocumentWriteOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const live = await tx.document.findUnique({
			where: { id: existing.targetId },
		});
		if (live) {
			return { document: await deps.toView(tx, live), status: "replayed" };
		}
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
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
	const preview = await evaluateMove(
		tx,
		current,
		{
			childDocumentIds: command.payload.childDocumentIds,
			documentId: current.id,
			target: command.payload.target,
			workspaceId: command.workspaceId,
		},
		deps
	);
	if (preview.status === "blocked") {
		return { reason: preview.reason, status: "rejected" };
	}
	if (
		preview.publishEffect.cancelRequired &&
		command.payload.cancelExternalSurfaces !== true
	) {
		return { reason: "external-surface-active", status: "rejected" };
	}
	revokeSurfacesForMove(deps.surfaces, current.id, preview);
	await applyMoveWrites(tx, command.payload.target, preview);
	const moved = await tx.document.findUnique({ where: { id: current.id } });
	if (!moved) {
		return { reason: "document-not-found", status: "rejected" };
	}
	const view = await deps.toView(tx, moved);
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
	return { document: view, status: "committed" };
}

async function copyInTransaction(
	tx: Prisma.TransactionClient,
	command: {
		actorId: string;
		payload: { documentId: string; versionRevision?: number };
		workspaceId: string;
	},
	commandKey: string,
	fingerprint: string,
	deps: DocumentPortabilityDeps
): Promise<DocumentWriteOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const live = await tx.document.findUnique({
			where: { id: existing.targetId },
		});
		if (live) {
			return { document: await deps.toView(tx, live), status: "replayed" };
		}
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const source = await tx.document.findUnique({
		where: { id: command.payload.documentId },
	});
	if (!source || source.workspaceId !== command.workspaceId) {
		return { reason: "document-not-found", status: "rejected" };
	}
	let { body, title, type } = source;
	if (command.payload.versionRevision !== undefined) {
		const version = await tx.documentVersion.findUnique({
			where: {
				documentId_revision: {
					documentId: source.id,
					revision: command.payload.versionRevision,
				},
			},
		});
		if (!version) {
			return { reason: "version-not-found", status: "rejected" };
		}
		({ body, title, type } = version);
	}
	const copyId = crypto.randomUUID();
	const created = await tx.document.create({
		data: {
			archivedAt: null,
			body,
			folderId: null,
			id: copyId,
			parentId: null,
			projectId: source.projectId,
			revision: 1,
			scopeKind: source.scopeKind,
			title,
			type,
			workspaceId: source.workspaceId,
		},
	});
	await tx.documentVersion.create({
		data: {
			body: created.body,
			documentId: created.id,
			id: crypto.randomUUID(),
			revision: created.revision,
			title: created.title,
			type: created.type,
		},
	});
	await tx.typedRelation.create({
		data: {
			fromId: created.id,
			fromKind: "Document",
			id: crypto.randomUUID(),
			revision: 1,
			toId: source.id,
			toKind: "Document",
			type: RELATIONS_COPY.origin,
		},
	});
	const view = await deps.toView(tx, created);
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
	return { document: view, status: "committed" };
}

async function evaluateMove(
	db: PrismaLike,
	current: PortabilityDocumentRow,
	input: {
		childDocumentIds: readonly string[];
		documentId: string;
		target: DocumentScope;
		workspaceId: string;
	},
	deps: DocumentPortabilityDeps
): Promise<DocumentMovePreview> {
	if (current.scopeKind !== DOCUMENT_SCOPE_KIND.project || !current.projectId) {
		return { reason: "source-project-not-active", status: "blocked" };
	}
	const project = await db.project.findUnique({
		where: { id: current.projectId },
	});
	if (
		!project ||
		project.workspaceId !== input.workspaceId ||
		project.lifecycleStatus !== PROJECT_LIFECYCLE.active
	) {
		return { reason: "source-project-not-active", status: "blocked" };
	}
	if (sameScope(current, input.target)) {
		return { reason: "same-scope", status: "blocked" };
	}
	if (input.target.kind === DOCUMENT_SCOPE_KIND.project) {
		const target = await db.project.findUnique({
			where: { id: input.target.projectId },
		});
		if (!target || target.workspaceId !== input.workspaceId) {
			return { reason: "project-not-found", status: "blocked" };
		}
	}
	const descendants = await descendantIds(db, current.workspaceId, current.id);
	for (const childId of input.childDocumentIds) {
		if (!descendants.has(childId)) {
			return { reason: "child-not-found", status: "blocked" };
		}
	}
	const selectedDocumentIds = [current.id, ...input.childDocumentIds];
	const moving = new Set(selectedDocumentIds);
	const children = await db.document.findMany({
		orderBy: { createdAt: "asc" },
		where: { parentId: { in: selectedDocumentIds } },
	});
	const detached = children.filter((child) => !moving.has(child.id));
	const owned = await ownedAttachments(
		db,
		current.workspaceId,
		selectedDocumentIds
	);
	const unowned = await unownedProjectAttachments(
		db,
		current.workspaceId,
		current.projectId,
		new Set(owned.map((file) => file.id))
	);
	const active = deps.surfaces?.listActive(current.id) ?? [];
	const workIds = workIdsFromBody(current.body);
	return {
		brokenReferences: [
			...detached.map((child) => ({
				kind: "child-detached" as const,
				sourceId: child.id,
				title: child.title,
			})),
			...unowned.map((file) => ({
				kind: "unowned-attachment" as const,
				sourceId: file.id,
				title: file.title,
			})),
		],
		detachedChildIds: detached.map((child) => child.id),
		movedAttachmentIds: owned.map((file) => file.id),
		publishEffect: {
			activeSurfaceCount: active.length,
			cancelRequired: active.length > 0,
			documentId: current.id,
			historicalScope: active[0]?.historicalScope ?? scopeFromRow(current),
		},
		selectedDocumentIds,
		status: "ok",
		target: input.target,
		workIds,
	};
}

async function descendantIds(
	db: PrismaLike,
	workspaceId: string,
	rootId: string
): Promise<Set<string>> {
	const rows = await db.document.findMany({
		select: { id: true, parentId: true },
		where: { workspaceId },
	});
	const byParent = new Map<string, string[]>();
	for (const row of rows) {
		if (!row.parentId) {
			continue;
		}
		const siblings = byParent.get(row.parentId) ?? [];
		siblings.push(row.id);
		byParent.set(row.parentId, siblings);
	}
	const found = new Set<string>();
	const queue = [rootId];
	while (queue.length > 0) {
		const parentId = queue.shift();
		if (!parentId) {
			continue;
		}
		for (const childId of byParent.get(parentId) ?? []) {
			if (found.has(childId)) {
				continue;
			}
			found.add(childId);
			queue.push(childId);
		}
	}
	return found;
}

async function applyMoveWrites(
	tx: Prisma.TransactionClient,
	target: DocumentScope,
	preview: Extract<DocumentMovePreview, { status: "ok" }>
): Promise<void> {
	const targetProjectId =
		target.kind === DOCUMENT_SCOPE_KIND.project ? target.projectId : null;
	const moving = new Set(preview.selectedDocumentIds);
	await Promise.all(
		preview.detachedChildIds.map((id) =>
			tx.document.update({ data: { parentId: null }, where: { id } })
		)
	);
	const selected = await tx.document.findMany({
		where: { id: { in: [...preview.selectedDocumentIds] } },
	});
	await Promise.all(
		selected.map((row) =>
			tx.document.update({
				data: {
					folderId: null,
					parentId:
						row.parentId && moving.has(row.parentId) ? row.parentId : null,
					projectId: targetProjectId,
					scopeKind: target.kind,
				},
				where: { id: row.id },
			})
		)
	);
	const fileScope =
		target.kind === DOCUMENT_SCOPE_KIND.project
			? FILE_SCOPE_KIND.project
			: FILE_SCOPE_KIND.personalWiki;
	await Promise.all(
		preview.movedAttachmentIds.map((fileId) =>
			tx.fileAttachment.update({
				data: { projectId: targetProjectId, scopeKind: fileScope },
				where: { id: fileId },
			})
		)
	);
}

function revokeSurfacesForMove(
	surfaces: DocumentExternalSurfaces | undefined,
	rootId: string,
	preview: Extract<DocumentMovePreview, { status: "ok" }>
): void {
	if (!preview.publishEffect.cancelRequired) {
		return;
	}
	surfaces?.revoke(rootId);
	for (const id of preview.selectedDocumentIds) {
		if (id !== rootId) {
			surfaces?.revoke(id);
		}
	}
}

function exportClock(deps: DocumentPortabilityDeps): Date {
	if (deps.clock) {
		return deps.clock.now();
	}
	return new Date();
}

async function ownedAttachments(
	db: PrismaLike,
	workspaceId: string,
	documentIds: readonly string[]
): Promise<
	Array<{ filename: string; id: string; title: string; versionNumber: number }>
> {
	const edges = await db.fileAttachmentRelation.findMany({
		where: {
			kind: DOCUMENT_OWNED_FILE_KIND,
			targetId: { in: [...documentIds] },
		},
	});
	if (edges.length === 0) {
		return [];
	}
	return (
		await db.fileAttachment.findMany({
			select: {
				id: true,
				title: true,
				versions: {
					orderBy: { versionNumber: "desc" },
					select: { filename: true, versionNumber: true },
					take: 1,
				},
			},
			where: {
				id: { in: edges.map((edge) => edge.fromId) },
				workspaceId,
			},
		})
	).map((file) => ({
		filename: file.versions[0]?.filename ?? file.title,
		id: file.id,
		title: file.title,
		versionNumber: file.versions[0]?.versionNumber ?? 1,
	}));
}

async function unownedProjectAttachments(
	db: PrismaLike,
	workspaceId: string,
	projectId: string,
	ownedIds: ReadonlySet<string>
): Promise<Array<{ id: string; title: string }>> {
	const files = await db.fileAttachment.findMany({
		select: { id: true, title: true },
		where: {
			projectId,
			scopeKind: FILE_SCOPE_KIND.project,
			workspaceId,
		},
	});
	return files.filter((file) => !ownedIds.has(file.id));
}

function workIdsFromBody(body: string): string[] {
	const ids: string[] = [];
	const fence = /```live-work\n([^\n]+)\n```/g;
	for (const match of body.matchAll(fence)) {
		const id = match[1]?.trim();
		if (id) {
			ids.push(id);
		}
	}
	return ids;
}

function sameScope(
	row: PortabilityDocumentRow,
	target: DocumentScope
): boolean {
	if (target.kind === DOCUMENT_SCOPE_KIND.personalWiki) {
		return row.scopeKind === DOCUMENT_SCOPE_KIND.personalWiki;
	}
	return (
		row.scopeKind === DOCUMENT_SCOPE_KIND.project &&
		row.projectId === target.projectId
	);
}

function scopeFromRow(row: PortabilityDocumentRow): DocumentScope {
	return row.scopeKind === DOCUMENT_SCOPE_KIND.project && row.projectId
		? { kind: DOCUMENT_SCOPE_KIND.project, projectId: row.projectId }
		: { kind: DOCUMENT_SCOPE_KIND.personalWiki };
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

async function lockWorkspace(
	tx: Prisma.TransactionClient,
	workspaceId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`documents:workspace:${workspaceId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}
