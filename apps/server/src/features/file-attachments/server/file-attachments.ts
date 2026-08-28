import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	ensureImageDerivatives,
	type ImageDerivativeEngine,
	removeDerivativesForHash,
} from "./file-attachments-derivatives";
import {
	contentPathFor,
	FILE_ATTACHMENT_COPY,
	FILE_ATTACHMENT_QUOTA,
	FILE_KIND,
	FILE_LIFECYCLE,
	FILE_SCOPE_KIND,
	type FileLifecycle,
	type FilePinKind,
	type FileScope,
	IMAGE_DERIVATIVE_LIMITS,
	PREVIEW_STATUS,
	type PreviewMode,
	type PreviewStatus,
	previewPathFor,
	STAGING_TTL_MS,
	type StageFileUploadCommand,
	stageFileUploadCommandSchema,
	THUMBNAIL_SIZE,
	type ThumbnailSize,
	thumbnailPathFor,
} from "./file-attachments-model";
import {
	boundedCsvRows,
	fileCanEnterExternalSurface,
	playbackContractFor,
	previewModeFor,
	safePlainTextExcerpt,
} from "./file-attachments-preview";
import { sniffFileBytes } from "./file-attachments-sniff";
import {
	createPrismaFileObjectStore,
	type FileObjectStore,
} from "./file-attachments-store";
import { classifyUpload, type FileSniff } from "./file-attachments-types";

const STAGED = "staged";
const FINALIZING = "finalizing";
const COMMITTED = "committed";

type PrismaTransaction = Prisma.TransactionClient;

export interface FileAttachmentQuotaLimits {
	maxOriginalBytes: number;
	maxVersions: number;
}

export interface FileAttachmentDeps {
	clock?: { now?: Date };
	derivatives?: ImageDerivativeEngine;
	quota?: FileAttachmentQuotaLimits;
	sniff?: (bytes: Uint8Array) => Promise<FileSniff | null>;
	store?: FileObjectStore;
}

export interface FilePreviewView {
	autoplay: false;
	cause: string | null;
	csvRows: string[][] | null;
	galleryThumbnailPath: string | null;
	mediumThumbnailPath: string | null;
	mode: PreviewMode;
	playback: {
		autoplay: false;
		fullscreen: boolean;
		loopOptional: boolean;
		speed: boolean;
	} | null;
	previewPath: string | null;
	retryLimit: number;
	status: PreviewStatus;
	supportReference: string | null;
	textExcerpt: string | null;
	unpack: false;
	written: boolean;
}

export interface FileVersionView {
	byteLength: number;
	contentHash: string;
	contentPath: string;
	createdAt: string;
	filename: string;
	id: string;
	kind: string;
	mimeType: string;
	pins: Array<{ kind: FilePinKind; targetId: string }>;
	preview: FilePreviewView;
	versionNumber: number;
}

export interface FileAttachmentView {
	contentPath: string;
	currentVersion: FileVersionView;
	id: string;
	kind: string;
	lifecycle: FileLifecycle;
	revision: number;
	scope: FileScope;
	title: string;
	versions: FileVersionView[];
}

export interface FileQuotaView {
	maxOriginalBytes: number;
	maxVersions: number;
	stagingBytes: number;
	usedOriginalBytes: number;
	usedVersions: number;
	warn: boolean;
	warning: typeof FILE_ATTACHMENT_COPY.quotaWarning | null;
}

export type FileAttachmentOutcome =
	| { file: FileAttachmentView; status: "committed" }
	| { file: FileAttachmentView; status: "replayed" }
	| {
			operation: FileStagingView;
			status: "staged";
	  }
	| { operation: FileStagingView; status: "cancelled" }
	| { conflict: typeof FILE_ATTACHMENT_COPY.conflict; status: "conflict" }
	| {
			reason:
				| typeof FILE_ATTACHMENT_COPY.mimeMismatch
				| typeof FILE_ATTACHMENT_COPY.quotaExceeded
				| typeof FILE_ATTACHMENT_COPY.restartFromByteZero
				| typeof FILE_ATTACHMENT_COPY.tooLarge
				| typeof FILE_ATTACHMENT_COPY.typeRejected;
			status: "rejected";
	  }
	| {
			status: "refused";
			ui: {
				cancelAvailable: false;
				label: typeof FILE_ATTACHMENT_COPY.finalizing;
			};
	  }
	| {
			reason:
				| "missing-authorization"
				| "missing-idempotency-key"
				| "operation-not-found"
				| "scope-not-found"
				| "target-not-found"
				| "bytes-incomplete";
			status: "rejected";
	  };

export interface FileStagingView {
	cancelAvailable: boolean;
	operationId: string;
	status: typeof STAGED | typeof FINALIZING | typeof COMMITTED;
	ui: {
		label: typeof FILE_ATTACHMENT_COPY.finalizing | typeof MUTATION_COPY.cancel;
	};
}

export interface NewVersionPreview {
	currentVersion: { filename: string; versionNumber: number };
	incoming: { declaredMime: string; filename: string };
	target: { id: string; title: string };
}

function quotaLimits(deps: FileAttachmentDeps): FileAttachmentQuotaLimits {
	return deps.quota ?? FILE_ATTACHMENT_QUOTA;
}

function storeOf(deps: FileAttachmentDeps): FileObjectStore {
	return deps.store ?? createPrismaFileObjectStore();
}

function nowOf(deps: FileAttachmentDeps): Date {
	return deps.clock?.now ?? new Date();
}

function sniffOf(
	deps: FileAttachmentDeps
): (bytes: Uint8Array) => Promise<FileSniff | null> {
	return deps.sniff ?? sniffFileBytes;
}

function contentHashOf(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function metadataFingerprint(
	payload: StageFileUploadCommand["payload"]
): string {
	return payloadFingerprint({
		declaredMime: payload.declaredMime,
		filename: payload.filename,
		scope: payload.scope,
		targetFileAttachmentId: payload.targetFileAttachmentId ?? null,
	});
}

function finalizeFingerprint(
	payload: StageFileUploadCommand["payload"],
	hash: string
): string {
	return payloadFingerprint({
		contentHash: hash,
		declaredMime: payload.declaredMime,
		filename: payload.filename,
		scope: payload.scope,
		targetFileAttachmentId: payload.targetFileAttachmentId ?? null,
	});
}

function commandFromUnknown(
	command: unknown
):
	| { command: StageFileUploadCommand; status: "ok" }
	| { outcome: FileAttachmentOutcome; status: "invalid" } {
	if (
		typeof command === "object" &&
		command !== null &&
		"idempotencyKey" in command &&
		(command as { idempotencyKey?: unknown }).idempotencyKey === ""
	) {
		return {
			outcome: {
				reason: "missing-idempotency-key",
				status: "rejected",
			},
			status: "invalid",
		};
	}
	const parsed = stageFileUploadCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: {
				reason: "missing-authorization",
				status: "rejected",
			},
			status: "invalid",
		};
	}
	if (parsed.data.origin !== HUMAN_ORIGIN) {
		return {
			outcome: {
				reason: "missing-authorization",
				status: "rejected",
			},
			status: "invalid",
		};
	}
	return { command: parsed.data, status: "ok" };
}

async function lockWorkspaceCommand(
	tx: PrismaTransaction,
	workspaceId: string,
	commandKey: string
) {
	const [workspaceA, workspaceB] = advisoryKeys(`file-quota:${workspaceId}`);
	const [commandA, commandB] = advisoryKeys(`file-command:${commandKey}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${workspaceA}, ${workspaceB})`;
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${commandA}, ${commandB})`;
}

async function assertScope(
	prisma: PrismaClient | PrismaTransaction,
	workspaceId: string,
	scope: FileScope
): Promise<boolean> {
	if (scope.kind === FILE_SCOPE_KIND.personalWiki) {
		const workspace = await prisma.workspace.findUnique({
			where: { id: workspaceId },
		});
		return Boolean(workspace);
	}
	const project = await prisma.project.findFirst({
		where: { id: scope.projectId, workspaceId },
	});
	return Boolean(project);
}

async function countedUsage(
	tx: PrismaTransaction,
	workspaceId: string
): Promise<{ bytes: number; versions: number }> {
	const versions = await tx.fileAttachmentVersion.findMany({
		select: { byteLength: true },
		where: { fileAttachment: { workspaceId } },
	});
	return {
		bytes: versions.reduce((sum, row) => sum + row.byteLength, 0),
		versions: versions.length,
	};
}

async function stagingBytes(
	tx: PrismaTransaction,
	workspaceId: string
): Promise<number> {
	const rows = await tx.fileAttachmentStaging.findMany({
		select: { expectedByteLength: true },
		where: { status: STAGED, workspaceId },
	});
	return rows.reduce((sum, row) => sum + row.expectedByteLength, 0);
}

function versionView(
	attachmentId: string,
	row: {
		byteLength: number;
		contentHash: string;
		createdAt: Date;
		filename: string;
		id: string;
		kind: string;
		mimeType: string;
		pins: Array<{ kind: string; targetId: string }>;
		preview: FilePreviewView;
		versionNumber: number;
	}
): FileVersionView {
	return {
		byteLength: row.byteLength,
		contentHash: row.contentHash,
		contentPath: contentPathFor(attachmentId, row.id),
		createdAt: row.createdAt.toISOString(),
		filename: row.filename,
		id: row.id,
		kind: row.kind,
		mimeType: row.mimeType,
		pins: row.pins.map((pin) => ({
			kind: pin.kind as FilePinKind,
			targetId: pin.targetId,
		})),
		preview: row.preview,
		versionNumber: row.versionNumber,
	};
}

async function previewViewFor(
	tx: PrismaClient | PrismaTransaction,
	attachmentId: string,
	version: {
		contentHash: string;
		id: string;
		kind: string;
		objectKey: string;
		previewCause: string | null;
		previewDataWritten: boolean;
		previewStatus: string;
		previewSupportReference: string | null;
	},
	previewBody: boolean
): Promise<FilePreviewView> {
	const mode = previewModeFor(version.kind);
	const playback = playbackContractFor(version.kind);
	const status = (version.previewStatus ||
		PREVIEW_STATUS.pending) as PreviewStatus;
	const downloadOnly = mode === "download-only";
	const isolatedPreview =
		downloadOnly || status === PREVIEW_STATUS.unavailable
			? null
			: previewPathFor(attachmentId, version.id);
	const derivatives =
		version.kind === FILE_KIND.image
			? await tx.fileImageDerivative.findMany({
					where: { contentHash: version.contentHash },
				})
			: [];
	const small = derivatives.find((row) => row.size === THUMBNAIL_SIZE.small);
	const medium = derivatives.find((row) => row.size === THUMBNAIL_SIZE.medium);
	const galleryReady =
		status === PREVIEW_STATUS.ready && Boolean(small) && Boolean(medium);
	let csvRows: string[][] | null = null;
	let textExcerpt: string | null = null;
	if (
		previewBody &&
		status === PREVIEW_STATUS.ready &&
		version.kind === FILE_KIND.csv
	) {
		const blob = await tx.fileObjectBlob.findUnique({
			where: { objectKey: version.objectKey },
		});
		if (blob) {
			csvRows = boundedCsvRows(Uint8Array.from(blob.bytes));
		}
	}
	if (
		previewBody &&
		status === PREVIEW_STATUS.ready &&
		version.kind === FILE_KIND.text
	) {
		const blob = await tx.fileObjectBlob.findUnique({
			where: { objectKey: version.objectKey },
		});
		if (blob) {
			textExcerpt = safePlainTextExcerpt(Uint8Array.from(blob.bytes));
		}
	}
	return {
		autoplay: false,
		cause: status === PREVIEW_STATUS.unavailable ? version.previewCause : null,
		csvRows,
		galleryThumbnailPath: galleryReady
			? thumbnailPathFor(attachmentId, version.id, THUMBNAIL_SIZE.small)
			: null,
		mediumThumbnailPath: galleryReady
			? thumbnailPathFor(attachmentId, version.id, THUMBNAIL_SIZE.medium)
			: null,
		mode,
		playback,
		previewPath: isolatedPreview,
		retryLimit: IMAGE_DERIVATIVE_LIMITS.retryLimit,
		status: version.kind === FILE_KIND.image ? status : PREVIEW_STATUS.ready,
		supportReference:
			status === PREVIEW_STATUS.unavailable
				? version.previewSupportReference
				: null,
		textExcerpt,
		unpack: false,
		written: version.previewDataWritten,
	};
}

async function loadFileView(
	tx: PrismaClient | PrismaTransaction,
	id: string,
	previewBody = true
): Promise<FileAttachmentView | null> {
	const row = await tx.fileAttachment.findUnique({
		include: {
			versions: {
				include: { pins: { orderBy: { createdAt: "asc" } } },
				orderBy: { versionNumber: "asc" },
			},
		},
		where: { id },
	});
	if (!row || row.versions.length === 0) {
		return null;
	}
	const current = row.versions.at(-1);
	if (!current) {
		return null;
	}
	const scope: FileScope =
		row.scopeKind === FILE_SCOPE_KIND.project && row.projectId
			? { kind: FILE_SCOPE_KIND.project, projectId: row.projectId }
			: { kind: FILE_SCOPE_KIND.personalWiki };
	const versions = await Promise.all(
		row.versions.map(async (version) =>
			versionView(row.id, {
				...version,
				preview: await previewViewFor(tx, row.id, version, previewBody),
			})
		)
	);
	const currentView = versions.at(-1);
	if (!currentView) {
		return null;
	}
	return {
		contentPath: contentPathFor(row.id, current.id),
		currentVersion: currentView,
		id: row.id,
		kind: current.kind,
		lifecycle: row.lifecycle as FileLifecycle,
		revision: row.revision,
		scope,
		title: row.title,
		versions,
	};
}

function stagingView(row: { id: string; status: string }): FileStagingView {
	const finalizing = row.status === FINALIZING || row.status === COMMITTED;
	return {
		cancelAvailable: row.status === STAGED,
		operationId: row.id,
		status: row.status as FileStagingView["status"],
		ui: {
			label: finalizing
				? FILE_ATTACHMENT_COPY.finalizing
				: MUTATION_COPY.cancel,
		},
	};
}

function classifyBytes(input: {
	byteLength: number;
	declaredMime: string;
	filename: string;
	sniff: FileSniff | null;
}): FileAttachmentOutcome | { kind: string; mime: string; status: "ok" } {
	const classified = classifyUpload(input);
	if (classified.status === "mismatch") {
		return { reason: classified.reason, status: "rejected" };
	}
	if (classified.status === "rejected") {
		return { reason: classified.reason, status: "rejected" };
	}
	if (classified.status === "too-large") {
		return {
			reason: FILE_ATTACHMENT_COPY.tooLarge,
			status: "rejected",
		};
	}
	return {
		kind: classified.kind,
		mime: classified.declaredMime,
		status: "ok",
	};
}

export async function getFileQuota(
	prisma: PrismaClient,
	workspaceId: string,
	deps: FileAttachmentDeps = {}
): Promise<FileQuotaView> {
	const limits = quotaLimits(deps);
	const usage = await prisma.$transaction((tx) =>
		countedUsage(tx, workspaceId)
	);
	const staging = await prisma.$transaction((tx) =>
		stagingBytes(tx, workspaceId)
	);
	const warn =
		usage.bytes >=
			Math.floor(limits.maxOriginalBytes * FILE_ATTACHMENT_QUOTA.warnRatio) ||
		usage.versions >=
			Math.floor(limits.maxVersions * FILE_ATTACHMENT_QUOTA.warnRatio);
	return {
		maxOriginalBytes: limits.maxOriginalBytes,
		maxVersions: limits.maxVersions,
		stagingBytes: staging,
		usedOriginalBytes: usage.bytes,
		usedVersions: usage.versions,
		warn,
		warning: warn ? FILE_ATTACHMENT_COPY.quotaWarning : null,
	};
}

export async function listFileAttachments(
	prisma: PrismaClient,
	input: { scope: FileScope; workspaceId: string }
): Promise<FileAttachmentView[]> {
	await sweepExpiredFileStaging(prisma);
	const rows = await prisma.fileAttachment.findMany({
		orderBy: { createdAt: "desc" },
		where: {
			lifecycle: { not: FILE_LIFECYCLE.trash },
			projectId:
				input.scope.kind === FILE_SCOPE_KIND.project
					? input.scope.projectId
					: null,
			scopeKind: input.scope.kind,
			workspaceId: input.workspaceId,
		},
	});
	const views = (
		await Promise.all(rows.map((row) => loadFileView(prisma, row.id, false)))
	).filter((view): view is FileAttachmentView => view !== null);
	return views;
}

export async function getFileAttachment(
	prisma: PrismaClient,
	input: { id: string; workspaceId: string },
	deps: FileAttachmentDeps = {}
): Promise<FileAttachmentView | null> {
	const row = await prisma.fileAttachment.findFirst({
		where: { id: input.id, workspaceId: input.workspaceId },
	});
	if (!row) {
		return null;
	}
	const view = await loadFileView(prisma, row.id);
	if (
		view?.kind === FILE_KIND.image &&
		view.currentVersion.preview.status === PREVIEW_STATUS.pending
	) {
		await ensureImageDerivatives(
			prisma,
			{
				contentHash: view.currentVersion.contentHash,
				kind: view.kind,
				versionId: view.currentVersion.id,
				workspaceId: input.workspaceId,
			},
			{
				engine: deps.derivatives,
				store: storeOf(deps),
			}
		);
		return await loadFileView(prisma, row.id);
	}
	return view;
}

export async function readAccessibleFileBytes(
	prisma: PrismaClient,
	input: { fileAttachmentId: string; versionId: string; workspaceId: string },
	deps: FileAttachmentDeps = {}
): Promise<{ bytes: Uint8Array; filename: string; mimeType: string } | null> {
	const version = await prisma.fileAttachmentVersion.findFirst({
		where: {
			fileAttachment: { workspaceId: input.workspaceId },
			fileAttachmentId: input.fileAttachmentId,
			id: input.versionId,
		},
	});
	if (!version) {
		return null;
	}
	const blob = await storeOf(deps).read(prisma, version.objectKey);
	if (!blob?.accessible) {
		return null;
	}
	return {
		bytes: blob.bytes,
		filename: version.filename,
		mimeType: version.mimeType,
	};
}

export async function readIsolatedPreviewBytes(
	prisma: PrismaClient,
	input: {
		fileAttachmentId: string;
		kind: "preview" | ThumbnailSize;
		versionId: string;
		workspaceId: string;
	},
	deps: FileAttachmentDeps = {}
): Promise<{ bytes: Uint8Array; filename: string; mimeType: string } | null> {
	const version = await prisma.fileAttachmentVersion.findFirst({
		where: {
			fileAttachment: { workspaceId: input.workspaceId },
			fileAttachmentId: input.fileAttachmentId,
			id: input.versionId,
		},
	});
	if (!version) {
		return null;
	}
	if (input.kind === "preview") {
		if (version.kind === FILE_KIND.zip) {
			return null;
		}
		if (version.previewStatus === PREVIEW_STATUS.unavailable) {
			return null;
		}
		const blob = await storeOf(deps).read(prisma, version.objectKey);
		if (!blob?.accessible) {
			return null;
		}
		return {
			bytes: blob.bytes,
			filename: version.filename,
			mimeType: version.mimeType,
		};
	}
	const derivative = await prisma.fileImageDerivative.findUnique({
		where: {
			contentHash_size: {
				contentHash: version.contentHash,
				size: input.kind,
			},
		},
	});
	if (!derivative) {
		return null;
	}
	const blob = await storeOf(deps).read(prisma, derivative.objectKey);
	if (!blob?.accessible) {
		return null;
	}
	return {
		bytes: blob.bytes,
		filename: `${version.filename}.${input.kind}.webp`,
		mimeType: "image/webp",
	};
}

export function zipCanEnterExternalSurface(kind: string): boolean {
	return fileCanEnterExternalSurface({
		audience: "public",
		kind,
	}).allowed;
}

export async function previewUploadNewVersion(
	prisma: PrismaClient,
	input: {
		declaredMime: string;
		fileAttachmentId: string;
		filename: string;
	}
): Promise<NewVersionPreview | null> {
	const file = await loadFileView(prisma, input.fileAttachmentId);
	if (!file) {
		return null;
	}
	return {
		currentVersion: {
			filename: file.currentVersion.filename,
			versionNumber: file.currentVersion.versionNumber,
		},
		incoming: {
			declaredMime: input.declaredMime,
			filename: input.filename,
		},
		target: { id: file.id, title: file.title },
	};
}

export async function stageFileUpload(
	prisma: PrismaClient,
	command: unknown,
	deps: FileAttachmentDeps = {}
): Promise<FileAttachmentOutcome> {
	const parsed = commandFromUnknown(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	if (
		parsed.command.payload.byteOffset !== undefined &&
		parsed.command.payload.byteOffset !== 0
	) {
		return {
			reason: FILE_ATTACHMENT_COPY.restartFromByteZero,
			status: "rejected",
		};
	}
	const scoped = await assertScope(
		prisma,
		parsed.command.workspaceId,
		parsed.command.payload.scope
	);
	if (!scoped) {
		return { reason: "scope-not-found", status: "rejected" };
	}
	const classified = classifyBytes({
		byteLength: 1,
		declaredMime: parsed.command.payload.declaredMime,
		filename: parsed.command.payload.filename,
		sniff: null,
	});
	if (classified.status !== "ok") {
		return classified;
	}
	return await prisma.$transaction((tx) =>
		stageInTransaction(tx, parsed.command, deps)
	);
}

async function stageInTransaction(
	tx: PrismaTransaction,
	command: StageFileUploadCommand,
	deps: FileAttachmentDeps
): Promise<FileAttachmentOutcome> {
	await lockWorkspaceCommand(tx, command.workspaceId, command.idempotencyKey);
	const receipt = await tx.fileAttachmentReceipt.findUnique({
		where: { commandKey: command.idempotencyKey },
	});
	if (receipt) {
		const file = await loadFileView(tx, receipt.fileAttachmentId);
		if (!file) {
			return { reason: "target-not-found", status: "rejected" };
		}
		const committedMeta = metadataFingerprint({
			declaredMime: file.currentVersion.mimeType,
			filename: file.currentVersion.filename,
			scope: file.scope,
			targetFileAttachmentId: command.payload.targetFileAttachmentId,
		});
		if (committedMeta !== metadataFingerprint(command.payload)) {
			return {
				conflict: FILE_ATTACHMENT_COPY.conflict,
				status: "conflict",
			};
		}
		return { file, status: "replayed" };
	}
	const fingerprint = metadataFingerprint(command.payload);
	const existing = await tx.fileAttachmentStaging.findUnique({
		where: { commandKey: command.idempotencyKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return {
				conflict: FILE_ATTACHMENT_COPY.conflict,
				status: "conflict",
			};
		}
		if (existing.status === FINALIZING || existing.status === COMMITTED) {
			return {
				status: "refused",
				ui: {
					cancelAvailable: false,
					label: FILE_ATTACHMENT_COPY.finalizing,
				},
			};
		}
		return { operation: stagingView(existing), status: "staged" };
	}
	if (command.payload.targetFileAttachmentId) {
		const target = await tx.fileAttachment.findUnique({
			where: { id: command.payload.targetFileAttachmentId },
		});
		if (!target || target.workspaceId !== command.workspaceId) {
			return { reason: "target-not-found", status: "rejected" };
		}
	}
	const usage = await countedUsage(tx, command.workspaceId);
	const limits = quotaLimits(deps);
	if (
		usage.bytes >= limits.maxOriginalBytes ||
		usage.versions >= limits.maxVersions
	) {
		return {
			reason: FILE_ATTACHMENT_COPY.quotaExceeded,
			status: "rejected",
		};
	}
	const created = await tx.fileAttachmentStaging.create({
		data: {
			actorId: command.actorId,
			commandKey: command.idempotencyKey,
			declaredMime: command.payload.declaredMime,
			expectedByteLength: 0,
			expiresAt: new Date(nowOf(deps).getTime() + STAGING_TTL_MS),
			filename: command.payload.filename,
			id: crypto.randomUUID(),
			objectKey: `tmp/${command.workspaceId}/${crypto.randomUUID()}`,
			payloadFingerprint: fingerprint,
			projectId:
				command.payload.scope.kind === FILE_SCOPE_KIND.project
					? command.payload.scope.projectId
					: null,
			scopeKind: command.payload.scope.kind,
			status: STAGED,
			targetFileAttachmentId: command.payload.targetFileAttachmentId,
			workspaceId: command.workspaceId,
		},
	});
	return { operation: stagingView(created), status: "staged" };
}

export async function putStagingBytes(
	prisma: PrismaClient,
	input: {
		bytes: Uint8Array;
		byteOffset?: number;
		operationId: string;
	},
	deps: FileAttachmentDeps = {}
): Promise<FileAttachmentOutcome> {
	if (input.byteOffset !== undefined && input.byteOffset !== 0) {
		return {
			reason: FILE_ATTACHMENT_COPY.restartFromByteZero,
			status: "rejected",
		};
	}
	return await prisma.$transaction((tx) =>
		putBytesInTransaction(tx, input, deps)
	);
}

async function putBytesInTransaction(
	tx: PrismaTransaction,
	input: {
		bytes: Uint8Array;
		operationId: string;
	},
	deps: FileAttachmentDeps
): Promise<FileAttachmentOutcome> {
	const row = await tx.fileAttachmentStaging.findUnique({
		where: { id: input.operationId },
	});
	if (!row) {
		return { reason: "operation-not-found", status: "rejected" };
	}
	await lockWorkspaceCommand(tx, row.workspaceId, row.commandKey);
	const locked = await tx.fileAttachmentStaging.findUnique({
		where: { id: input.operationId },
	});
	if (!locked) {
		return { reason: "operation-not-found", status: "rejected" };
	}
	if (locked.status !== STAGED) {
		return {
			status: "refused",
			ui: {
				cancelAvailable: false,
				label: FILE_ATTACHMENT_COPY.finalizing,
			},
		};
	}
	const classified = classifyBytes({
		byteLength: input.bytes.byteLength,
		declaredMime: locked.declaredMime,
		filename: locked.filename,
		sniff: await sniffOf(deps)(input.bytes),
	});
	if (classified.status !== "ok") {
		await storeOf(deps).remove(tx, locked.objectKey);
		await tx.fileAttachmentStaging.delete({ where: { id: locked.id } });
		return classified;
	}
	await storeOf(deps).putTemp(tx, {
		bytes: input.bytes,
		objectKey: locked.objectKey,
		workspaceId: locked.workspaceId,
	});
	const updated = await tx.fileAttachmentStaging.update({
		data: {
			bytesComplete: true,
			expectedByteLength: input.bytes.byteLength,
		},
		where: { id: locked.id },
	});
	return { operation: stagingView(updated), status: "staged" };
}

export async function cancelFileUpload(
	prisma: PrismaClient,
	operationId: string,
	deps: FileAttachmentDeps = {}
): Promise<FileAttachmentOutcome> {
	return await prisma.$transaction(async (tx) => {
		const row = await tx.fileAttachmentStaging.findUnique({
			where: { id: operationId },
		});
		if (!row) {
			return { reason: "operation-not-found", status: "rejected" };
		}
		await lockWorkspaceCommand(tx, row.workspaceId, row.commandKey);
		const locked = await tx.fileAttachmentStaging.findUnique({
			where: { id: operationId },
		});
		if (!locked) {
			return { reason: "operation-not-found", status: "rejected" };
		}
		if (locked.status !== STAGED) {
			return {
				status: "refused",
				ui: {
					cancelAvailable: false,
					label: FILE_ATTACHMENT_COPY.finalizing,
				},
			};
		}
		await storeOf(deps).remove(tx, locked.objectKey);
		await tx.fileAttachmentStaging.delete({ where: { id: locked.id } });
		return {
			operation: {
				cancelAvailable: false,
				operationId: locked.id,
				status: STAGED,
				ui: { label: MUTATION_COPY.cancel },
			},
			status: "cancelled",
		};
	});
}

export async function finalizeFileUpload(
	prisma: PrismaClient,
	command: unknown,
	deps: FileAttachmentDeps = {}
): Promise<FileAttachmentOutcome> {
	const parsed = commandFromUnknown(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	try {
		const outcome = await prisma.$transaction((tx) =>
			commitFinalize(tx, parsed.command, deps)
		);
		if (
			(outcome.status === "committed" || outcome.status === "replayed") &&
			outcome.file.kind === FILE_KIND.image
		) {
			await ensureImageDerivatives(
				prisma,
				{
					contentHash: outcome.file.currentVersion.contentHash,
					kind: outcome.file.kind,
					versionId: outcome.file.currentVersion.id,
					workspaceId: parsed.command.workspaceId,
				},
				{
					engine: deps.derivatives,
					store: storeOf(deps),
				}
			);
			const refreshed = await loadFileView(prisma, outcome.file.id);
			if (refreshed) {
				return { file: refreshed, status: outcome.status };
			}
		}
		return outcome;
	} catch {
		return { reason: "bytes-incomplete", status: "rejected" };
	}
}

async function replayCommitted(
	tx: PrismaTransaction,
	command: StageFileUploadCommand,
	deps: FileAttachmentDeps,
	receipt: {
		fileAttachmentId: string;
		payloadFingerprint: string;
		versionId: string;
	}
): Promise<FileAttachmentOutcome | null> {
	const version = await tx.fileAttachmentVersion.findUnique({
		where: { id: receipt.versionId },
	});
	const blob = await storeOf(deps).read(tx, version?.objectKey ?? "");
	const file = await loadFileView(tx, receipt.fileAttachmentId);
	if (!(file && blob?.accessible)) {
		return null;
	}
	const expected = finalizeFingerprint(
		command.payload,
		contentHashOf(blob.bytes)
	);
	if (receipt.payloadFingerprint !== expected) {
		return {
			conflict: FILE_ATTACHMENT_COPY.conflict,
			status: "conflict",
		};
	}
	return { file, status: "replayed" };
}

async function commitFinalize(
	tx: PrismaTransaction,
	command: StageFileUploadCommand,
	deps: FileAttachmentDeps
): Promise<FileAttachmentOutcome> {
	await lockWorkspaceCommand(tx, command.workspaceId, command.idempotencyKey);
	const receipt = await tx.fileAttachmentReceipt.findUnique({
		where: { commandKey: command.idempotencyKey },
	});
	if (receipt) {
		const replayed = await replayCommitted(tx, command, deps, receipt);
		if (replayed) {
			return replayed;
		}
	}
	const staged = await tx.fileAttachmentStaging.findUnique({
		where: { commandKey: command.idempotencyKey },
	});
	if (!staged) {
		return { reason: "operation-not-found", status: "rejected" };
	}
	if (metadataFingerprint(command.payload) !== staged.payloadFingerprint) {
		return {
			conflict: FILE_ATTACHMENT_COPY.conflict,
			status: "conflict",
		};
	}
	if (staged.status === FINALIZING) {
		return {
			status: "refused",
			ui: {
				cancelAvailable: false,
				label: FILE_ATTACHMENT_COPY.finalizing,
			},
		};
	}
	if (!staged.bytesComplete) {
		return { reason: "bytes-incomplete", status: "rejected" };
	}
	const blob = await storeOf(deps).read(tx, staged.objectKey);
	if (!blob || blob.accessible) {
		return { reason: "bytes-incomplete", status: "rejected" };
	}
	const sniff = await sniffOf(deps)(blob.bytes);
	const classified = classifyBytes({
		byteLength: blob.bytes.byteLength,
		declaredMime: staged.declaredMime,
		filename: staged.filename,
		sniff,
	});
	if (classified.status !== "ok") {
		await storeOf(deps).remove(tx, staged.objectKey);
		await tx.fileAttachmentStaging.delete({ where: { id: staged.id } });
		return classified;
	}
	const usage = await countedUsage(tx, command.workspaceId);
	const limits = quotaLimits(deps);
	if (
		usage.bytes + blob.bytes.byteLength > limits.maxOriginalBytes ||
		usage.versions + 1 > limits.maxVersions
	) {
		await storeOf(deps).remove(tx, staged.objectKey);
		await tx.fileAttachmentStaging.delete({ where: { id: staged.id } });
		return {
			reason: FILE_ATTACHMENT_COPY.quotaExceeded,
			status: "rejected",
		};
	}
	await tx.fileAttachmentStaging.update({
		data: { status: FINALIZING },
		where: { id: staged.id },
	});
	await storeOf(deps).promote(tx, staged.objectKey);
	const hash = contentHashOf(blob.bytes);
	const fingerprint = finalizeFingerprint(command.payload, hash);
	let attachmentId = staged.targetFileAttachmentId;
	let versionNumber = 1;
	if (attachmentId) {
		const existing = await tx.fileAttachment.findUnique({
			include: { versions: true },
			where: { id: attachmentId },
		});
		if (!existing) {
			throw new Error("target-missing");
		}
		versionNumber = existing.versions.length + 1;
		await tx.fileAttachment.update({
			data: { revision: { increment: 1 } },
			where: { id: existing.id },
		});
	} else {
		const created = await tx.fileAttachment.create({
			data: {
				id: crypto.randomUUID(),
				lifecycle: FILE_LIFECYCLE.active,
				projectId: staged.projectId,
				revision: 1,
				scopeKind: staged.scopeKind,
				title: staged.filename,
				workspaceId: staged.workspaceId,
			},
		});
		attachmentId = created.id;
	}
	const version = await tx.fileAttachmentVersion.create({
		data: {
			byteLength: blob.bytes.byteLength,
			contentHash: hash,
			fileAttachmentId: attachmentId,
			filename: staged.filename,
			id: crypto.randomUUID(),
			kind: classified.kind,
			mimeType: classified.mime,
			objectKey: staged.objectKey,
			previewStatus:
				classified.kind === FILE_KIND.image
					? PREVIEW_STATUS.pending
					: PREVIEW_STATUS.ready,
			versionNumber,
		},
	});
	await tx.fileAttachmentReceipt.create({
		data: {
			commandKey: command.idempotencyKey,
			fileAttachmentId: attachmentId,
			id: crypto.randomUUID(),
			kind: COMMITTED,
			payloadFingerprint: fingerprint,
			versionId: version.id,
		},
	});
	await tx.fileAttachmentStaging.update({
		data: {
			committedAttachmentId: attachmentId,
			committedVersionId: version.id,
			status: COMMITTED,
		},
		where: { id: staged.id },
	});
	const file = await loadFileView(tx, attachmentId);
	if (!file) {
		throw new Error("visible-file-missing");
	}
	return { file, status: "committed" };
}

export async function pinFileVersion(
	prisma: PrismaClient,
	input: {
		kind: FilePinKind;
		targetId: string;
		versionId: string;
	}
): Promise<FileAttachmentView | null> {
	const version = await prisma.fileAttachmentVersion.findUnique({
		where: { id: input.versionId },
	});
	if (!version) {
		return null;
	}
	await prisma.fileAttachmentVersionPin.create({
		data: {
			id: crypto.randomUUID(),
			kind: input.kind,
			targetId: input.targetId,
			versionId: version.id,
		},
	});
	return await loadFileView(prisma, version.fileAttachmentId);
}

export async function relateFileAttachment(
	prisma: PrismaClient,
	input: { fileAttachmentId: string; kind: string; targetId: string }
): Promise<FileAttachmentView | null> {
	const file = await prisma.fileAttachment.findUnique({
		where: { id: input.fileAttachmentId },
	});
	if (!file) {
		return null;
	}
	await prisma.fileAttachmentRelation.create({
		data: {
			fromId: file.id,
			id: crypto.randomUUID(),
			kind: input.kind,
			targetId: input.targetId,
		},
	});
	return await loadFileView(prisma, file.id);
}

export async function listFileAttachmentRelations(
	prisma: PrismaClient,
	fileAttachmentId: string
): Promise<Array<{ kind: string; targetId: string }>> {
	const rows = await prisma.fileAttachmentRelation.findMany({
		orderBy: { createdAt: "asc" },
		where: { fromId: fileAttachmentId },
	});
	return rows.map((row) => ({ kind: row.kind, targetId: row.targetId }));
}

export async function setFileLifecycle(
	prisma: PrismaClient,
	input: { fileAttachmentId: string; lifecycle: FileLifecycle }
): Promise<FileAttachmentView | null> {
	const updated = await prisma.fileAttachment.update({
		data: { lifecycle: input.lifecycle, revision: { increment: 1 } },
		where: { id: input.fileAttachmentId },
	});
	return await loadFileView(prisma, updated.id);
}

export async function permanentlyDeleteFileAttachment(
	prisma: PrismaClient,
	fileAttachmentId: string,
	deps: FileAttachmentDeps = {}
): Promise<
	{ status: "deleted" } | { status: "rejected"; reason: "target-not-found" }
> {
	return await prisma.$transaction(async (tx) => {
		const row = await tx.fileAttachment.findUnique({
			include: { versions: true },
			where: { id: fileAttachmentId },
		});
		if (!row) {
			return { reason: "target-not-found", status: "rejected" };
		}
		const hashes = row.versions.map((version) => version.contentHash);
		await Promise.all(
			row.versions.map((version) => storeOf(deps).remove(tx, version.objectKey))
		);
		await tx.fileAttachment.delete({ where: { id: row.id } });
		await Promise.all(
			hashes.map((hash) => removeDerivativesForHash(tx, hash, storeOf(deps)))
		);
		return { status: "deleted" };
	});
}

export async function sweepExpiredFileStaging(
	prisma: PrismaClient,
	deps: FileAttachmentDeps = {}
): Promise<number> {
	const now = nowOf(deps);
	return await prisma.$transaction(async (tx) => {
		const expired = await tx.fileAttachmentStaging.findMany({
			where: {
				expiresAt: { lte: now },
				status: STAGED,
			},
		});
		await Promise.all(
			expired.map(async (row) => {
				await storeOf(deps).remove(tx, row.objectKey);
				await tx.fileAttachmentStaging.delete({ where: { id: row.id } });
			})
		);
		return expired.length;
	});
}
