import type { PrismaClient } from "@cantiara/db";

import { promoteCaptureAttachment } from "../../file-attachments/server/file-attachments";
import { createPrismaCaptureStagingSource } from "../../file-attachments/server/file-attachments-capture-staging";
import { FILE_SCOPE_KIND } from "../../file-attachments/server/file-attachments-model";
import {
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
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

async function readHumanReceipt(
	prisma: PrismaClient,
	commandKey: string,
	payload: unknown
) {
	const existing = await prisma.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== payloadFingerprint(payload)) {
		return { kind: "conflict" as const };
	}
	return { kind: "replay" as const, resultValue: existing.resultValue };
}

async function writeHumanReceipt(
	prisma: PrismaClient,
	input: {
		actorId: string;
		commandKey: string;
		kind: string;
		payload: unknown;
		resultValue: string;
		targetId: string;
	}
) {
	await prisma.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: 1,
			id: crypto.randomUUID(),
			kind: input.kind,
			origin: "human",
			payloadFingerprint: payloadFingerprint(input.payload),
			resultValue: input.resultValue,
			targetId: input.targetId,
		},
	});
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
	prisma: PrismaClient,
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
	prisma: PrismaClient,
	input: {
		actorId: string;
		capturedAt: Date;
		command: Omit<SaveCaptureInput, "actorId" | "workspaceId">;
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
			id: crypto.randomUUID(),
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

async function persistStaging(input: {
	attachment: CaptureAttachmentInput;
	inboxItemId: string;
	prisma: PrismaClient;
	rootKey: Uint8Array;
	store: CaptureStagingStore;
	workspaceId: string;
}): Promise<CaptureAttachmentView> {
	const sealed = envelopeSeal(input.attachment.bytes, input.rootKey);
	const stagingId = crypto.randomUUID();
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
	await input.prisma.captureInboxItem.update({
		data: { attachmentRef: stagingId },
		where: { id: input.inboxItemId },
	});
	return {
		filename: input.attachment.filename,
		itemId: input.inboxItemId,
		kind: "capture-attachment",
	};
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

function captureMessageTitle(body: string): string | undefined {
	const title = body.trim();
	return title ? title : undefined;
}

export function captureConvertAdapter(
	prisma: PrismaClient,
	workspaceId: string
): ConvertAdapter {
	return async (command) => {
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
		await store.deleteByInboxItemId(inboxItemId);
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
			orderBy: { capturedAt: "asc" },
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
			const existing = await readHumanReceipt(
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
			await writeHumanReceipt(input.prisma, {
				actorId: input.actorId,
				commandKey: command.idempotencyKey,
				kind: "create-bug",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: command.projectId,
			});
			lastSuccessfulSaveAt = savedAt;
			return outcome;
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
				orderBy: { capturedAt: "asc" },
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
		async save(command) {
			if (!connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const payload = saveCommandPayload(command);
			const existing = await readHumanReceipt(
				input.prisma,
				command.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return reviveSaveOutcome(
					JSON.parse(existing.resultValue) as SaveCaptureOutcome
				);
			}
			const capturedAt = clock.now();
			let item = await insertCaptureItem(input.prisma, {
				actorId: input.actorId,
				capturedAt,
				command,
				workspaceId: input.workspaceId,
			});
			if (command.attachment) {
				await persistStaging({
					attachment: command.attachment,
					inboxItemId: item.id,
					prisma: input.prisma,
					rootKey,
					store,
					workspaceId: input.workspaceId,
				});
				const reloaded = await loadItemView(input.prisma, {
					itemId: item.id,
					workspaceId: input.workspaceId,
				});
				if (reloaded) {
					item = reloaded;
				}
			}
			const outcome: SaveCaptureOutcome = {
				item,
				lastSuccessfulSaveAt: capturedAt,
				mainRecord: null,
				status: "saved",
			};
			await writeHumanReceipt(input.prisma, {
				actorId: input.actorId,
				commandKey: command.idempotencyKey,
				kind: "save",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: item.id,
			});
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
		async stageAttachment(command) {
			if (!connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const payload = {
				attachment: attachmentFingerprint(command.attachment),
				itemId: command.itemId,
			};
			const existing = await readHumanReceipt(
				input.prisma,
				command.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				const replayed = JSON.parse(existing.resultValue) as {
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
			const attachment = await persistStaging({
				attachment: command.attachment,
				inboxItemId: command.itemId,
				prisma: input.prisma,
				rootKey,
				store,
				workspaceId: input.workspaceId,
			});
			const savedAt = clock.now();
			const outcome = {
				attachment,
				lastSuccessfulSaveAt: savedAt,
				status: "staged" as const,
			};
			await writeHumanReceipt(input.prisma, {
				actorId: input.actorId,
				commandKey: command.idempotencyKey,
				kind: "stage-attachment",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: command.itemId,
			});
			lastSuccessfulSaveAt = savedAt;
			return outcome;
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
