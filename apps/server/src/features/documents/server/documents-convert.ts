import type { Prisma, PrismaClient } from "@cantiara/db";
import { z } from "zod";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { createRelationInTransaction } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { createWorkInTransaction } from "../../work-lifecycle/server/work-lifecycle";
import { getDocument } from "./documents";
import { type ImportedDiagramCopy, liveDiagramFence } from "./documents-live";
import {
	CONVERT_RECORD_KINDS,
	type ConvertRecordKind,
	DOCUMENTS_COPY,
	type DocumentRejectionReason,
	type DocumentView,
	ORIGINAL_MERMAID_OUTCOMES,
	type OriginalMermaidOutcome,
	presentDocumentBody,
	TECHNICAL_DIAGRAM_TARGET_TYPES,
	type TechnicalDiagramTargetType,
} from "./documents-model";

type PrismaTransaction = Prisma.TransactionClient;

const LINE_SPLIT = /\r?\n/;
const LEADING_LIST_MARK = /^[-*+\d.]+[ \t]+/;
const LIST_ITEM_TITLE = /^[ \t]*(?:[-*+]|\d+\.)[ \t]+(.+)$/;

const convertRecordKindSchema = z.enum(CONVERT_RECORD_KINDS);

export const previewConvertSelectionInputSchema = z.object({
	documentId: z.string().min(1),
	projectId: z.string().min(1),
	recordKind: convertRecordKindSchema,
	selectedText: z.string(),
	title: z.string().optional(),
	workspaceId: z.string().min(1),
});

export const convertSelectionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	payload: z.object({
		documentId: z.string().min(1),
		previewFingerprint: z.string().min(1),
		projectId: z.string().min(1),
		recordKind: convertRecordKindSchema,
		selectedText: z.string(),
		title: z.string().optional(),
	}),
	previewAcknowledged: z.boolean().optional(),
	workspaceId: z.string().min(1),
});

export const previewConvertListInputSchema = z.object({
	documentId: z.string().min(1),
	projectId: z.string().min(1),
	selectedText: z.string(),
	workspaceId: z.string().min(1),
});

export const convertListCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	payload: z.object({
		candidates: z.array(
			z.object({
				include: z.boolean(),
				title: z.string().min(1),
				type: z.string().min(1).optional(),
			})
		),
		documentId: z.string().min(1),
		previewFingerprint: z.string().min(1),
		projectId: z.string().min(1),
		selectedText: z.string(),
	}),
	previewAcknowledged: z.boolean().optional(),
	workspaceId: z.string().min(1),
});

export const pinVersionPinnedEvidenceCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	payload: z.object({
		documentId: z.string().min(1),
		selectedText: z.string().min(1),
		targetId: z.string().min(1),
		targetKind: z.literal("Work"),
	}),
	previewAcknowledged: z.boolean().optional(),
	workspaceId: z.string().min(1),
});

export const previewConvertMermaidInputSchema = z.object({
	blockSource: z.string(),
	documentId: z.string().min(1),
	originalBlockOutcome: z.enum(ORIGINAL_MERMAID_OUTCOMES).optional(),
	targetType: z.enum(TECHNICAL_DIAGRAM_TARGET_TYPES).optional(),
	workspaceId: z.string().min(1),
});

export const convertMermaidCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	payload: z.object({
		blockSource: z.string(),
		documentId: z.string().min(1),
		originalBlockOutcome: z.enum(ORIGINAL_MERMAID_OUTCOMES),
		previewFingerprint: z.string().min(1),
		targetType: z.enum(TECHNICAL_DIAGRAM_TARGET_TYPES),
	}),
	previewAcknowledged: z.boolean().optional(),
	workspaceId: z.string().min(1),
});

export interface ConvertSelectionPreview {
	bind: "evidence" | "origin";
	documentId: string;
	documentRevision: number;
	fingerprint: string;
	label: typeof DOCUMENTS_COPY.convertToRecord;
	projectId: string;
	recordKind: ConvertRecordKind;
	selectedText: string;
	title: string;
	versionPinnedEvidence: typeof DOCUMENTS_COPY.versionPinnedEvidence;
}

export interface ConvertListPreview {
	candidates: Array<{ include: boolean; title: string; type: string }>;
	documentId: string;
	documentRevision: number;
	fingerprint: string;
	label: typeof DOCUMENTS_COPY.convertInBulk;
	projectId: string;
}

export interface ConvertMermaidPreview {
	authorityMode: typeof DOCUMENTS_COPY.importedIndependentCopy;
	blockLocation: string;
	canvas: false;
	documentId: string;
	documentRevision: number;
	fingerprint: string;
	label: typeof DOCUMENTS_COPY.convertToTechnicalDiagram;
	origin: typeof RELATIONS_COPY.origin;
	originalBlockOutcome: OriginalMermaidOutcome;
	source: string;
	targetType: TechnicalDiagramTargetType;
	unparseableItems: string[];
}

export type ConvertCommittedResult =
	| {
			document: DocumentView;
			records: Array<{ id: string; kind: ConvertRecordKind; title: string }>;
	  }
	| {
			copy: ImportedDiagramCopy;
			document: DocumentView;
	  };

export type ConvertWriteOutcome =
	| (ConvertCommittedResult & { status: "committed" })
	| (ConvertCommittedResult & { status: "replayed" })
	| { reason: DocumentRejectionReason; status: "rejected" }
	| { conflict: "Conflict"; status: "conflict" };

export interface TechnicalDiagramImportStore {
	get: (id: string) => ImportedDiagramCopy | null;
	importCopy: (input: {
		blockLocation: string;
		source: string;
		sourceDocumentId: string;
		sourceRevision: number;
		targetType: TechnicalDiagramTargetType;
		title: string;
	}) => ImportedDiagramCopy;
}

export function createMemoryTechnicalDiagramImport(): TechnicalDiagramImportStore & {
	copies: ImportedDiagramCopy[];
} {
	const copies: ImportedDiagramCopy[] = [];
	return {
		copies,
		get(id) {
			return copies.find((copy) => copy.id === id) ?? null;
		},
		importCopy(input) {
			const copy: ImportedDiagramCopy = {
				authorityMode: DOCUMENTS_COPY.importedIndependentCopy,
				id: crypto.randomUUID(),
				title: input.title,
			};
			copies.push(copy);
			return copy;
		},
	};
}

export async function previewConvertSelection(
	prisma: PrismaClient,
	input: unknown
): Promise<
	| { preview: ConvertSelectionPreview; status: "ok" }
	| { reason: DocumentRejectionReason; status: "rejected" }
> {
	const parsed = previewConvertSelectionInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const document = await getDocument(
		prisma,
		parsed.data.documentId,
		parsed.data.workspaceId
	);
	if (!document) {
		return { reason: "document-not-found", status: "rejected" };
	}
	const selectedText = parsed.data.selectedText.trim();
	if (selectedText.length === 0) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return {
		preview: withFingerprint({
			bind: "evidence",
			documentId: document.id,
			documentRevision: document.revision,
			label: DOCUMENTS_COPY.convertToRecord,
			projectId: parsed.data.projectId,
			recordKind: parsed.data.recordKind,
			selectedText,
			title: parsed.data.title?.trim() || firstLineTitle(selectedText),
			versionPinnedEvidence: DOCUMENTS_COPY.versionPinnedEvidence,
		}),
		status: "ok",
	};
}

export async function convertSelection(
	prisma: PrismaClient,
	command: unknown
): Promise<ConvertWriteOutcome> {
	const parsed = convertSelectionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	if (parsed.data.payload.recordKind !== "Work") {
		return { reason: "unsupported-record-type", status: "rejected" };
	}
	const previewed = await previewConvertSelection(prisma, {
		documentId: parsed.data.payload.documentId,
		projectId: parsed.data.payload.projectId,
		recordKind: parsed.data.payload.recordKind,
		selectedText: parsed.data.payload.selectedText,
		title: parsed.data.payload.title,
		workspaceId: parsed.data.workspaceId,
	});
	if (previewed.status !== "ok") {
		return previewed;
	}
	const fingerprint = convertSelectionFingerprint(previewed.preview);
	if (parsed.data.payload.previewFingerprint !== fingerprint) {
		return { reason: "preview-mismatch", status: "rejected" };
	}
	return await applyWorkConverts(prisma, {
		actorId: parsed.data.actorId,
		baseRevision: parsed.data.baseRevision,
		documentId: parsed.data.payload.documentId,
		fingerprint,
		idempotencyKey: parsed.data.idempotencyKey,
		items: [
			{
				title: previewed.preview.title,
				type: undefined,
			},
		],
		projectId: parsed.data.payload.projectId,
		selectedText: previewed.preview.selectedText,
		workspaceId: parsed.data.workspaceId,
	});
}

export async function previewConvertList(
	prisma: PrismaClient,
	input: unknown
): Promise<
	| { preview: ConvertListPreview; status: "ok" }
	| { reason: DocumentRejectionReason; status: "rejected" }
> {
	const parsed = previewConvertListInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const document = await getDocument(
		prisma,
		parsed.data.documentId,
		parsed.data.workspaceId
	);
	if (!document) {
		return { reason: "document-not-found", status: "rejected" };
	}
	const titles = listItemTitles(parsed.data.selectedText);
	if (titles.length === 0) {
		return { reason: "list-required", status: "rejected" };
	}
	return {
		preview: withFingerprint({
			candidates: titles.map((title) => ({
				include: true,
				title,
				type: "Task",
			})),
			documentId: document.id,
			documentRevision: document.revision,
			label: DOCUMENTS_COPY.convertInBulk,
			projectId: parsed.data.projectId,
		}),
		status: "ok",
	};
}

export async function convertList(
	prisma: PrismaClient,
	command: unknown
): Promise<ConvertWriteOutcome> {
	const parsed = convertListCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	const previewed = await previewConvertList(prisma, {
		documentId: parsed.data.payload.documentId,
		projectId: parsed.data.payload.projectId,
		selectedText: parsed.data.payload.selectedText,
		workspaceId: parsed.data.workspaceId,
	});
	if (previewed.status !== "ok") {
		return previewed;
	}
	const fingerprint = convertListFingerprint(previewed.preview);
	if (parsed.data.payload.previewFingerprint !== fingerprint) {
		return { reason: "preview-mismatch", status: "rejected" };
	}
	const included = parsed.data.payload.candidates.filter(
		(candidate) => candidate.include
	);
	if (included.length === 0) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await applyWorkConverts(prisma, {
		actorId: parsed.data.actorId,
		baseRevision: parsed.data.baseRevision,
		documentId: parsed.data.payload.documentId,
		fingerprint,
		idempotencyKey: parsed.data.idempotencyKey,
		items: included,
		projectId: parsed.data.payload.projectId,
		selectedText: parsed.data.payload.selectedText,
		workspaceId: parsed.data.workspaceId,
	});
}

export async function pinVersionPinnedEvidence(
	prisma: PrismaClient,
	command: unknown
): Promise<ConvertWriteOutcome> {
	const parsed = pinVersionPinnedEvidenceCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	const document = await getDocument(
		prisma,
		parsed.data.payload.documentId,
		parsed.data.workspaceId
	);
	if (!document) {
		return { reason: "document-not-found", status: "rejected" };
	}
	if (document.revision !== parsed.data.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = `human:${parsed.data.actorId}:${parsed.data.idempotencyKey}`;
	try {
		return await prisma.$transaction((tx) =>
			pinEvidenceInTransaction(
				tx,
				parsed.data,
				document,
				commandKey,
				fingerprint
			)
		);
	} catch (error) {
		if (error instanceof ConvertBarrierError) {
			return error.outcome;
		}
		throw error;
	}
}

export async function previewConvertMermaid(
	prisma: PrismaClient,
	input: unknown
): Promise<
	| { preview: ConvertMermaidPreview; status: "ok" }
	| { reason: DocumentRejectionReason; status: "rejected" }
> {
	const parsed = previewConvertMermaidInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const document = await getDocument(
		prisma,
		parsed.data.documentId,
		parsed.data.workspaceId
	);
	if (!document) {
		return { reason: "document-not-found", status: "rejected" };
	}
	const location = mermaidBlockLocation(document.body, parsed.data.blockSource);
	if (!location) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const presented = presentDocumentBody(mermaidFence(parsed.data.blockSource));
	const mermaid = presented.blocks.find((block) => block.kind === "mermaid");
	const unparseableItems =
		mermaid && mermaid.kind === "mermaid" && mermaid.status === "error"
			? [parsed.data.blockSource.trim() || DOCUMENTS_COPY.couldNotRender]
			: [];
	return {
		preview: withFingerprint({
			authorityMode: DOCUMENTS_COPY.importedIndependentCopy,
			blockLocation: location,
			canvas: false as const,
			documentId: document.id,
			documentRevision: document.revision,
			label: DOCUMENTS_COPY.convertToTechnicalDiagram,
			origin: RELATIONS_COPY.origin,
			originalBlockOutcome: parsed.data.originalBlockOutcome ?? "independent",
			source: parsed.data.blockSource,
			targetType: parsed.data.targetType ?? "Technical Architecture",
			unparseableItems,
		}),
		status: "ok",
	};
}

export async function convertMermaidToTechnicalDiagram(
	prisma: PrismaClient,
	command: unknown,
	diagrams: TechnicalDiagramImportStore
): Promise<ConvertWriteOutcome> {
	const parsed = convertMermaidCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	const previewed = await previewConvertMermaid(prisma, {
		blockSource: parsed.data.payload.blockSource,
		documentId: parsed.data.payload.documentId,
		originalBlockOutcome: parsed.data.payload.originalBlockOutcome,
		targetType: parsed.data.payload.targetType,
		workspaceId: parsed.data.workspaceId,
	});
	if (previewed.status !== "ok") {
		return previewed;
	}
	const fingerprint = convertMermaidFingerprint(previewed.preview);
	if (parsed.data.payload.previewFingerprint !== fingerprint) {
		return { reason: "preview-mismatch", status: "rejected" };
	}
	if (previewed.preview.unparseableItems.length > 0) {
		return { reason: "broken-mermaid", status: "rejected" };
	}
	const commandKey = `human:${parsed.data.actorId}:${parsed.data.idempotencyKey}`;
	try {
		return await prisma.$transaction(async (tx) => {
			await lockWorkspace(tx, parsed.data.workspaceId);
			const replayed = await replayConvert(tx, commandKey, fingerprint);
			if (replayed) {
				return replayed;
			}
			const current = await tx.document.findUnique({
				where: { id: parsed.data.payload.documentId },
			});
			if (!current || current.workspaceId !== parsed.data.workspaceId) {
				return {
					reason: "document-not-found" as const,
					status: "rejected" as const,
				};
			}
			if (current.revision !== parsed.data.baseRevision) {
				return {
					conflict: MUTATION_COPY.conflict,
					status: "conflict" as const,
				};
			}
			const copy = diagrams.importCopy({
				blockLocation: previewed.preview.blockLocation,
				source: parsed.data.payload.blockSource,
				sourceDocumentId: current.id,
				sourceRevision: current.revision,
				targetType: parsed.data.payload.targetType,
				title: current.title,
			});
			const origin = await createRelationInTransaction(tx, {
				actorId: parsed.data.actorId,
				from: { id: current.id, kind: "Document" },
				idempotencyKey: `${parsed.data.idempotencyKey}:origin`,
				origin: HUMAN_ORIGIN,
				originLocation: {
					componentId: previewed.preview.blockLocation,
					ownerId: current.id,
					ownerKind: "Document",
					sourceVersion: String(current.revision),
				},
				previewAcknowledged: true,
				to: { id: copy.id, kind: "Technical Diagram" },
				type: RELATIONS_COPY.origin,
				viewerWorkspaceId: parsed.data.workspaceId,
			});
			if (origin.status !== "committed" && origin.status !== "replayed") {
				abortConvert({ reason: "invalid-command", status: "rejected" });
			}
			let nextBody = current.body;
			if (parsed.data.payload.originalBlockOutcome === "live-reference") {
				nextBody = current.body.replace(
					mermaidFence(parsed.data.payload.blockSource),
					liveDiagramFence(copy.id)
				);
			}
			const updated =
				nextBody === current.body
					? current
					: await tx.document.update({
							data: {
								body: nextBody,
								revision: current.revision + 1,
							},
							where: { id: current.id },
						});
			const view = toView(updated);
			await writeReceipt(tx, {
				actorId: parsed.data.actorId,
				commandKey,
				fingerprint,
				result: { copy, document: view, status: "committed" },
			});
			return { copy, document: view, status: "committed" as const };
		});
	} catch (error) {
		if (error instanceof ConvertBarrierError) {
			return error.outcome;
		}
		throw error;
	}
}

export function convertSelectionFingerprint(
	preview: ConvertSelectionPreview
): string {
	return hashPreview(preview);
}

export function convertListFingerprint(preview: ConvertListPreview): string {
	return hashPreview(preview);
}

export function convertMermaidFingerprint(
	preview: ConvertMermaidPreview
): string {
	return hashPreview(preview);
}

function withFingerprint<T extends object>(
	preview: T
): T & { fingerprint: string } {
	return { ...preview, fingerprint: payloadFingerprint(preview) };
}

function hashPreview(preview: { fingerprint: string }): string {
	const { fingerprint: _fingerprint, ...rest } = preview;
	return payloadFingerprint(rest);
}

async function applyWorkConverts(
	prisma: PrismaClient,
	input: {
		actorId: string;
		baseRevision: number;
		documentId: string;
		fingerprint: string;
		idempotencyKey: string;
		items: Array<{ title: string; type?: string }>;
		projectId: string;
		selectedText: string;
		workspaceId: string;
	}
): Promise<ConvertWriteOutcome> {
	const commandKey = `human:${input.actorId}:${input.idempotencyKey}`;
	try {
		return await prisma.$transaction(async (tx) => {
			await lockWorkspace(tx, input.workspaceId);
			const replayed = await replayConvert(tx, commandKey, input.fingerprint);
			if (replayed) {
				return replayed;
			}
			const current = await tx.document.findUnique({
				where: { id: input.documentId },
			});
			if (!current || current.workspaceId !== input.workspaceId) {
				return {
					reason: "document-not-found" as const,
					status: "rejected" as const,
				};
			}
			if (current.revision !== input.baseRevision) {
				return {
					conflict: MUTATION_COPY.conflict,
					status: "conflict" as const,
				};
			}
			const records: Array<{
				id: string;
				kind: ConvertRecordKind;
				title: string;
			}> = [];
			for (const [index, item] of input.items.entries()) {
				records.push(
					// biome-ignore lint/performance/noAwaitInLoops: bulk convert must abort the same transaction before later rows write.
					await createConvertedWork(tx, {
						actorId: input.actorId,
						documentId: current.id,
						documentRevision: current.revision,
						idempotencyKey: input.idempotencyKey,
						index,
						projectId: input.projectId,
						title: item.title,
						type: item.type,
						workspaceId: input.workspaceId,
					})
				);
			}
			const view = toView(current);
			await writeReceipt(tx, {
				actorId: input.actorId,
				commandKey,
				fingerprint: input.fingerprint,
				result: { document: view, records, status: "committed" },
			});
			return { document: view, records, status: "committed" as const };
		});
	} catch (error) {
		if (error instanceof ConvertBarrierError) {
			return error.outcome;
		}
		throw error;
	}
}

async function pinEvidenceInTransaction(
	tx: PrismaTransaction,
	command: z.infer<typeof pinVersionPinnedEvidenceCommandSchema>,
	document: DocumentView,
	commandKey: string,
	fingerprint: string
): Promise<ConvertWriteOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayConvert(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const origin = await createRelationInTransaction(tx, {
		actorId: command.actorId,
		from: { id: document.id, kind: "Document" },
		idempotencyKey: `${command.idempotencyKey}:origin`,
		origin: HUMAN_ORIGIN,
		originLocation: {
			componentId: "version-pinned-evidence",
			ownerId: document.id,
			ownerKind: "Document",
			sourceVersion: String(document.revision),
		},
		previewAcknowledged: true,
		to: {
			id: command.payload.targetId,
			kind: command.payload.targetKind,
		},
		type: RELATIONS_COPY.origin,
		viewerWorkspaceId: command.workspaceId,
	});
	if (origin.status !== "committed" && origin.status !== "replayed") {
		return { reason: "target-not-found", status: "rejected" };
	}
	const evidence = await createRelationInTransaction(tx, {
		actorId: command.actorId,
		from: { id: document.id, kind: "Document" },
		idempotencyKey: `${command.idempotencyKey}:evidence`,
		origin: HUMAN_ORIGIN,
		previewAcknowledged: true,
		to: {
			id: command.payload.targetId,
			kind: command.payload.targetKind,
		},
		type: RELATIONS_COPY.evidence,
		viewerWorkspaceId: command.workspaceId,
	});
	if (evidence.status !== "committed" && evidence.status !== "replayed") {
		return { reason: "target-not-found", status: "rejected" };
	}
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		result: {
			document,
			records: [
				{
					id: command.payload.targetId,
					kind: "Work",
					title: DOCUMENTS_COPY.versionPinnedEvidence,
				},
			],
			status: "committed",
		},
	});
	return {
		document,
		records: [
			{
				id: command.payload.targetId,
				kind: "Work",
				title: DOCUMENTS_COPY.versionPinnedEvidence,
			},
		],
		status: "committed",
	};
}

async function replayConvert(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<ConvertWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedConvert(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { ...stored, status: "replayed" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		result: ConvertCommittedResult & { status: "committed" };
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision:
				"document" in input.result ? input.result.document.revision : 0,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.result),
			targetId: input.result.document.id,
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

function storedConvert(text: string): ConvertCommittedResult | null {
	try {
		const parsed: unknown = JSON.parse(text);
		if (!parsed || typeof parsed !== "object" || !("document" in parsed)) {
			return null;
		}
		return parsed as ConvertCommittedResult;
	} catch {
		return null;
	}
}

function toView(row: {
	archivedAt?: Date | null;
	body: string;
	folderId?: string | null;
	id: string;
	parentId?: string | null;
	projectId: string | null;
	revision: number;
	scopeKind: string;
	title: string;
	type: string;
}): DocumentView {
	return {
		archived: (row.archivedAt ?? null) !== null,
		body: row.body,
		childCards: [],
		folderId: row.folderId ?? null,
		id: row.id,
		inDocTags: [],
		liveFilePath: null,
		originDocumentId: null,
		parentId: row.parentId ?? null,
		revision: row.revision,
		scope:
			row.scopeKind === "project" && row.projectId
				? { kind: "project", projectId: row.projectId }
				: { kind: "personal-wiki" },
		title: row.title,
		type: row.type as DocumentView["type"],
	};
}

async function createConvertedWork(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		documentId: string;
		documentRevision: number;
		idempotencyKey: string;
		index: number;
		projectId: string;
		title: string;
		type?: string;
		workspaceId: string;
	}
): Promise<{ id: string; kind: ConvertRecordKind; title: string }> {
	const created = await createWorkInTransaction(tx, {
		actorId: input.actorId,
		idempotencyKey: `${input.idempotencyKey}:work:${input.index}`,
		origin: HUMAN_ORIGIN,
		payload: {
			projectId: input.projectId,
			title: input.title,
			type: input.type,
		},
	});
	if (created.status !== "committed" && created.status !== "replayed") {
		abortConvert({
			reason: "partial-success-forbidden",
			status: "rejected",
		});
	}
	const origin = await createRelationInTransaction(tx, {
		actorId: input.actorId,
		from: { id: input.documentId, kind: "Document" },
		idempotencyKey: `${input.idempotencyKey}:origin:${input.index}`,
		origin: HUMAN_ORIGIN,
		originLocation: {
			componentId: `selection:${input.index}`,
			ownerId: input.documentId,
			ownerKind: "Document",
			sourceVersion: String(input.documentRevision),
		},
		previewAcknowledged: true,
		to: { id: created.work.id, kind: "Work" },
		type: RELATIONS_COPY.origin,
		viewerWorkspaceId: input.workspaceId,
	});
	if (origin.status !== "committed" && origin.status !== "replayed") {
		abortConvert({
			reason: "partial-success-forbidden",
			status: "rejected",
		});
	}
	const evidence = await createRelationInTransaction(tx, {
		actorId: input.actorId,
		from: { id: input.documentId, kind: "Document" },
		idempotencyKey: `${input.idempotencyKey}:evidence:${input.index}`,
		origin: HUMAN_ORIGIN,
		previewAcknowledged: true,
		to: { id: created.work.id, kind: "Work" },
		type: RELATIONS_COPY.evidence,
		viewerWorkspaceId: input.workspaceId,
	});
	if (evidence.status !== "committed" && evidence.status !== "replayed") {
		abortConvert({
			reason: "partial-success-forbidden",
			status: "rejected",
		});
	}
	return {
		id: created.work.id,
		kind: "Work",
		title: created.work.title,
	};
}

function firstLineTitle(text: string): string {
	const line =
		text.split(LINE_SPLIT, 1)[0]?.replace(LEADING_LIST_MARK, "") ?? "";
	return line.trim() || "Untitled";
}

function listItemTitles(text: string): string[] {
	return text.split(LINE_SPLIT).flatMap((line) => {
		const title = LIST_ITEM_TITLE.exec(line)?.[1]?.trim();
		return title ? [title] : [];
	});
}

function mermaidFence(source: string): string {
	return `\`\`\`mermaid\n${source}\n\`\`\``;
}

function mermaidBlockLocation(body: string, source: string): string | null {
	const fence = mermaidFence(source);
	const index = body.indexOf(fence);
	if (index < 0) {
		return null;
	}
	return `mermaid:${index}`;
}

class ConvertBarrierError extends Error {
	readonly outcome: ConvertWriteOutcome;

	constructor(outcome: ConvertWriteOutcome) {
		super("convert-barrier");
		this.outcome = outcome;
	}
}

function abortConvert(outcome: ConvertWriteOutcome): never {
	throw new ConvertBarrierError(outcome);
}
