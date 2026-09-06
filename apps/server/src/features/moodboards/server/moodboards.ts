import { Prisma, type PrismaClient } from "@cantiara/db";

import { readAccessibleFileBytes } from "../../file-attachments/server/file-attachments";
import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";

import {
	type AddMoodboardVisualCommand,
	addMoodboardVisualCommandSchema,
	type CreateMoodboardCommand,
	createMoodboardCommandSchema,
	cropBoxSchema,
	MOODBOARD_KIND,
	MOODBOARD_SNAPSHOT_FORMAT,
	MOODBOARDS_COPY,
	type MoodboardSnapshotOutcome,
	type MoodboardSnapshotView,
	type MoodboardView,
	type MoodboardVisualView,
	type MoodboardWriteOutcome,
	moodboardSnapshotScopeSchema,
	presentationModeView,
	type SetMoodboardCaptionCommand,
	type SetMoodboardFocusOrderCommand,
	type SetMoodboardViewTransformCommand,
	setMoodboardCaptionCommandSchema,
	setMoodboardFocusOrderCommandSchema,
	setMoodboardViewTransformCommandSchema,
	VISUAL_ORIGIN_KIND,
	type VisualPresentationView,
} from "./moodboards-model";
import {
	buildDatedPdf,
	placeholderPresentedPng,
	renderPresentedPng,
	snapshotFilename,
	snapshotPreviewFor,
} from "./moodboards-snapshot";

type PrismaTransaction = Prisma.TransactionClient;

interface MoodboardRow {
	focusOrder: Prisma.JsonValue;
	id: string;
	projectId: string;
	revision: number;
	title: string;
}

export async function createMoodboard(
	prisma: PrismaClient,
	command: unknown
): Promise<MoodboardWriteOutcome> {
	const parsed = createMoodboardCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		createInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function addMoodboardVisual(
	prisma: PrismaClient,
	command: unknown
): Promise<MoodboardWriteOutcome> {
	const parsed = addMoodboardVisualCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		addVisualInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function setMoodboardCaption(
	prisma: PrismaClient,
	command: unknown
): Promise<MoodboardWriteOutcome> {
	const parsed = setMoodboardCaptionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		setCaptionInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function setMoodboardViewTransform(
	prisma: PrismaClient,
	command: unknown
): Promise<MoodboardWriteOutcome> {
	const parsed = setMoodboardViewTransformCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		setTransformInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function setMoodboardFocusOrder(
	prisma: PrismaClient,
	command: unknown
): Promise<MoodboardWriteOutcome> {
	const parsed = setMoodboardFocusOrderCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		setFocusOrderInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function getMoodboard(
	prisma: PrismaClient,
	moodboardId: string
): Promise<MoodboardView | null> {
	const row = await prisma.moodboard.findUnique({
		where: { id: moodboardId },
	});
	if (!row) {
		return null;
	}
	return await toView(prisma, row);
}

export async function presentMoodboard(
	prisma: PrismaClient,
	input: { moodboardId: string; presentationMode: boolean }
) {
	const moodboard = await getMoodboard(prisma, input.moodboardId);
	if (!moodboard) {
		return null;
	}
	return {
		moodboard,
		presentationMode: input.presentationMode
			? presentationModeView({
					focusOrder: moodboard.focusOrder,
					moodboardId: moodboard.id,
				})
			: null,
	};
}

export async function listMoodboards(
	prisma: PrismaClient,
	projectId: string
): Promise<MoodboardView[]> {
	const rows = await prisma.moodboard.findMany({
		orderBy: { createdAt: "asc" },
		where: { projectId },
	});
	return await Promise.all(rows.map((row) => toView(prisma, row)));
}

export async function getMoodboardByVisualId(
	prisma: PrismaClient,
	visualId: string
): Promise<MoodboardView | null> {
	const visual = await prisma.moodboardVisual.findUnique({
		where: { id: visualId },
	});
	if (!visual) {
		return null;
	}
	return await getMoodboard(prisma, visual.moodboardId);
}

export async function previewMoodboardSnapshot(
	prisma: PrismaClient,
	scope: unknown
): Promise<MoodboardSnapshotOutcome> {
	const prepared = await prepareSnapshot(prisma, scope);
	if (prepared.status !== "prepared") {
		return prepared;
	}
	return {
		snapshot: {
			approvedSnapshotRevision: false,
			brandGuide: false,
			externalSurface: false,
			files: [],
			liveSourceLinks: false,
			preview: prepared.preview,
			shareLink: false,
			sourceMutation: false,
		},
		status: "ok",
	};
}

export async function exportMoodboardSnapshot(
	prisma: PrismaClient,
	scope: unknown
): Promise<MoodboardSnapshotOutcome> {
	const prepared = await prepareSnapshot(prisma, scope);
	if (prepared.status !== "prepared") {
		return prepared;
	}
	const files = await filesForSnapshot(prisma, prepared);
	return {
		snapshot: {
			approvedSnapshotRevision: false,
			brandGuide: false,
			externalSurface: false,
			files,
			liveSourceLinks: false,
			preview: prepared.preview,
			shareLink: false,
			sourceMutation: false,
		},
		status: "ok",
	};
}

export async function listProjectWallCardsSpawnedFrom(
	prisma: PrismaClient,
	moodboardId: string
): Promise<readonly { id: string }[]> {
	const found = await prisma.$queryRaw<Array<{ name: string | null }>>`
		SELECT to_regclass('public.project_wall_card')::text AS name
	`;
	if (!found[0]?.name) {
		return [];
	}
	return await prisma.$queryRaw<Array<{ id: string }>>`
		SELECT id
		FROM project_wall_card
		WHERE "sourceId" = ${moodboardId}
	`;
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateMoodboardCommand,
	commandKey: string,
	fingerprint: string
): Promise<MoodboardWriteOutcome> {
	await lockProject(tx, command.payload.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const created = await tx.moodboard.create({
		data: {
			focusOrder: [],
			id: crypto.randomUUID(),
			projectId: command.payload.projectId,
			revision: 1,
			title: command.payload.title,
		},
	});
	const view = await toView(tx, created);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { moodboard: view, status: "committed" };
}

async function addVisualInTransaction(
	tx: PrismaTransaction,
	command: AddMoodboardVisualCommand,
	commandKey: string,
	fingerprint: string
): Promise<MoodboardWriteOutcome> {
	const current = await tx.moodboard.findUnique({
		where: { id: command.payload.moodboardId },
	});
	if (!current) {
		return { reason: "moodboard-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const originFields = await originFieldsFor(tx, current.projectId, command);
	if (originFields.status === "rejected") {
		return originFields;
	}
	const last = await tx.moodboardVisual.findFirst({
		orderBy: { sortOrder: "desc" },
		where: { moodboardId: current.id },
	});
	await tx.moodboardVisual.create({
		data: {
			caption: command.payload.caption ?? "",
			crop: undefined,
			externalUrl: originFields.externalUrl,
			fileAttachmentVersionId: originFields.fileAttachmentVersionId,
			id: crypto.randomUUID(),
			moodboardId: current.id,
			originKind: originFields.originKind,
			rotation: 0,
			sortOrder: (last?.sortOrder ?? 0) + 1,
		},
	});
	const updated = await tx.moodboard.update({
		data: { revision: current.revision + 1 },
		where: { id: current.id },
	});
	const view = await toView(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { moodboard: view, status: "committed" };
}

async function setCaptionInTransaction(
	tx: PrismaTransaction,
	command: SetMoodboardCaptionCommand,
	commandKey: string,
	fingerprint: string
): Promise<MoodboardWriteOutcome> {
	const visual = await tx.moodboardVisual.findUnique({
		where: { id: command.payload.visualId },
	});
	if (!visual) {
		return { reason: "visual-not-found", status: "rejected" };
	}
	const current = await tx.moodboard.findUnique({
		where: { id: visual.moodboardId },
	});
	if (!current) {
		return { reason: "moodboard-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	if (current.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	await tx.moodboardVisual.update({
		data: { caption: command.payload.caption },
		where: { id: visual.id },
	});
	const updated = await tx.moodboard.update({
		data: { revision: current.revision + 1 },
		where: { id: current.id },
	});
	const view = await toView(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { moodboard: view, status: "committed" };
}

async function setTransformInTransaction(
	tx: PrismaTransaction,
	command: SetMoodboardViewTransformCommand,
	commandKey: string,
	fingerprint: string
): Promise<MoodboardWriteOutcome> {
	const visual = await tx.moodboardVisual.findUnique({
		where: { id: command.payload.visualId },
	});
	if (!visual) {
		return { reason: "visual-not-found", status: "rejected" };
	}
	const current = await tx.moodboard.findUnique({
		where: { id: visual.moodboardId },
	});
	if (!current) {
		return { reason: "moodboard-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	if (current.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	await tx.moodboardVisual.update({
		data: {
			crop:
				command.payload.crop === null ? Prisma.DbNull : command.payload.crop,
			rotation: command.payload.rotation,
		},
		where: { id: visual.id },
	});
	const updated = await tx.moodboard.update({
		data: { revision: current.revision + 1 },
		where: { id: current.id },
	});
	const view = await toView(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { moodboard: view, status: "committed" };
}

async function setFocusOrderInTransaction(
	tx: PrismaTransaction,
	command: SetMoodboardFocusOrderCommand,
	commandKey: string,
	fingerprint: string
): Promise<MoodboardWriteOutcome> {
	const current = await tx.moodboard.findUnique({
		where: { id: command.payload.moodboardId },
	});
	if (!current) {
		return { reason: "moodboard-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	if (current.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const visuals = await tx.moodboardVisual.findMany({
		select: { id: true },
		where: { moodboardId: current.id },
	});
	const known = new Set(visuals.map((row) => row.id));
	if (
		command.payload.visualIds.length !== known.size ||
		command.payload.visualIds.some((id) => !known.has(id))
	) {
		return { reason: "focus-order-mismatch", status: "rejected" };
	}
	const updated = await tx.moodboard.update({
		data: {
			focusOrder: command.payload.visualIds,
			revision: current.revision + 1,
		},
		where: { id: current.id },
	});
	const view = await toView(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { moodboard: view, status: "committed" };
}

async function originFieldsFor(
	tx: PrismaTransaction,
	projectId: string,
	command: AddMoodboardVisualCommand
): Promise<
	| {
			externalUrl: string | null;
			fileAttachmentVersionId: string | null;
			originKind: string;
			status: "ok";
	  }
	| { reason: "file-attachment-not-found"; status: "rejected" }
> {
	if (command.payload.origin.kind === VISUAL_ORIGIN_KIND.externalLink) {
		return {
			externalUrl: command.payload.origin.url,
			fileAttachmentVersionId: null,
			originKind: VISUAL_ORIGIN_KIND.externalLink,
			status: "ok",
		};
	}
	const version = await tx.fileAttachmentVersion.findUnique({
		include: { fileAttachment: true },
		where: { id: command.payload.origin.fileAttachmentVersionId },
	});
	if (
		!version ||
		version.fileAttachment.projectId !== projectId ||
		version.fileAttachment.scopeKind !== "project"
	) {
		return { reason: "file-attachment-not-found", status: "rejected" };
	}
	return {
		externalUrl: null,
		fileAttachmentVersionId: version.id,
		originKind: VISUAL_ORIGIN_KIND.fileAttachment,
		status: "ok",
	};
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<MoodboardWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.moodboard.findUnique({
		where: { id: existing.targetId },
	});
	if (live) {
		return {
			moodboard: await toView(tx, live),
			status: "replayed",
		};
	}
	return { conflict: MUTATION_COPY.conflict, status: "conflict" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		view: MoodboardView;
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

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`moodboards:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

async function toView(
	db: PrismaClient | PrismaTransaction,
	row: MoodboardRow
): Promise<MoodboardView> {
	const visuals = await db.moodboardVisual.findMany({
		include: {
			fileAttachmentVersion: { include: { fileAttachment: true } },
		},
		orderBy: { sortOrder: "asc" },
		where: { moodboardId: row.id },
	});
	return {
		focusOrder: parseFocusOrder(row.focusOrder),
		id: row.id,
		projectId: row.projectId,
		recordKind: MOODBOARD_KIND,
		revision: row.revision,
		title: row.title,
		visuals: visuals.map(presentVisual),
	};
}

function presentVisual(row: {
	caption: string;
	crop: Prisma.JsonValue;
	externalUrl: string | null;
	fileAttachmentVersion: {
		fileAttachment: { id: string; title: string };
		id: string;
	} | null;
	id: string;
	originKind: string;
	rotation: number;
}): MoodboardVisualView {
	const presentation = presentTransform(row);
	if (
		row.originKind === VISUAL_ORIGIN_KIND.fileAttachment &&
		row.fileAttachmentVersion
	) {
		return {
			caption: row.caption,
			id: row.id,
			origin: {
				fileAttachmentId: row.fileAttachmentVersion.fileAttachment.id,
				fileAttachmentVersionId: row.fileAttachmentVersion.id,
				kind: VISUAL_ORIGIN_KIND.fileAttachment,
				title: row.fileAttachmentVersion.fileAttachment.title,
			},
			presentation,
		};
	}
	return {
		caption: row.caption,
		id: row.id,
		origin: {
			kind: VISUAL_ORIGIN_KIND.externalLink,
			url: row.externalUrl ?? "",
		},
		presentation,
	};
}

function presentTransform(row: {
	crop: Prisma.JsonValue;
	fileAttachmentVersion: { id: string } | null;
	originKind: string;
	rotation: number;
}): VisualPresentationView {
	const cropParsed = cropBoxSchema.safeParse(row.crop);
	const rotation =
		row.rotation === 90 || row.rotation === 180 || row.rotation === 270
			? row.rotation
			: 0;
	const bound = row.fileAttachmentVersion;
	const fileAttachmentVersionId =
		row.originKind === VISUAL_ORIGIN_KIND.fileAttachment && bound
			? bound.id
			: null;
	return {
		crop: cropParsed.success ? cropParsed.data : null,
		fileAttachmentVersionId,
		originalDownloadable: fileAttachmentVersionId !== null,
		rotation,
	};
}

function parseFocusOrder(value: Prisma.JsonValue): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((entry): entry is string => typeof entry === "string");
}

async function prepareSnapshot(
	prisma: PrismaClient,
	scope: unknown
): Promise<
	| MoodboardSnapshotOutcome
	| {
			moodboard: MoodboardView;
			preview: MoodboardSnapshotView["preview"];
			selected: MoodboardVisualView[];
			status: "prepared";
			workspaceId: string;
	  }
> {
	const parsed = moodboardSnapshotScopeSchema.safeParse(scope);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.fitEntireBoardOnOnePage) {
		return { reason: "smash-entire-board", status: "rejected" };
	}
	const moodboard = await getMoodboard(prisma, parsed.data.moodboardId);
	if (!moodboard) {
		return { reason: "moodboard-not-found", status: "rejected" };
	}
	const byId = new Map(moodboard.visuals.map((visual) => [visual.id, visual]));
	const selected: MoodboardVisualView[] = [];
	for (const visualId of parsed.data.visualIds) {
		const visual = byId.get(visualId);
		if (!visual) {
			return { reason: "visual-not-found", status: "rejected" };
		}
		selected.push(visual);
	}
	const project = await prisma.project.findUnique({
		select: { workspaceId: true },
		where: { id: moodboard.projectId },
	});
	if (!project) {
		return { reason: "moodboard-not-found", status: "rejected" };
	}
	const viewMoment = new Date().toISOString();
	return {
		moodboard,
		preview: snapshotPreviewFor(selected, parsed.data.format, viewMoment),
		selected,
		status: "prepared",
		workspaceId: project.workspaceId,
	};
}

async function filesForSnapshot(
	prisma: PrismaClient,
	prepared: {
		preview: MoodboardSnapshotView["preview"];
		selected: MoodboardVisualView[];
		workspaceId: string;
	}
): Promise<MoodboardSnapshotView["files"]> {
	const presented = await Promise.all(
		prepared.selected.map(async (visual) => {
			const png = await presentedBytesFor(prisma, visual, prepared.workspaceId);
			return { png, visual };
		})
	);
	const producedAt = prepared.preview.viewMoment;
	if (prepared.preview.format === MOODBOARD_SNAPSHOT_FORMAT.png) {
		return presented.map(({ png, visual }) => ({
			bytes: new Uint8Array(png),
			filename: snapshotFilename({
				format: MOODBOARD_SNAPSHOT_FORMAT.png,
				producedAt,
				visualId: visual.id,
			}),
			mimeType: "image/png",
			pageCount: 1,
			visualId: visual.id,
		}));
	}
	const pdf = await buildDatedPdf({
		pages: presented.map(({ png, visual }) => ({
			jpeg: png,
			visualId: visual.id,
		})),
		producedAt,
		title: MOODBOARDS_COPY.snapshot,
	});
	return [
		{
			bytes: new Uint8Array(pdf),
			filename: snapshotFilename({
				format: MOODBOARD_SNAPSHOT_FORMAT.pdf,
				producedAt,
				visualId: null,
			}),
			mimeType: "application/pdf",
			pageCount: presented.length,
			visualId: null,
		},
	];
}

async function presentedBytesFor(
	prisma: PrismaClient,
	visual: MoodboardVisualView,
	workspaceId: string
): Promise<Uint8Array> {
	if (visual.origin.kind !== VISUAL_ORIGIN_KIND.fileAttachment) {
		return await placeholderPresentedPng();
	}
	const original = await readAccessibleFileBytes(prisma, {
		fileAttachmentId: visual.origin.fileAttachmentId,
		versionId: visual.origin.fileAttachmentVersionId,
		workspaceId,
	});
	if (!original) {
		return await placeholderPresentedPng();
	}
	return await renderPresentedPng({
		original: original.bytes,
		presentation: visual.presentation,
	});
}
