import type { PrismaClient } from "@cantiara/db";

import { createFeedback } from "../../feedback/server/feedback";
import { promoteCaptureAttachment } from "../../file-attachments/server/file-attachments";
import { createPrismaCaptureStagingSource } from "../../file-attachments/server/file-attachments-capture-staging";
import { FILE_SCOPE_KIND } from "../../file-attachments/server/file-attachments-model";
import {
	lockMutation,
	type MutationDb,
	readDurableReceipt,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import {
	HUMAN_ORIGIN,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { withPrismaWriteRetry } from "../../mutation-core/server/prisma-write-retry";
import { createRelation } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { convertCaptureToWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	createBulkSenseMaking,
	type NameBulkClusterOutcome,
	type PlaceInBulkOutcome,
} from "./capture-bulk-sense-making";
import {
	BULK_SURFACE_EXCLUSION,
	type BulkSenseMakingView,
	type BulkSurfaceEligibility,
	CAPTURE_INBOX_COPY,
	CAPTURE_SURFACE_EXCLUSION,
	type CaptureAttachmentView,
	type CaptureInboxItemView,
	type CaptureInboxScope,
	type CaptureSurfaceEligibility,
	formatTemplateBody,
	type MiniTemplateId,
	miniTemplateCatalog,
	templateFields,
	toItemView,
} from "./capture-inbox-model";
import {
	deriveCaptureStagingRootKey,
	envelopeSeal,
} from "./capture-staging-crypto";
import {
	type CaptureStagingStore,
	createPrismaCaptureStagingStore,
} from "./capture-staging-store";
import {
	type AttachOutcome,
	type AttachPreview,
	type BindRelation,
	type ConvertAdapter,
	type ConvertOutcome,
	type ConvertPreview,
	type ConvertResult,
	type ConvertTargetKind,
	createRecordBinder,
	createTriageExits,
	type DeleteOutcome,
	type FileAttachmentFinalizeAdapter,
	type FileAttachmentPromotionCommand,
	type FileAttachmentPromotionResult,
	handOffConvert,
	type MergeUndoPreview,
	type RecordBinder,
	type SimilarMatch,
	type SimilarSuggestions,
	TRIAGE_EXIT_CATALOG,
	type TriageExit,
	type UndoMergeOutcome,
} from "./capture-triage-exits";
import {
	goBackSequentialFocus,
	nextSequentialFocus,
	type SequentialTriageView,
	sequentialTriageView,
	startSequentialFocus,
} from "./sequential-triage";
import { createWebCapture, type WebCapture } from "./web-capture";
import { clipperBrowserFamilies, WEB_CAPTURE_COPY } from "./web-capture-model";

export interface WorkCreateCommand {
	actorId: string;
	fields: Record<string, string>;
	idempotencyKey: string;
	projectId: string;
	text: string;
	workType: "bug";
}

export interface WorkCreateResult {
	handedOff: true;
	workKey: null;
}

export type WorkCreateAdapter = (
	command: WorkCreateCommand
) => Promise<WorkCreateResult>;

export interface CaptureAttachmentInput {
	bytes: Uint8Array;
	contentType: string;
	filename: string;
}

export interface SaveCaptureInput {
	actorId: string;
	attachment?: CaptureAttachmentInput;
	attachmentRef?: string | null;
	fields?: Record<string, string>;
	idempotencyKey: string;
	link?: string;
	origin?: string;
	projectId?: string;
	template?: MiniTemplateId;
	text?: string;
	workspaceId: string;
}

export type SaveCaptureOutcome =
	| {
			item: CaptureInboxItemView;
			lastSuccessfulSaveAt: Date;
			mainRecord: null;
			status: "saved";
	  }
	| { reason: "capture-save-finalization-uncertain"; status: "refused" }
	| { queued: false; reason: "offline"; status: "refused" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" };

export interface CreateBugInput {
	actorId: string;
	fields?: Record<string, string>;
	idempotencyKey: string;
	projectId: string;
	template?: MiniTemplateId;
	text?: string;
	workspaceId: string;
}

export type CreateBugOutcome =
	| {
			inboxItem: null;
			lastSuccessfulSaveAt: Date;
			status: "handed-off";
			workCreate: WorkCreateResult;
	  }
	| { queued: false; reason: "offline"; status: "refused" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| {
			reason: typeof CAPTURE_INBOX_COPY.createBugNeedsProjectAndBugCapture;
			status: "unavailable";
	  };

export interface CaptureInbox {
	advanceTime: (instant: Date) => void;
	attach: (input: {
		idempotencyKey: string;
		itemId: string;
		previewed: boolean;
		relation: BindRelation;
		targetId: string;
	}) => Promise<AttachOutcome>;
	attachment: (itemId: string) => Promise<CaptureAttachmentView | null>;
	backgroundScan: WebCapture["backgroundScan"];
	bulkSenseMaking: () => Promise<BulkSenseMakingView>;
	bulkSurfaces: () => BulkSurfaceEligibility;
	claimsSafariClipper: WebCapture["claimsSafariClipper"];
	clip: WebCapture["clip"];
	clipArchive: WebCapture["clipArchive"];
	clipperBrowserFamilies: WebCapture["clipperBrowserFamilies"];
	contentFingerprint: WebCapture["contentFingerprint"];
	convert: (input: {
		idempotencyKey: string;
		itemId: string;
		previewed: boolean;
		targetKind: ConvertTargetKind;
	}) => Promise<ConvertOutcome>;
	createBug: (
		input: Omit<CreateBugInput, "actorId" | "workspaceId">
	) => Promise<CreateBugOutcome>;
	deleteItem: (input: {
		idempotencyKey: string;
		itemId: string;
	}) => Promise<DeleteOutcome>;
	exitSequentialTriage: () => Promise<
		SequentialTriageView<CaptureInboxItemView>
	>;
	exportRows: () => readonly [];
	finalizeWebCapture: WebCapture["finalizeWebCapture"];
	goBackSequentialTriage: () => Promise<
		SequentialTriageView<CaptureInboxItemView>
	>;
	historyCollection: WebCapture["historyCollection"];
	issuePairingCode: WebCapture["issuePairingCode"];
	kaynakRecords: WebCapture["kaynakRecords"];
	lastSuccessfulSaveAt: () => Date | null;
	list: (scope: CaptureInboxScope) => Promise<CaptureInboxItemView[]>;
	listAll: () => Promise<CaptureInboxItemView[]>;
	listExtensionLinks: WebCapture["listExtensionLinks"];
	livePageCopies: WebCapture["livePageCopies"];
	logs: WebCapture["logs"];
	nameBulkCluster: (input: {
		idempotencyKey: string;
		name: string;
	}) => Promise<NameBulkClusterOutcome>;
	pageInjection: WebCapture["pageInjection"];
	pair: WebCapture["pair"];
	placeInBulk: (input: {
		clusterId: string | null;
		idempotencyKey: string;
		itemId: string;
		position: { x: number; y: number };
	}) => Promise<PlaceInBulkOutcome>;
	previewAttach: (input: {
		itemId: string;
		relation: BindRelation;
		targetId: string;
	}) => Promise<AttachPreview | { status: "not-found" }>;
	previewConvert: (input: {
		itemId: string;
		targetKind: ConvertTargetKind;
	}) => Promise<ConvertPreview | { status: "not-found" }>;
	previewUndoMerge: (input: {
		mergeId: string;
	}) => Promise<MergeUndoPreview | { status: "not-found" }>;
	previewWebCapture: WebCapture["previewWebCapture"];
	revokeAllExtensionLinks: WebCapture["revokeAllExtensionLinks"];
	revokeExtensionLink: WebCapture["revokeExtensionLink"];
	save: (
		input: Omit<SaveCaptureInput, "actorId" | "workspaceId">
	) => Promise<SaveCaptureOutcome>;
	searchCaptureTargets: WebCapture["searchCaptureTargets"];
	searchHits: () => readonly [];
	sendPayload: WebCapture["sendPayload"];
	sendWebCapture: WebCapture["sendWebCapture"];
	sequentialTriage: () => Promise<SequentialTriageView<CaptureInboxItemView>>;
	sharedMediaLibrary: () => readonly [];
	stageAttachment: (input: {
		attachment: CaptureAttachmentInput;
		idempotencyKey: string;
		itemId: string;
	}) => Promise<
		| {
				attachment: CaptureAttachmentView;
				lastSuccessfulSaveAt: Date;
				status: "staged";
		  }
		| { queued: false; reason: "offline"; status: "refused" }
		| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
		| { status: "not-found" }
	>;
	stageWebCapture: WebCapture["stageWebCapture"];
	startSequentialTriage: (input?: {
		itemId?: string;
	}) => Promise<SequentialTriageView<CaptureInboxItemView>>;
	suggestSimilar: (input: {
		itemId: string;
	}) => Promise<SimilarSuggestions | { status: "not-found" }>;
	surfaces: (itemId: string) => Promise<CaptureSurfaceEligibility | null>;
	triageExits: () => readonly TriageExit[];
	undoMerge: (input: {
		idempotencyKey: string;
		mergeId: string;
	}) => Promise<UndoMergeOutcome>;
	unsavedRisk: (
		hasUnsavedChanges: boolean
	) => typeof CAPTURE_INBOX_COPY.unsavedChangesMayBeLost | null;
	visibleFileAttachments: () => readonly [];
	wideReadWarning: WebCapture["wideReadWarning"];
	writeQueue: () => readonly never[];
}

export function handOffWorkCreate(): Promise<WorkCreateResult> {
	return Promise.resolve({ handedOff: true, workKey: null });
}

function reviveDate(value: Date | string): Date {
	return value instanceof Date ? value : new Date(value);
}

function reviveSaveOutcome(outcome: SaveCaptureOutcome): SaveCaptureOutcome {
	if (outcome.status !== "saved") {
		return outcome;
	}
	return {
		...outcome,
		item: {
			...outcome.item,
			capturedAt: reviveDate(outcome.item.capturedAt),
		},
		lastSuccessfulSaveAt: reviveDate(outcome.lastSuccessfulSaveAt),
	};
}

function reviveCreateBugOutcome(outcome: CreateBugOutcome): CreateBugOutcome {
	if (outcome.status !== "handed-off") {
		return outcome;
	}
	return {
		...outcome,
		lastSuccessfulSaveAt: reviveDate(outcome.lastSuccessfulSaveAt),
	};
}

function openItemWhere(workspaceId: string) {
	return {
		consumedAt: null,
		workspaceId,
	};
}

function attachmentFingerprint(attachment: CaptureAttachmentInput | undefined) {
	if (!attachment) {
		return "";
	}
	return {
		byteLength: attachment.bytes.byteLength,
		contentType: attachment.contentType,
		filename: attachment.filename,
		payloadFingerprint: payloadFingerprint(
			Buffer.from(attachment.bytes).toString("base64")
		),
	};
}

function saveCommandPayload(
	command: Omit<SaveCaptureInput, "actorId" | "workspaceId">
) {
	return {
		attachment: attachmentFingerprint(command.attachment),
		attachmentRef: command.attachmentRef ?? "",
		fields: command.fields ?? {},
		link: command.link ?? "",
		origin: command.origin ?? "",
		projectId: command.projectId ?? "",
		template: command.template ?? "",
		text: command.text ?? "",
	};
}

const STAGING_INCLUDE = { staging: true } as const;

async function resolveCaptureProjectId(
	prisma: MutationDb,
	workspaceId: string,
	projectId: string | null | undefined
): Promise<string | null> {
	const trimmed = projectId?.trim() ?? "";
	if (!trimmed) {
		return null;
	}
	const match = await prisma.project.findFirst({
		where: {
			OR: [{ id: trimmed }, { name: { equals: trimmed, mode: "insensitive" } }],
			workspaceId,
		},
	});
	return match?.id ?? trimmed;
}

async function insertCaptureItem(
	prisma: MutationDb,
	input: {
		actorId: string;
		capturedAt: Date;
		command: Omit<SaveCaptureInput, "actorId" | "workspaceId">;
		id?: string;
		workspaceId: string;
	}
): Promise<CaptureInboxItemView> {
	const template = input.command.template ?? null;
	const fields = templateFields(template, input.command.fields);
	const body = template
		? formatTemplateBody(template, fields)
		: (input.command.text ?? "");
	const projectId = await resolveCaptureProjectId(
		prisma,
		input.workspaceId,
		input.command.projectId
	);
	const row = await prisma.captureInboxItem.create({
		data: {
			attachmentRef: input.command.attachmentRef ?? null,
			body,
			capturedAt: input.capturedAt,
			fieldsText: JSON.stringify(fields),
			id: input.id ?? crypto.randomUUID(),
			link: input.command.link ?? "",
			origin: input.command.origin ?? "",
			ownerId: input.actorId,
			projectId,
			template,
			workspaceId: input.workspaceId,
		},
		include: STAGING_INCLUDE,
	});
	return toItemView(row);
}

function stagingRootKey(secret?: string): Buffer {
	if (secret && secret.length >= 32) {
		return deriveCaptureStagingRootKey(secret);
	}
	const fromEnv = process.env.BETTER_AUTH_SECRET;
	if (fromEnv && fromEnv.length >= 32) {
		return deriveCaptureStagingRootKey(fromEnv);
	}
	throw new Error("Capture staging root key is required");
}

const PENDING_SAVE = "__pending_capture_save__";

function pendingSaveItemId(resultValue: string): string | null {
	try {
		const value = JSON.parse(resultValue) as {
			itemId?: unknown;
			status?: unknown;
		};
		return value.status === PENDING_SAVE && typeof value.itemId === "string"
			? value.itemId
			: null;
	} catch {
		return null;
	}
}

function pendingStageAttachmentId(resultValue: string): string | null {
	try {
		const value = JSON.parse(resultValue) as {
			stagingId?: unknown;
			status?: unknown;
		};
		return value.status === "__pending_capture_stage_attachment__" &&
			typeof value.stagingId === "string"
			? value.stagingId
			: null;
	} catch {
		return null;
	}
}

function isUniqueConstraint(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as { code?: unknown }).code === "P2002"
	);
}

async function waitForSaveReceipt(
	prisma: PrismaClient,
	commandKey: string,
	payload: unknown
): Promise<SaveCaptureOutcome | "retry" | "conflict"> {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: polling is intentionally sequential.
		const receipt = await readDurableReceipt(prisma, commandKey, payload);
		if (!receipt) {
			return "retry";
		}
		if (receipt.kind === "conflict") {
			return "conflict";
		}
		if (!pendingSaveItemId(receipt.resultValue)) {
			return reviveSaveOutcome(
				JSON.parse(receipt.resultValue) as SaveCaptureOutcome
			);
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error("capture-save-finalization-uncertain");
}

async function persistStaging(input: {
	attachment: CaptureAttachmentInput;
	inboxItemId: string;
	rootKey: Uint8Array;
	stagingId?: string;
	store: CaptureStagingStore;
	workspaceId: string;
}): Promise<{ attachment: CaptureAttachmentView; stagingId: string }> {
	const sealed = envelopeSeal(input.attachment.bytes, input.rootKey);
	const stagingId = input.stagingId ?? crypto.randomUUID();
	await input.store.put({
		byteLength: input.attachment.bytes.byteLength,
		ciphertext: sealed.ciphertext,
		contentType: input.attachment.contentType,
		filename: input.attachment.filename,
		id: stagingId,
		inboxItemId: input.inboxItemId,
		keyVersion: sealed.keyVersion,
		workspaceId: input.workspaceId,
		wrappedDek: sealed.wrappedDek,
	});
	return {
		attachment: {
			filename: input.attachment.filename,
			itemId: input.inboxItemId,
			kind: "capture-attachment",
		},
		stagingId,
	};
}

type StageAttachmentReservation =
	| { kind: "reserved"; stagingId: string }
	| { kind: "replay"; resultValue: string }
	| { kind: "conflict" }
	| { kind: "pending" };

async function reserveStageAttachment(input: {
	actorId: string;
	itemId: string;
	payload: unknown;
	commandKey: string;
	prisma: PrismaClient;
}): Promise<StageAttachmentReservation> {
	return await input.prisma.$transaction(async (tx) => {
		await lockMutation(
			tx,
			`capture-stage-attachment:${input.itemId}:${input.commandKey}`
		);
		const existing = await readDurableReceipt(
			tx,
			input.commandKey,
			input.payload
		);
		if (existing?.kind === "conflict") {
			return { kind: "conflict" };
		}
		if (existing?.kind === "replay") {
			return pendingStageAttachmentId(existing.resultValue)
				? { kind: "pending" }
				: { kind: "replay", resultValue: existing.resultValue };
		}
		const stagingId = crypto.randomUUID();
		await writeDurableReceipt(tx, {
			actorId: input.actorId,
			commandKey: input.commandKey,
			kind: "stage-attachment",
			payload: input.payload,
			resultValue: JSON.stringify({
				stagingId,
				status: "__pending_capture_stage_attachment__",
			}),
			targetId: input.itemId,
		});
		return { kind: "reserved", stagingId };
	});
}

async function waitForStageAttachmentReceipt(
	prisma: PrismaClient,
	commandKey: string,
	payload: unknown
): Promise<StageAttachmentReservation> {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: polling is intentionally sequential.
		const receipt = await readDurableReceipt(prisma, commandKey, payload);
		if (receipt?.kind === "conflict") {
			return { kind: "conflict" };
		}
		if (receipt?.kind === "replay") {
			const stagingId = pendingStageAttachmentId(receipt.resultValue);
			if (!stagingId) {
				return { kind: "replay", resultValue: receipt.resultValue };
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error("capture-stage-attachment-uncertain");
}

async function markCaptureCleanupPending(
	prisma: PrismaClient,
	itemId: string,
	workspaceId: string,
	error: unknown
): Promise<void> {
	await prisma.captureInboxItem.updateMany({
		data: {
			stagingCleanupAt: new Date(),
			stagingCleanupError:
				error instanceof Error ? error.message : "cleanup-failed",
			stagingCleanupStatus: "pending",
		},
		where: { id: itemId, workspaceId },
	});
}

async function clearPendingStageReceipt(
	prisma: PrismaClient,
	commandKey: string
): Promise<void> {
	const receipt = await prisma.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (receipt && pendingStageAttachmentId(receipt.resultValue)) {
		await prisma.mutationReceipt.delete({ where: { commandKey } });
	}
}

async function compensateStageAttachmentFailure(input: {
	commandKey: string;
	inboxItemId: string;
	prisma: PrismaClient;
	store: CaptureStagingStore;
	workspaceId: string;
}): Promise<void> {
	await markCaptureCleanupPending(
		input.prisma,
		input.inboxItemId,
		input.workspaceId,
		new Error("capture-stage-attachment-failed")
	);
	try {
		await input.store.deleteByInboxItemId(input.inboxItemId);
		await input.prisma.captureInboxItem.updateMany({
			data: {
				stagingCleanupAt: new Date(),
				stagingCleanupError: null,
				stagingCleanupStatus: null,
			},
			where: { id: input.inboxItemId, workspaceId: input.workspaceId },
		});
	} catch (cleanupError) {
		await markCaptureCleanupPending(
			input.prisma,
			input.inboxItemId,
			input.workspaceId,
			cleanupError
		);
	}
	await clearPendingStageReceipt(input.prisma, input.commandKey);
}

async function loadItemView(
	prisma: PrismaClient,
	input: { itemId: string; workspaceId: string }
): Promise<CaptureInboxItemView | null> {
	const row = await prisma.captureInboxItem.findFirst({
		include: STAGING_INCLUDE,
		where: {
			...openItemWhere(input.workspaceId),
			id: input.itemId,
		},
	});
	return row ? toItemView(row) : null;
}

function fileAttachmentPromoteAdapter(
	prisma: PrismaClient,
	workspaceId: string,
	rootKey: Uint8Array
): FileAttachmentFinalizeAdapter {
	const captureStaging = createPrismaCaptureStagingSource(prisma, rootKey);
	return async (
		command: FileAttachmentPromotionCommand
	): Promise<FileAttachmentPromotionResult> => {
		const { kind, projectId } = command.targetScope;
		if (kind === "project" && !projectId) {
			return { status: "failed", visibleAttachment: null };
		}
		const resolvedProjectId =
			kind === "project"
				? await resolveCaptureProjectId(prisma, workspaceId, projectId)
				: null;
		if (kind === "project" && !resolvedProjectId) {
			return { status: "failed", visibleAttachment: null };
		}
		const outcome = await promoteCaptureAttachment(
			prisma,
			{
				actorId: command.actorId,
				idempotencyKey: command.idempotencyKey,
				origin: "human",
				payload: {
					inboxItemId: command.item.id,
					scope:
						kind === "project" && resolvedProjectId
							? {
									kind: FILE_SCOPE_KIND.project,
									projectId: resolvedProjectId,
								}
							: { kind: FILE_SCOPE_KIND.personalWiki },
					title: captureMessageTitle(command.item.body),
				},
				workspaceId,
			},
			{ captureStaging }
		);
		if (outcome.status === "committed" || outcome.status === "replayed") {
			return {
				fileAttachmentId: outcome.file.id,
				status: "promoted",
				visibleAttachment: null,
			};
		}
		return {
			...(outcome.status === "rejected" || outcome.status === "conflict"
				? { explanation: outcome.explanation }
				: {}),
			status: "failed",
			visibleAttachment: null,
		};
	};
}

async function convertCaptureToFeedback(
	prisma: PrismaClient,
	workspaceId: string,
	command: Parameters<ConvertAdapter>[0]
): Promise<ConvertResult> {
	const projectId =
		command.item.scope.kind === "project"
			? await resolveCaptureProjectId(
					prisma,
					workspaceId,
					command.item.scope.projectId
				)
			: null;
	const originalMessage = (
		command.item.fields.feedback ?? command.item.body
	).trim();
	const channel = command.item.fields.channel?.trim() ?? "";
	if (!(projectId && originalMessage && channel)) {
		return {
			handedOff: false,
			recordId: null,
			targetKind: "feedback",
		};
	}
	const outcome = await createFeedback(prisma, {
		actorId: command.actorId,
		idempotencyKey: command.idempotencyKey,
		origin: "human",
		payload: {
			channel,
			occurredAt: command.item.capturedAt.toISOString(),
			originalMessage,
			projectId,
			url: command.item.link,
		},
	});
	if (outcome.status !== "committed" && outcome.status !== "replayed") {
		return {
			handedOff: false,
			recordId: null,
			targetKind: "feedback",
		};
	}
	await createRelation(prisma, {
		actorId: command.actorId,
		from: { id: command.item.id, kind: "Capture" },
		idempotencyKey: `${command.idempotencyKey}:origin`,
		origin: HUMAN_ORIGIN,
		previewAcknowledged: true,
		to: { id: outcome.feedback.id, kind: "Feedback" },
		type: RELATIONS_COPY.origin,
		viewerWorkspaceId: workspaceId,
	});
	return {
		handedOff: true,
		recordId: outcome.feedback.id,
		targetKind: "feedback",
	};
}

function captureMessageTitle(body: string): string | undefined {
	const title = body.trim();
	return title ? title : undefined;
}

export function captureConvertAdapter(
	prisma: PrismaClient,
	workspaceId: string
): ConvertAdapter {
	return async (command) => {
		if (command.targetKind === "feedback") {
			return await convertCaptureToFeedback(prisma, workspaceId, command);
		}
		if (command.targetKind !== "work") {
			return {
				handedOff: true,
				recordId: null,
				targetKind: command.targetKind,
			};
		}
		const projectId =
			command.item.scope.kind === "project"
				? await resolveCaptureProjectId(
						prisma,
						workspaceId,
						command.item.scope.projectId
					)
				: null;
		const title = captureMessageTitle(command.item.body);
		if (!(projectId && title)) {
			return {
				handedOff: false,
				recordId: null,
				targetKind: "work",
			};
		}
		const outcome = await convertCaptureToWork(prisma, {
			actorId: command.actorId,
			idempotencyKey: command.idempotencyKey,
			origin: "human",
			payload: {
				projectId,
				source: "capture-convert",
				title,
				type: command.item.template === "bug-capture" ? "Bug" : undefined,
			},
		});
		if (outcome.status === "committed" || outcome.status === "replayed") {
			return {
				handedOff: true,
				recordId: outcome.work.id,
				targetKind: "work",
			};
		}
		return {
			handedOff: false,
			recordId: null,
			targetKind: "work",
		};
	};
}

export function createCaptureInbox(input: {
	actorId: string;
	binder?: RecordBinder;
	clock?: { now: () => Date };
	connected?: boolean;
	convertCreate?: ConvertAdapter;
	fileAttachmentFinalize?: FileAttachmentFinalizeAdapter;
	prisma: PrismaClient;
	similarRecords?: (item: CaptureInboxItemView) => SimilarMatch[];
	stagingRootKey?: Uint8Array;
	stagingStore?: CaptureStagingStore;
	workCreate?: WorkCreateAdapter;
	workspaceId: string;
}): CaptureInbox {
	let now = input.clock ? input.clock.now() : new Date();
	const clock = { now: () => now };
	const workCreate = input.workCreate ?? handOffWorkCreate;
	const convertCreate = input.convertCreate ?? handOffConvert;
	const binder = input.binder ?? createRecordBinder([]);
	const similarRecords = input.similarRecords ?? (() => []);
	const store =
		input.stagingStore ?? createPrismaCaptureStagingStore(input.prisma);
	const rootKey = input.stagingRootKey ?? stagingRootKey();
	const fileAttachmentFinalize =
		input.fileAttachmentFinalize ??
		fileAttachmentPromoteAdapter(input.prisma, input.workspaceId, rootKey);
	let lastSuccessfulSaveAt: Date | null = null;
	let sequentialFocusedId: string | null = null;
	const connected = () => input.connected !== false;
	const logs: string[] = [];
	const webCapture = createWebCapture({
		actorId: input.actorId,
		clock,
		connected,
		logs,
		onSaved(savedAt) {
			lastSuccessfulSaveAt = savedAt;
		},
		prisma: input.prisma,
		workspaceId: input.workspaceId,
	});
	async function deleteStaging(inboxItemId: string) {
		await input.prisma.captureInboxItem.updateMany({
			data: {
				stagingCleanupAt: clock.now(),
				stagingCleanupError: null,
				stagingCleanupStatus: "pending",
			},
			where: { id: inboxItemId, workspaceId: input.workspaceId },
		});
		try {
			await store.deleteByInboxItemId(inboxItemId);
			await input.prisma.captureInboxItem.updateMany({
				data: {
					stagingCleanupAt: clock.now(),
					stagingCleanupError: null,
					stagingCleanupStatus: null,
				},
				where: { id: inboxItemId, workspaceId: input.workspaceId },
			});
		} catch (error) {
			await input.prisma.captureInboxItem.updateMany({
				data: {
					stagingCleanupAt: clock.now(),
					stagingCleanupError:
						error instanceof Error ? error.message : "cleanup-failed",
				},
				where: { id: inboxItemId, workspaceId: input.workspaceId },
			});
			throw error;
		}
	}
	const triage = createTriageExits({
		actorId: input.actorId,
		binder,
		clock,
		connected,
		convertCreate,
		deleteStaging,
		fileAttachmentFinalize,
		prisma: input.prisma,
		similarRecords,
		toItemView,
		workspaceId: input.workspaceId,
	});
	async function listAllItems(): Promise<CaptureInboxItemView[]> {
		const rows = await input.prisma.captureInboxItem.findMany({
			include: STAGING_INCLUDE,
			orderBy: [{ capturedAt: "asc" }, { id: "asc" }],
			where: openItemWhere(input.workspaceId),
		});
		return rows.map(toItemView);
	}
	const bulk = createBulkSenseMaking({
		actorId: input.actorId,
		connected,
		listAll: listAllItems,
		prisma: input.prisma,
		workspaceId: input.workspaceId,
	});
	async function dropLayoutIfConsumed<T extends { status: string }>(
		itemId: string,
		outcome: T
	): Promise<T> {
		if (outcome.status === "consumed") {
			await bulk.removePlacement(itemId);
		}
		return outcome;
	}

	async function currentSequentialView() {
		const remaining = await listAllItems();
		const view = sequentialTriageView(remaining, sequentialFocusedId);
		if (view.mode === "list") {
			sequentialFocusedId = null;
		}
		return view;
	}

	function afterFocusedExit(
		itemId: string,
		remainingBefore: readonly string[]
	) {
		if (sequentialFocusedId !== itemId) {
			return;
		}
		sequentialFocusedId = nextSequentialFocus(remainingBefore, itemId);
	}

	async function runFocusedExit<T extends { status: string }>(
		itemId: string,
		run: () => Promise<T>
	): Promise<T> {
		const remainingBefore = sequentialFocusedId
			? (await listAllItems()).map((item) => item.id)
			: [];
		const outcome = await run();
		if (outcome.status === "consumed") {
			afterFocusedExit(itemId, remainingBefore);
		}
		return outcome;
	}

	return {
		advanceTime(instant) {
			now = instant;
		},
		attach: async (command) =>
			dropLayoutIfConsumed(
				command.itemId,
				await runFocusedExit(command.itemId, () => triage.attach(command))
			),
		async attachment(itemId) {
			const item = await loadItemView(input.prisma, {
				itemId,
				workspaceId: input.workspaceId,
			});
			return item?.attachment ?? null;
		},
		backgroundScan: webCapture.backgroundScan,
		bulkSenseMaking: bulk.bulkSenseMaking,
		bulkSurfaces() {
			return BULK_SURFACE_EXCLUSION;
		},
		claimsSafariClipper: webCapture.claimsSafariClipper,
		clip: webCapture.clip,
		clipArchive: webCapture.clipArchive,
		clipperBrowserFamilies: webCapture.clipperBrowserFamilies,
		contentFingerprint: webCapture.contentFingerprint,
		convert: async (command) =>
			dropLayoutIfConsumed(
				command.itemId,
				await runFocusedExit(command.itemId, () => triage.convert(command))
			),
		async createBug(command) {
			if (!connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			if (
				command.template === "feedback-capture" ||
				command.template === "research-fragment"
			) {
				return {
					reason: CAPTURE_INBOX_COPY.createBugNeedsProjectAndBugCapture,
					status: "unavailable",
				};
			}
			const payload = {
				fields: command.fields ?? {},
				projectId: command.projectId,
				template: command.template ?? "",
				text: command.text ?? "",
			};
			const existing = await readDurableReceipt(
				input.prisma,
				command.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return reviveCreateBugOutcome(
					JSON.parse(existing.resultValue) as CreateBugOutcome
				);
			}
			const fields = templateFields("bug-capture", command.fields);
			const workCreateResult = await workCreate({
				actorId: input.actorId,
				fields,
				idempotencyKey: command.idempotencyKey,
				projectId: command.projectId,
				text: command.text?.trim() ?? "",
				workType: "bug",
			});
			const savedAt = clock.now();
			const outcome: CreateBugOutcome = {
				inboxItem: null,
				lastSuccessfulSaveAt: savedAt,
				status: "handed-off",
				workCreate: workCreateResult,
			};
			const committedOutcome = await input.prisma.$transaction(async (tx) => {
				await lockMutation(
					tx,
					`capture-create-bug:${input.actorId}:${command.idempotencyKey}`
				);
				const receipt = await readDurableReceipt(
					tx,
					command.idempotencyKey,
					payload
				);
				if (receipt?.kind === "conflict") {
					return {
						reason: MUTATION_COPY.conflict,
						status: "conflict",
					} as const;
				}
				if (receipt?.kind === "replay") {
					return reviveCreateBugOutcome(
						JSON.parse(receipt.resultValue) as CreateBugOutcome
					);
				}
				await writeDurableReceipt(tx, {
					actorId: input.actorId,
					commandKey: command.idempotencyKey,
					kind: "create-bug",
					payload,
					resultValue: JSON.stringify(outcome),
					targetId: command.projectId,
				});
				return outcome;
			});
			if (committedOutcome.status === "conflict") {
				return committedOutcome;
			}
			lastSuccessfulSaveAt = savedAt;
			return committedOutcome;
		},
		deleteItem: async (command) =>
			dropLayoutIfConsumed(
				command.itemId,
				await runFocusedExit(command.itemId, () => triage.deleteItem(command))
			),
		exitSequentialTriage() {
			sequentialFocusedId = null;
			return currentSequentialView();
		},
		exportRows() {
			return [];
		},
		finalizeWebCapture: webCapture.finalizeWebCapture,
		async goBackSequentialTriage() {
			const remaining = await listAllItems();
			sequentialFocusedId = goBackSequentialFocus(
				remaining.map((item) => item.id),
				sequentialFocusedId
			);
			return currentSequentialView();
		},
		historyCollection: webCapture.historyCollection,
		issuePairingCode: webCapture.issuePairingCode,
		kaynakRecords: webCapture.kaynakRecords,
		lastSuccessfulSaveAt() {
			return lastSuccessfulSaveAt;
		},
		async list(scope) {
			const rows = await input.prisma.captureInboxItem.findMany({
				include: STAGING_INCLUDE,
				orderBy: [{ capturedAt: "asc" }, { id: "asc" }],
				where: {
					...openItemWhere(input.workspaceId),
					projectId:
						scope.kind === "project"
							? { equals: scope.projectId, mode: "insensitive" }
							: null,
				},
			});
			return rows.map(toItemView);
		},
		listAll() {
			return listAllItems();
		},
		listExtensionLinks: webCapture.listExtensionLinks,
		livePageCopies: webCapture.livePageCopies,
		logs: webCapture.logs,
		nameBulkCluster: bulk.nameBulkCluster,
		pageInjection: webCapture.pageInjection,
		pair: webCapture.pair,
		placeInBulk: bulk.placeInBulk,
		previewAttach: triage.previewAttach,
		previewConvert: triage.previewConvert,
		previewUndoMerge: triage.previewUndoMerge,
		previewWebCapture: webCapture.previewWebCapture,
		revokeAllExtensionLinks: webCapture.revokeAllExtensionLinks,
		revokeExtensionLink: webCapture.revokeExtensionLink,
		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this public command coordinates durable reservation and external staging.
		async save(command) {
			if (!connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const payload = saveCommandPayload(command);
			const existing = await readDurableReceipt(
				input.prisma,
				command.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				if (pendingSaveItemId(existing.resultValue)) {
					const waited = await waitForSaveReceipt(
						input.prisma,
						command.idempotencyKey,
						payload
					);
					if (waited === "retry") {
						return this.save(command);
					}
					if (waited === "conflict") {
						return { reason: MUTATION_COPY.conflict, status: "conflict" };
					}
					lastSuccessfulSaveAt =
						waited.status === "saved"
							? waited.lastSuccessfulSaveAt
							: lastSuccessfulSaveAt;
					return waited;
				}
				return reviveSaveOutcome(
					JSON.parse(existing.resultValue) as SaveCaptureOutcome
				);
			}
			const capturedAt = clock.now();
			const createdItemId = crypto.randomUUID();
			// The staging store is an external boundary, so it cannot share the
			// Prisma transaction. Compensation removes the item and staged bytes
			// if either side of the attachment commit fails.
			let stagedAttachment: {
				attachment: CaptureAttachmentView;
				stagingId: string;
			} | null = null;
			let transactionResult:
				| { item: CaptureInboxItemView; kind: "created" }
				| { kind: "conflict" }
				| { item: SaveCaptureOutcome; kind: "replay" }
				| { itemId: string; kind: "pending" }
				| { itemId: string; kind: "winner"; resultValue: string };
			try {
				transactionResult = await withPrismaWriteRetry(() =>
					input.prisma.$transaction(
						// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: reservation transaction coordinates durable idempotency and staging ownership.
						async (tx) => {
							await lockMutation(
								tx,
								`capture-save:${input.actorId}:${command.idempotencyKey}`
							);
							const lockedReceipt = await readDurableReceipt(
								tx,
								command.idempotencyKey,
								payload
							);
							if (lockedReceipt?.kind === "conflict") {
								return { kind: "conflict" as const };
							}
							if (lockedReceipt?.kind === "replay") {
								const pendingItemId = pendingSaveItemId(
									lockedReceipt.resultValue
								);
								if (pendingItemId) {
									return pendingItemId === createdItemId
										? { itemId: pendingItemId, kind: "pending" as const }
										: {
												itemId: pendingItemId,
												kind: "winner" as const,
												resultValue: lockedReceipt.resultValue,
											};
								}
								return {
									item: reviveSaveOutcome(
										JSON.parse(lockedReceipt.resultValue) as SaveCaptureOutcome
									),
									kind: "replay" as const,
								};
							}
							if (command.attachment) {
								await writeDurableReceipt(tx, {
									actorId: input.actorId,
									commandKey: command.idempotencyKey,
									kind: "save",
									payload,
									resultValue: JSON.stringify({
										itemId: createdItemId,
										status: PENDING_SAVE,
									}),
									targetId: createdItemId,
								});
							}
							const created = await insertCaptureItem(tx, {
								actorId: input.actorId,
								capturedAt,
								command,
								id: createdItemId,
								workspaceId: input.workspaceId,
							});
							if (!command.attachment) {
								const outcome: SaveCaptureOutcome = {
									item: created,
									lastSuccessfulSaveAt: capturedAt,
									mainRecord: null,
									status: "saved",
								};
								await writeDurableReceipt(tx, {
									actorId: input.actorId,
									commandKey: command.idempotencyKey,
									kind: "save",
									payload,
									resultValue: JSON.stringify(outcome),
									targetId: created.id,
								});
							}
							return { item: created, kind: "created" as const };
						}
					)
				);
			} catch (error) {
				if (!isUniqueConstraint(error)) {
					throw error;
				}
				const winner = await waitForSaveReceipt(
					input.prisma,
					command.idempotencyKey,
					payload
				);
				if (winner === "conflict" || winner === "retry") {
					return this.save(command);
				}
				return winner;
			}
			if (transactionResult.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (transactionResult.kind === "replay") {
				return transactionResult.item;
			}
			if (transactionResult.kind === "pending") {
				const waited = await waitForSaveReceipt(
					input.prisma,
					command.idempotencyKey,
					payload
				);
				if (waited === "retry") {
					return this.save(command);
				}
				if (waited === "conflict") {
					return { reason: MUTATION_COPY.conflict, status: "conflict" };
				}
				return waited;
			}
			if (transactionResult.kind === "winner") {
				const winner = await waitForSaveReceipt(
					input.prisma,
					command.idempotencyKey,
					payload
				);
				if (winner === "conflict" || winner === "retry") {
					return this.save(command);
				}
				return winner;
			}
			const { item: initialItem } = transactionResult;
			let item = initialItem;
			if (command.attachment) {
				try {
					const staged = await persistStaging({
						attachment: command.attachment,
						inboxItemId: item.id,
						rootKey,
						store,
						workspaceId: input.workspaceId,
					});
					if (!staged) {
						throw new Error("Capture attachment staging did not complete");
					}
					stagedAttachment = staged;
					const reloaded = await input.prisma.$transaction(async (tx) => {
						await lockMutation(
							tx,
							`capture-save:${input.actorId}:${command.idempotencyKey}`
						);
						await tx.captureInboxItem.update({
							data: { attachmentRef: staged.stagingId },
							where: { id: item.id },
						});
						return tx.captureInboxItem.findUnique({
							include: STAGING_INCLUDE,
							where: { id: item.id },
						});
					});
					if (reloaded) {
						item = toItemView(reloaded);
					}
				} catch (error) {
					await input.prisma.captureInboxItem.updateMany({
						data: {
							stagingCleanupAt: clock.now(),
							stagingCleanupError: null,
							stagingCleanupStatus: "pending",
						},
						where: { id: item.id, workspaceId: input.workspaceId },
					});
					try {
						await store.deleteByInboxItemId(item.id);
					} catch (cleanupError) {
						await input.prisma.captureInboxItem.updateMany({
							data: {
								stagingCleanupError:
									cleanupError instanceof Error
										? cleanupError.message
										: "cleanup-failed",
							},
							where: { id: item.id, workspaceId: input.workspaceId },
						});
						return {
							reason: "capture-save-finalization-uncertain",
							status: "refused",
						};
					}
					await input.prisma.$transaction(async (tx) => {
						await tx.captureInboxItem.deleteMany({ where: { id: item.id } });
						await tx.mutationReceipt.deleteMany({
							where: { commandKey: command.idempotencyKey },
						});
					});
					throw error;
				}
			}
			const outcome: SaveCaptureOutcome = {
				item,
				lastSuccessfulSaveAt: capturedAt,
				mainRecord: null,
				status: "saved",
			};
			if (command.attachment) {
				if (!stagedAttachment) {
					throw new Error("Capture attachment staging did not complete");
				}
				try {
					await withPrismaWriteRetry(() =>
						input.prisma.$transaction(async (tx) => {
							await lockMutation(
								tx,
								`capture-save:${input.actorId}:${command.idempotencyKey}`
							);
							const receipt = await readDurableReceipt(
								tx,
								command.idempotencyKey,
								payload
							);
							if (receipt?.kind === "conflict") {
								throw new Error("capture-save-conflict");
							}
							if (
								receipt?.kind === "replay" &&
								!pendingSaveItemId(receipt.resultValue)
							) {
								return;
							}
							await tx.captureInboxItem.update({
								data: { attachmentRef: stagedAttachment.stagingId },
								where: { id: item.id },
							});
							await tx.mutationReceipt.update({
								data: {
									payloadFingerprint: payloadFingerprint(payload),
									resultValue: JSON.stringify(outcome),
									targetId: item.id,
								},
								where: { commandKey: command.idempotencyKey },
							});
						})
					);
				} catch (error) {
					if (!isUniqueConstraint(error)) {
						throw error;
					}
					const winner = await readDurableReceipt(
						input.prisma,
						command.idempotencyKey,
						payload
					);
					if (
						winner?.kind !== "replay" ||
						pendingSaveItemId(winner.resultValue)
					) {
						throw error;
					}
					await input.prisma.captureInboxItem.updateMany({
						data: {
							stagingCleanupAt: clock.now(),
							stagingCleanupError: null,
							stagingCleanupStatus: "pending",
						},
						where: { id: item.id, workspaceId: input.workspaceId },
					});
					try {
						await store.deleteByInboxItemId(item.id);
					} catch (cleanupError) {
						await input.prisma.captureInboxItem.updateMany({
							data: {
								stagingCleanupError:
									cleanupError instanceof Error
										? cleanupError.message
										: "cleanup-failed",
							},
							where: { id: item.id, workspaceId: input.workspaceId },
						});
						return {
							reason: "capture-save-finalization-uncertain",
							status: "refused",
						};
					}
					await input.prisma.captureInboxItem.deleteMany({
						where: { id: item.id },
					});
					return reviveSaveOutcome(
						JSON.parse(winner.resultValue) as SaveCaptureOutcome
					);
				}
			}
			lastSuccessfulSaveAt = capturedAt;
			return outcome;
		},
		searchCaptureTargets: webCapture.searchCaptureTargets,
		searchHits() {
			return [];
		},
		sendPayload: webCapture.sendPayload,
		sendWebCapture: webCapture.sendWebCapture,
		sequentialTriage() {
			return currentSequentialView();
		},
		sharedMediaLibrary() {
			return [];
		},
		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this public command coordinates durable reservation and external staging.
		async stageAttachment(command) {
			if (!connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const payload = {
				attachment: attachmentFingerprint(command.attachment),
				itemId: command.itemId,
			};
			const existing = await readDurableReceipt(
				input.prisma,
				command.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				const waited = pendingStageAttachmentId(existing.resultValue)
					? await waitForStageAttachmentReceipt(
							input.prisma,
							command.idempotencyKey,
							payload
						)
					: { kind: "replay" as const, resultValue: existing.resultValue };
				if (waited.kind === "conflict" || waited.kind !== "replay") {
					return { reason: MUTATION_COPY.conflict, status: "conflict" };
				}
				const replayed = JSON.parse(waited.resultValue) as {
					attachment: CaptureAttachmentView;
					lastSuccessfulSaveAt: Date | string;
					status: "staged";
				};
				return {
					...replayed,
					lastSuccessfulSaveAt: reviveDate(replayed.lastSuccessfulSaveAt),
				};
			}
			const open = await loadItemView(input.prisma, {
				itemId: command.itemId,
				workspaceId: input.workspaceId,
			});
			if (!open) {
				return { status: "not-found" };
			}
			const reservation = await reserveStageAttachment({
				actorId: input.actorId,
				commandKey: command.idempotencyKey,
				itemId: command.itemId,
				payload,
				prisma: input.prisma,
			});
			if (reservation.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (reservation.kind === "replay") {
				const replayed = JSON.parse(reservation.resultValue) as {
					attachment: CaptureAttachmentView;
					lastSuccessfulSaveAt: Date | string;
					status: "staged";
				};
				return {
					...replayed,
					lastSuccessfulSaveAt: reviveDate(replayed.lastSuccessfulSaveAt),
				};
			}
			if (reservation.kind === "pending") {
				const waited = await waitForStageAttachmentReceipt(
					input.prisma,
					command.idempotencyKey,
					payload
				);
				if (waited.kind === "conflict") {
					return { reason: MUTATION_COPY.conflict, status: "conflict" };
				}
				if (waited.kind === "replay") {
					const replayed = JSON.parse(waited.resultValue) as {
						attachment: CaptureAttachmentView;
						lastSuccessfulSaveAt: Date | string;
						status: "staged";
					};
					return {
						...replayed,
						lastSuccessfulSaveAt: reviveDate(replayed.lastSuccessfulSaveAt),
					};
				}
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			let staged: { attachment: CaptureAttachmentView; stagingId: string };
			try {
				staged = await persistStaging({
					attachment: command.attachment,
					inboxItemId: command.itemId,
					rootKey,
					stagingId: reservation.stagingId,
					store,
					workspaceId: input.workspaceId,
				});
			} catch (error) {
				await compensateStageAttachmentFailure({
					commandKey: command.idempotencyKey,
					inboxItemId: command.itemId,
					prisma: input.prisma,
					store,
					workspaceId: input.workspaceId,
				});
				throw error;
			}
			const savedAt = clock.now();
			const outcome = {
				attachment: staged.attachment,
				lastSuccessfulSaveAt: savedAt,
				stagingId: staged.stagingId,
				status: "staged" as const,
			};
			let committedOutcome:
				| typeof outcome
				| { reason: typeof MUTATION_COPY.conflict; status: "conflict" };
			try {
				committedOutcome = await input.prisma.$transaction(async (tx) => {
					await lockMutation(
						tx,
						`capture-stage-attachment:${input.workspaceId}:${command.itemId}`
					);
					const receipt = await readDurableReceipt(
						tx,
						command.idempotencyKey,
						payload
					);
					if (receipt?.kind === "conflict") {
						return {
							reason: MUTATION_COPY.conflict,
							status: "conflict",
						} as const;
					}
					if (
						receipt?.kind === "replay" &&
						!pendingStageAttachmentId(receipt.resultValue)
					) {
						const replayed = JSON.parse(receipt.resultValue) as {
							attachment: CaptureAttachmentView;
							lastSuccessfulSaveAt: Date | string;
							stagingId: string;
							status: "staged";
						};
						return {
							...replayed,
							lastSuccessfulSaveAt: reviveDate(replayed.lastSuccessfulSaveAt),
						};
					}
					await tx.captureInboxItem.update({
						data: { attachmentRef: staged.stagingId },
						where: { id: command.itemId },
					});
					await tx.mutationReceipt.update({
						data: {
							resultValue: JSON.stringify(outcome),
							targetId: command.itemId,
						},
						where: { commandKey: command.idempotencyKey },
					});
					return outcome;
				});
			} catch (error) {
				await compensateStageAttachmentFailure({
					commandKey: command.idempotencyKey,
					inboxItemId: command.itemId,
					prisma: input.prisma,
					store,
					workspaceId: input.workspaceId,
				});
				throw error;
			}
			lastSuccessfulSaveAt = savedAt;
			return committedOutcome;
		},
		stageWebCapture: webCapture.stageWebCapture,
		async startSequentialTriage(command = {}) {
			const remaining = await listAllItems();
			sequentialFocusedId = startSequentialFocus(
				remaining.map((item) => item.id),
				command.itemId
			);
			return currentSequentialView();
		},
		suggestSimilar: triage.suggestSimilar,
		async surfaces(itemId) {
			const row = await input.prisma.captureInboxItem.findFirst({
				where: {
					...openItemWhere(input.workspaceId),
					id: itemId,
				},
			});
			if (!row) {
				return null;
			}
			return CAPTURE_SURFACE_EXCLUSION;
		},
		triageExits: triage.triageExits,
		undoMerge: triage.undoMerge,
		unsavedRisk(hasUnsavedChanges) {
			return hasUnsavedChanges
				? CAPTURE_INBOX_COPY.unsavedChangesMayBeLost
				: null;
		},
		visibleFileAttachments() {
			return [];
		},
		wideReadWarning: webCapture.wideReadWarning,
		writeQueue() {
			return [];
		},
	};
}

export async function retryCaptureStagingCleanup(
	prisma: PrismaClient,
	store: CaptureStagingStore,
	workspaceId: string
): Promise<number> {
	const pending = await prisma.captureInboxItem.findMany({
		select: { consumedExit: true, id: true },
		where: {
			stagingCleanupStatus: "pending",
			workspaceId,
		},
	});
	let cleaned = 0;
	for (const row of pending) {
		try {
			// biome-ignore lint/performance/noAwaitInLoops: cleanup is serialized per Inbox item.
			await store.deleteByInboxItemId(row.id);
			await prisma.$transaction(async (tx) => {
				await lockMutation(tx, `capture-item:${row.id}`);
				if (row.consumedExit === "delete") {
					await tx.captureInboxItem.deleteMany({ where: { id: row.id } });
					return;
				}
				await tx.captureInboxItem.updateMany({
					data: {
						stagingCleanupAt: new Date(),
						stagingCleanupError: null,
						stagingCleanupStatus: null,
					},
					where: { id: row.id },
				});
			});
			cleaned += 1;
		} catch {
			// Keep the marker and retry on the next sweep.
		}
	}
	return cleaned;
}

export function captureInboxCatalog() {
	return {
		clipperBrowsers: clipperBrowserFamilies(),
		copy: {
			...CAPTURE_INBOX_COPY,
			...WEB_CAPTURE_COPY,
		},
		exits: TRIAGE_EXIT_CATALOG,
		templates: miniTemplateCatalog(),
	};
}
