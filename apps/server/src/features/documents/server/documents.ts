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
import { createRelationInTransaction } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	documentsWouldCycle,
	ensureSectionIds,
	stripSectionIds,
	syncDocumentUsageLinks,
	usageTargetsFromBody,
} from "./documents-live";
import {
	type ApplyConflictDraftCommand,
	type ArchiveDocumentCommand,
	applyConflictDraftCommandSchema,
	applyDocumentTemplatePlaceholders,
	archiveDocumentCommandSchema,
	type ConvertDocumentToTemplatePreviewOutcome,
	type CreateDocumentCommand,
	type CreateDocumentFolderCommand,
	type CreateDocumentFromConflictDraftCommand,
	type CreateDocumentTemplateCommand,
	convertDocumentToTemplateCommandSchema,
	createDocumentCommandSchema,
	createDocumentFolderCommandSchema,
	createDocumentFromConflictDraftCommandSchema,
	createDocumentTemplateCommandSchema,
	type DeleteConflictDraftCommand,
	DOCUMENT_MAX_DEPTH,
	DOCUMENT_SCOPE_KIND,
	DOCUMENT_STARTER_SKELETONS,
	DOCUMENTS_COPY,
	type DocumentArchivePreview,
	type DocumentChildCard,
	type DocumentConflictDraftCompare,
	type DocumentConflictDraftView,
	type DocumentConflictDraftWriteOutcome,
	type DocumentFolderView,
	type DocumentFolderWriteOutcome,
	type DocumentHierarchyPreview,
	type DocumentInDocTag,
	type DocumentLiveFiles,
	type DocumentScope,
	type DocumentTemplateView,
	type DocumentTemplateWriteOutcome,
	type DocumentType,
	type DocumentVersionCompare,
	type DocumentVersionView,
	type DocumentView,
	type DocumentWriteOutcome,
	deleteConflictDraftCommandSchema,
	documentTemplatePlaceholders,
	emptyHeadingDocumentBody,
	FORBIDDEN_DOCUMENT_TEMPLATE_PAYLOAD_KEYS,
	type InstantiateDocumentFromTemplateCommand,
	instantiateDocumentFromTemplateCommandSchema,
	isDocumentType,
	type MaterializeStarterSkeletonDocumentsCommand,
	materializeStarterSkeletonDocumentsCommandSchema,
	mergeConflictDraftHunks,
	PERSONAL_REVIEW_KIND,
	type PlaceDocumentCommand,
	personalReviewSkeleton,
	placeDocumentCommandSchema,
	presentDocumentChildCard,
	presentDocumentVersionDiff,
	type RestoreDocumentCommand,
	resolveInDocTags,
	restoreDocumentCommandSchema,
	type StarterSkeletonDocumentsOutcome,
	type UpdateDocumentCommand,
	type UpdateDocumentTemplateCommand,
	updateDocumentCommandSchema,
	updateDocumentTemplateCommandSchema,
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

export async function getConflictDraft(
	prisma: PrismaClient,
	documentId: string,
	workspaceId?: string
): Promise<DocumentConflictDraftView | null> {
	if (
		!("documentConflictDraft" in prisma) ||
		typeof prisma.documentConflictDraft?.findUnique !== "function"
	) {
		return null;
	}
	const row = await prisma.documentConflictDraft.findUnique({
		where: { documentId },
	});
	if (!row) {
		return null;
	}
	if (workspaceId && row.workspaceId !== workspaceId) {
		return null;
	}
	return toConflictDraftView(row);
}

export async function compareConflictDraft(
	prisma: PrismaClient,
	input: { documentId: string; workspaceId?: string }
): Promise<DocumentConflictDraftCompare | null> {
	const document = await getDocument(
		prisma,
		input.documentId,
		input.workspaceId
	);
	const draft = await getConflictDraft(
		prisma,
		input.documentId,
		input.workspaceId
	);
	if (!(document && draft)) {
		return null;
	}
	return {
		current: document,
		draft,
		hunks: presentDocumentVersionDiff(document.body, draft.body),
	};
}

export async function applyConflictDraft(
	prisma: PrismaClient,
	command: unknown
): Promise<DocumentConflictDraftWriteOutcome> {
	const parsed = applyConflictDraftCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
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
		applyConflictDraftInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function createDocumentFromConflictDraft(
	prisma: PrismaClient,
	command: unknown
): Promise<DocumentConflictDraftWriteOutcome> {
	const parsed =
		createDocumentFromConflictDraftCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
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
	return await prisma.$transaction((tx) =>
		createDocumentFromConflictDraftInTransaction(
			tx,
			parsed.data,
			commandKey,
			fingerprint,
			title
		)
	);
}

export async function deleteConflictDraft(
	prisma: PrismaClient,
	command: unknown
): Promise<DocumentConflictDraftWriteOutcome> {
	const parsed = deleteConflictDraftCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		deleteConflictDraftInTransaction(tx, parsed.data, commandKey, fingerprint)
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
	const tags = await inDocTagsFor(prisma, [row.id]);
	const cards = await childCardsFor(prisma, [row.id]);
	return toView(row, tags.get(row.id) ?? [], cards.get(row.id) ?? []);
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
	const cards = await childCardsFor(
		prisma,
		rows.map((row) => row.id)
	);
	return rows.map((row) =>
		toView(row, tags.get(row.id) ?? [], cards.get(row.id) ?? [])
	);
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
				archivedAt: null,
				body,
				folderId: null,
				id: documentId,
				parentId: null,
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
		await syncInDocTags(tx, created);
		const view = await viewFromTx(tx, created);
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
			archivedAt: null,
			body,
			folderId: null,
			id: documentId,
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
	await recordVersion(tx, created);
	await syncDocumentUsageLinks(tx, {
		hostRecordId: created.id,
		targets: usageTargetsFromBody(created.body),
		workspaceId: command.workspaceId,
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
		return await conflictDraftFromStaleSave(
			tx,
			command,
			commandKey,
			fingerprint,
			current
		);
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
					body: ensureSectionIds(
						emptyHeadingDocumentBody(skeleton.emptyHeadings)
					),
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
	await Promise.all(created.map((row) => recordVersion(tx, row)));
	await Promise.all(created.map((row) => syncInDocTags(tx, row)));
	const documents = await Promise.all(
		created.map((row) => viewFromTx(tx, row))
	);
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
		documents: await Promise.all(
			rows.flatMap((row) => (row ? [viewFromTx(tx, row)] : []))
		),
		status: "replayed",
	};
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
	await syncInDocTags(tx, restored);
	const view = await viewFromTx(tx, restored);
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
	if (existing.kind === "conflict-draft") {
		return await replayConflictDraft(tx, existing.targetId);
	}
	const live = await tx.document.findUnique({
		where: { id: existing.targetId },
	});
	if (live) {
		return { document: await viewFromTx(tx, live), status: "replayed" };
	}
	return { conflict: MUTATION_COPY.conflict, status: "conflict" };
}

async function replayConflictDraft(
	tx: PrismaTransaction,
	documentId: string
): Promise<DocumentWriteOutcome> {
	const live = await tx.document.findUnique({ where: { id: documentId } });
	const draft = await tx.documentConflictDraft.findUnique({
		where: { documentId },
	});
	if (live && draft) {
		return {
			conflict: DOCUMENTS_COPY.conflictDraft,
			document: await viewFromTx(tx, live),
			draft: toConflictDraftView(draft),
			status: "conflict",
		};
	}
	return { conflict: MUTATION_COPY.conflict, status: "conflict" };
}

async function conflictDraftFromStaleSave(
	tx: PrismaTransaction,
	command: UpdateDocumentCommand,
	commandKey: string,
	fingerprint: string,
	current: DocumentRow
): Promise<DocumentWriteOutcome> {
	const rejected = nextDocumentFields(command, current);
	const draft = await upsertConflictDraft(tx, {
		body: rejected.nextBody,
		documentId: current.id,
		documentRevision: current.revision,
		rejectedBaseRevision: command.baseRevision,
		title: rejected.nextTitle,
		type: rejected.nextType,
		workspaceId: command.workspaceId,
	});
	const view = await viewFromTx(tx, current);
	const draftView = toConflictDraftView(draft);
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: current.revision,
			id: crypto.randomUUID(),
			kind: "conflict-draft",
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify({ document: view, draft: draftView }),
			targetId: current.id,
		},
	});
	return {
		conflict: DOCUMENTS_COPY.conflictDraft,
		document: view,
		draft: draftView,
		status: "conflict",
	};
}

async function applyConflictDraftInTransaction(
	tx: PrismaTransaction,
	command: ApplyConflictDraftCommand,
	commandKey: string,
	fingerprint: string
): Promise<DocumentConflictDraftWriteOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayResolvedDraft(tx, commandKey, fingerprint);
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
	const draft = await tx.documentConflictDraft.findUnique({
		where: { documentId: current.id },
	});
	if (!draft) {
		return { reason: "conflict-draft-not-found", status: "rejected" };
	}
	const merged = mergeConflictDraftHunks(
		current.body,
		draft.body,
		command.payload.hunkChoices
	);
	if (merged === null) {
		return { reason: "preview-mismatch", status: "rejected" };
	}
	const nextTitle =
		command.payload.title === undefined
			? current.title
			: command.payload.title.trim();
	const nextBody = ensureSectionIds(merged);
	if (await documentsWouldCycle(tx, current.id, nextBody)) {
		return { reason: "live-section-cycle", status: "rejected" };
	}
	const updated = await tx.document.update({
		data: {
			body: nextBody,
			revision: current.revision + 1,
			title: nextTitle,
		},
		where: { id: current.id },
	});
	await recordVersion(tx, updated);
	await syncDocumentUsageLinks(tx, {
		hostRecordId: updated.id,
		targets: usageTargetsFromBody(updated.body),
		workspaceId: command.workspaceId,
	});
	await syncInDocTags(tx, updated);
	await tx.documentConflictDraft.delete({ where: { id: draft.id } });
	const view = await viewFromTx(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { document: view, status: "committed" };
}

async function createDocumentFromConflictDraftInTransaction(
	tx: PrismaTransaction,
	command: CreateDocumentFromConflictDraftCommand,
	commandKey: string,
	fingerprint: string,
	title: string
): Promise<DocumentConflictDraftWriteOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayResolvedDraft(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const source = await tx.document.findUnique({
		where: { id: command.payload.documentId },
	});
	if (!source || source.workspaceId !== command.workspaceId) {
		return { reason: "document-not-found", status: "rejected" };
	}
	const draft = await tx.documentConflictDraft.findUnique({
		where: { documentId: source.id },
	});
	if (!draft) {
		return { reason: "conflict-draft-not-found", status: "rejected" };
	}
	const body = ensureSectionIds(command.payload.body ?? draft.body);
	const documentId = crypto.randomUUID();
	if (await documentsWouldCycle(tx, documentId, body)) {
		return { reason: "live-section-cycle", status: "rejected" };
	}
	const created = await tx.document.create({
		data: {
			archivedAt: null,
			body,
			folderId: null,
			id: documentId,
			parentId: null,
			projectId: source.projectId,
			revision: 1,
			scopeKind: source.scopeKind,
			title,
			type: draft.type,
			workspaceId: command.workspaceId,
		},
	});
	await recordVersion(tx, created);
	await syncDocumentUsageLinks(tx, {
		hostRecordId: created.id,
		targets: usageTargetsFromBody(created.body),
		workspaceId: command.workspaceId,
	});
	await syncInDocTags(tx, created);
	const related = await createRelationInTransaction(tx, {
		actorId: command.actorId,
		from: { id: created.id, kind: "Document" },
		idempotencyKey: `${command.idempotencyKey}:origin`,
		origin: "human",
		previewAcknowledged: true,
		to: { id: source.id, kind: "Document" },
		type: RELATIONS_COPY.origin,
		viewerWorkspaceId: command.workspaceId,
	});
	if (related.status !== "committed" && related.status !== "replayed") {
		return { reason: "invalid-command", status: "rejected" };
	}
	await tx.documentConflictDraft.delete({ where: { id: draft.id } });
	const view = await viewFromTx(tx, created);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { document: view, status: "committed" };
}

async function deleteConflictDraftInTransaction(
	tx: PrismaTransaction,
	command: DeleteConflictDraftCommand,
	commandKey: string,
	fingerprint: string
): Promise<DocumentConflictDraftWriteOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayResolvedDraft(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const current = await tx.document.findUnique({
		where: { id: command.payload.documentId },
	});
	if (!current || current.workspaceId !== command.workspaceId) {
		return { reason: "document-not-found", status: "rejected" };
	}
	const draft = await tx.documentConflictDraft.findUnique({
		where: { documentId: current.id },
	});
	if (!draft) {
		return { reason: "conflict-draft-not-found", status: "rejected" };
	}
	await tx.documentConflictDraft.delete({ where: { id: draft.id } });
	const view = await viewFromTx(tx, current);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { document: view, status: "committed" };
}

async function replayResolvedDraft(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<DocumentConflictDraftWriteOutcome | null> {
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

async function upsertConflictDraft(
	tx: PrismaTransaction,
	input: {
		body: string;
		documentId: string;
		documentRevision: number;
		rejectedBaseRevision: number;
		title: string;
		type: string;
		workspaceId: string;
	}
) {
	const existing = await tx.documentConflictDraft.findUnique({
		where: { documentId: input.documentId },
	});
	const data = {
		body: input.body,
		documentRevision: input.documentRevision,
		rejectedBaseRevision: input.rejectedBaseRevision,
		title: input.title,
		type: input.type,
		workspaceId: input.workspaceId,
	};
	if (existing) {
		return await tx.documentConflictDraft.update({
			data,
			where: { id: existing.id },
		});
	}
	return await tx.documentConflictDraft.create({
		data: {
			...data,
			documentId: input.documentId,
			id: crypto.randomUUID(),
		},
	});
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
	const cards = await childCardsFor(tx, [row.id]);
	return toView(row, tags.get(row.id) ?? [], cards.get(row.id) ?? []);
}

async function childCardsFor(
	prisma: PrismaClient | PrismaTransaction,
	parentIds: string[]
): Promise<Map<string, DocumentChildCard[]>> {
	const grouped = new Map<string, DocumentChildCard[]>();
	if (parentIds.length === 0) {
		return grouped;
	}
	const children = await prisma.document.findMany({
		orderBy: { createdAt: "asc" },
		where: { archivedAt: null, parentId: { in: parentIds } },
	});
	for (const child of children) {
		if (!child.parentId) {
			continue;
		}
		const list = grouped.get(child.parentId) ?? [];
		list.push(
			presentDocumentChildCard({
				body: child.body,
				documentId: child.id,
				title: child.title,
				type: child.type as DocumentType,
			})
		);
		grouped.set(child.parentId, list);
	}
	return grouped;
}

function toView(
	row: DocumentRow,
	inDocTags: readonly DocumentInDocTag[] = [],
	childCards: readonly DocumentChildCard[] = []
): DocumentView {
	return {
		archived: row.archivedAt !== null,
		body: row.body,
		childCards,
		folderId: row.folderId,
		id: row.id,
		inDocTags,
		liveFilePath: null,
		parentId: row.parentId,
		revision: row.revision,
		scope: scopeFromRow(row),
		title: row.title,
		type: row.type as DocumentType,
	};
}

function toConflictDraftView(row: {
	body: string;
	documentId: string;
	documentRevision: number;
	id: string;
	rejectedBaseRevision: number;
	title: string;
	type: string;
}): DocumentConflictDraftView {
	return {
		body: row.body,
		documentId: row.documentId,
		documentRevision: row.documentRevision,
		id: row.id,
		rejectedBaseRevision: row.rejectedBaseRevision,
		title: row.title,
		type: row.type as DocumentType,
	};
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
		scope: scopeFromRow(row),
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
