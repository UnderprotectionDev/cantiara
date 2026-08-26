import type { PrismaClient } from "@cantiara/db";

import {
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	CAPTURE_INBOX_COPY,
	CAPTURE_SURFACE_EXCLUSION,
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
	handOffConvert,
	type MergeUndoPreview,
	type RecordBinder,
	type SimilarMatch,
	type SimilarSuggestions,
	TRIAGE_EXIT_CATALOG,
	type TriageExit,
	type UndoMergeOutcome,
} from "./capture-triage-exits";
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

export interface SaveCaptureInput {
	actorId: string;
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
	backgroundScan: WebCapture["backgroundScan"];
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
	finalizeWebCapture: WebCapture["finalizeWebCapture"];
	historyCollection: WebCapture["historyCollection"];
	issuePairingCode: WebCapture["issuePairingCode"];
	kaynakRecords: WebCapture["kaynakRecords"];
	lastSuccessfulSaveAt: () => Date | null;
	list: (scope: CaptureInboxScope) => Promise<CaptureInboxItemView[]>;
	listAll: () => Promise<CaptureInboxItemView[]>;
	listExtensionLinks: WebCapture["listExtensionLinks"];
	livePageCopies: WebCapture["livePageCopies"];
	logs: WebCapture["logs"];
	pageInjection: WebCapture["pageInjection"];
	pair: WebCapture["pair"];
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
	stageWebCapture: WebCapture["stageWebCapture"];
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

function saveCommandPayload(
	command: Omit<SaveCaptureInput, "actorId" | "workspaceId">
) {
	return {
		attachmentRef: command.attachmentRef ?? "",
		fields: command.fields ?? {},
		link: command.link ?? "",
		origin: command.origin ?? "",
		projectId: command.projectId ?? "",
		template: command.template ?? "",
		text: command.text ?? "",
	};
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
			projectId: input.command.projectId ?? null,
			template,
			workspaceId: input.workspaceId,
		},
	});
	return toItemView(row);
}

export function createCaptureInbox(input: {
	actorId: string;
	binder?: RecordBinder;
	clock?: { now: () => Date };
	connected?: boolean;
	convertCreate?: ConvertAdapter;
	prisma: PrismaClient;
	similarRecords?: (item: CaptureInboxItemView) => SimilarMatch[];
	workCreate?: WorkCreateAdapter;
	workspaceId: string;
}): CaptureInbox {
	let now = input.clock ? input.clock.now() : new Date();
	const clock = { now: () => now };
	const workCreate = input.workCreate ?? handOffWorkCreate;
	const convertCreate = input.convertCreate ?? handOffConvert;
	const binder = input.binder ?? createRecordBinder([]);
	const similarRecords = input.similarRecords ?? (() => []);
	let lastSuccessfulSaveAt: Date | null = null;
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
	const triage = createTriageExits({
		actorId: input.actorId,
		binder,
		clock,
		connected,
		convertCreate,
		prisma: input.prisma,
		similarRecords,
		toItemView,
		workspaceId: input.workspaceId,
	});

	return {
		advanceTime(instant) {
			now = instant;
		},
		attach: triage.attach,
		backgroundScan: webCapture.backgroundScan,
		claimsSafariClipper: webCapture.claimsSafariClipper,
		clip: webCapture.clip,
		clipArchive: webCapture.clipArchive,
		clipperBrowserFamilies: webCapture.clipperBrowserFamilies,
		contentFingerprint: webCapture.contentFingerprint,
		convert: triage.convert,
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
		deleteItem: triage.deleteItem,
		finalizeWebCapture: webCapture.finalizeWebCapture,
		historyCollection: webCapture.historyCollection,
		issuePairingCode: webCapture.issuePairingCode,
		kaynakRecords: webCapture.kaynakRecords,
		lastSuccessfulSaveAt() {
			return lastSuccessfulSaveAt;
		},
		async list(scope) {
			const rows = await input.prisma.captureInboxItem.findMany({
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
		async listAll() {
			const rows = await input.prisma.captureInboxItem.findMany({
				orderBy: { capturedAt: "asc" },
				where: openItemWhere(input.workspaceId),
			});
			return rows.map(toItemView);
		},
		listExtensionLinks: webCapture.listExtensionLinks,
		livePageCopies: webCapture.livePageCopies,
		logs: webCapture.logs,
		pageInjection: webCapture.pageInjection,
		pair: webCapture.pair,
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
			const item = await insertCaptureItem(input.prisma, {
				actorId: input.actorId,
				capturedAt,
				command,
				workspaceId: input.workspaceId,
			});
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
		stageWebCapture: webCapture.stageWebCapture,
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
