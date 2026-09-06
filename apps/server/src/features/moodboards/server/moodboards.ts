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
	type AddColorSwatchCommand,
	type AddMoodboardVisualCommand,
	type AddPaletteGroupCommand,
	addColorSwatchCommandSchema,
	addMoodboardVisualCommandSchema,
	addPaletteGroupCommandSchema,
	COLOR_SOURCE_KIND,
	type ColorInput,
	type ColorSwatchView,
	type CreateMoodboardCommand,
	createMoodboardCommandSchema,
	cropBoxSchema,
	fileAttachmentOpenHref,
	type GroupOutlineCommand,
	groupOutlineCommandSchema,
	MOODBOARD_KIND,
	MOODBOARD_SNAPSHOT_FORMAT,
	MOODBOARDS_COPY,
	type MoodboardSnapshotOutcome,
	type MoodboardSnapshotView,
	type MoodboardView,
	type MoodboardVisualView,
	type MoodboardWriteOutcome,
	moodboardSnapshotScopeSchema,
	type PaletteGroupView,
	type PersonalViewport,
	presentationModeView,
	presentedColorFromHex,
	presentedColorFromInput,
	type ReorderOutlineCommand,
	reorderOutlineCommandSchema,
	restorePersonalViewport,
	type SetMoodboardCaptionCommand,
	type SetMoodboardFocusOrderCommand,
	type SetMoodboardViewTransformCommand,
	savePersonalViewportCommandSchema,
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

export async function addPaletteGroup(
	prisma: PrismaClient,
	command: unknown
): Promise<MoodboardWriteOutcome> {
	const parsed = addPaletteGroupCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		addPaletteGroupInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function addColorSwatch(
	prisma: PrismaClient,
	command: unknown
): Promise<MoodboardWriteOutcome> {
	const parsed = addColorSwatchCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		addColorSwatchInTransaction(tx, parsed.data, commandKey, fingerprint)
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

export async function groupOutline(
	prisma: PrismaClient,
	command: unknown
): Promise<MoodboardWriteOutcome> {
	const parsed = groupOutlineCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		groupOutlineInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function reorderOutline(
	prisma: PrismaClient,
	command: unknown
): Promise<MoodboardWriteOutcome> {
	const parsed = reorderOutlineCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		reorderOutlineInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function savePersonalViewport(
	prisma: PrismaClient,
	command: unknown
): Promise<
	| { status: "committed"; viewport: PersonalViewport }
	| { reason: "invalid-command" | "moodboard-not-found"; status: "rejected" }
> {
	const parsed = savePersonalViewportCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const current = await prisma.moodboard.findUnique({
		where: { id: parsed.data.payload.moodboardId },
	});
	if (!current) {
		return { reason: "moodboard-not-found", status: "rejected" };
	}
	const { viewport } = parsed.data.payload;
	await prisma.moodboardPersonalViewport.upsert({
		create: {
			centerX: viewport.centerX,
			centerY: viewport.centerY,
			collapsedGroupIds: viewport.collapsedGroupIds,
			id: crypto.randomUUID(),
			moodboardId: current.id,
			userId: parsed.data.actorId,
			zoom: viewport.zoom,
		},
		update: {
			centerX: viewport.centerX,
			centerY: viewport.centerY,
			collapsedGroupIds: viewport.collapsedGroupIds,
			zoom: viewport.zoom,
		},
		where: {
			moodboardId_userId: {
				moodboardId: current.id,
				userId: parsed.data.actorId,
			},
		},
	});
	return {
		status: "committed",
		viewport,
	};
}

export async function getPersonalViewport(
	prisma: PrismaClient,
	input: { actorId: string; moodboardId: string }
): Promise<ReturnType<typeof restorePersonalViewport> | null> {
	const current = await prisma.moodboard.findUnique({
		where: { id: input.moodboardId },
	});
	if (!current) {
		return null;
	}
	const view = await toView(prisma, current);
	const row = await prisma.moodboardPersonalViewport.findUnique({
		where: {
			moodboardId_userId: {
				moodboardId: current.id,
				userId: input.actorId,
			},
		},
	});
	return restorePersonalViewport({
		content: {
			groups: view.groups,
			visuals: view.visuals,
		},
		saved: row
			? {
					centerX: row.centerX,
					centerY: row.centerY,
					collapsedGroupIds: collapsedIdsFromJson(row.collapsedGroupIds),
					zoom: row.zoom,
				}
			: null,
	});
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

async function groupOutlineInTransaction(
	tx: PrismaTransaction,
	command: GroupOutlineCommand,
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
	const uniqueIds = [...new Set(command.payload.visualIds)];
	const visuals = await tx.moodboardVisual.findMany({
		where: { id: { in: uniqueIds }, moodboardId: current.id },
	});
	if (visuals.length !== uniqueIds.length) {
		return { reason: "visuals-not-found", status: "rejected" };
	}
	const lastGroup = await tx.moodboardGroup.findFirst({
		orderBy: { sortOrder: "desc" },
		where: { moodboardId: current.id },
	});
	const group = await tx.moodboardGroup.create({
		data: {
			id: crypto.randomUUID(),
			moodboardId: current.id,
			sortOrder: (lastGroup?.sortOrder ?? 0) + 1,
			title: command.payload.title ?? MOODBOARDS_COPY.group,
		},
	});
	await tx.moodboardVisual.updateMany({
		data: { groupId: group.id },
		where: { id: { in: uniqueIds } },
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

async function reorderOutlineInTransaction(
	tx: PrismaTransaction,
	command: ReorderOutlineCommand,
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
	const existing = await tx.moodboardVisual.findMany({
		where: { moodboardId: current.id },
	});
	const existingIds = new Set(existing.map((visual) => visual.id));
	const uniqueIds = [...new Set(command.payload.visualIds)];
	if (
		uniqueIds.length !== existing.length ||
		uniqueIds.some((id) => !existingIds.has(id))
	) {
		return { reason: "visuals-not-found", status: "rejected" };
	}
	await Promise.all(
		uniqueIds.map((visualId, index) =>
			tx.moodboardVisual.update({
				data: { sortOrder: index + 1 },
				where: { id: visualId },
			})
		)
	);
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

async function addPaletteGroupInTransaction(
	tx: PrismaTransaction,
	command: AddPaletteGroupCommand,
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
	const last = await tx.moodboardPaletteGroup.findFirst({
		orderBy: { sortOrder: "desc" },
		where: { moodboardId: current.id },
	});
	await tx.moodboardPaletteGroup.create({
		data: {
			id: crypto.randomUUID(),
			moodboardId: current.id,
			sortOrder: (last?.sortOrder ?? 0) + 1,
			title: command.payload.title,
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

async function addColorSwatchInTransaction(
	tx: PrismaTransaction,
	command: AddColorSwatchCommand,
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
	const source = await sourceFieldsFor(tx, current.id, command.payload.color);
	if (source.status === "rejected") {
		return source;
	}
	let paletteGroupId: string | null = null;
	if (command.payload.paletteGroupId) {
		const group = await tx.moodboardPaletteGroup.findUnique({
			where: { id: command.payload.paletteGroupId },
		});
		if (!group || group.moodboardId !== current.id) {
			return { reason: "palette-group-not-found", status: "rejected" };
		}
		paletteGroupId = group.id;
	}
	const last = await tx.moodboardColorSwatch.findFirst({
		orderBy: { sortOrder: "desc" },
		where: { moodboardId: current.id },
	});
	const presented = presentedColorFromInput(command.payload.color);
	await tx.moodboardColorSwatch.create({
		data: {
			hex: presented.hex,
			id: crypto.randomUUID(),
			moodboardId: current.id,
			note: command.payload.note ?? "",
			paletteGroupId,
			sortOrder: (last?.sortOrder ?? 0) + 1,
			sourceKind: source.sourceKind,
			sourceVisualId: source.sourceVisualId,
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

async function sourceFieldsFor(
	tx: PrismaTransaction,
	moodboardId: string,
	color: ColorInput
): Promise<
	| {
			sourceKind: string;
			sourceVisualId: string | null;
			status: "ok";
	  }
	| { reason: "visual-not-found"; status: "rejected" }
> {
	if (color.kind !== COLOR_SOURCE_KIND.eyedrop) {
		return {
			sourceKind: color.kind,
			sourceVisualId: null,
			status: "ok",
		};
	}
	const visual = await tx.moodboardVisual.findUnique({
		where: { id: color.visualId },
	});
	if (!visual || visual.moodboardId !== moodboardId) {
		return { reason: "visual-not-found", status: "rejected" };
	}
	return {
		sourceKind: COLOR_SOURCE_KIND.eyedrop,
		sourceVisualId: visual.id,
		status: "ok",
	};
}

async function toView(
	db: PrismaClient | PrismaTransaction,
	row: MoodboardRow
): Promise<MoodboardView> {
	const groups = await db.moodboardGroup.findMany({
		orderBy: { sortOrder: "asc" },
		where: { moodboardId: row.id },
	});
	const visuals = await db.moodboardVisual.findMany({
		include: {
			fileAttachmentVersion: { include: { fileAttachment: true } },
		},
		orderBy: { sortOrder: "asc" },
		where: { moodboardId: row.id },
	});
	const paletteGroups = await db.moodboardPaletteGroup.findMany({
		include: {
			colorSwatches: { orderBy: { sortOrder: "asc" } },
		},
		orderBy: { sortOrder: "asc" },
		where: { moodboardId: row.id },
	});
	const ungrouped = await db.moodboardColorSwatch.findMany({
		orderBy: { sortOrder: "asc" },
		where: { moodboardId: row.id, paletteGroupId: null },
	});
	return {
		colorSwatches: ungrouped.map(presentColorSwatch),
		focusOrder: parseFocusOrder(row.focusOrder),
		groups: groups.map((group) => ({
			id: group.id,
			sortOrder: group.sortOrder,
			title: group.title,
			visualIds: visuals
				.filter((visual) => visual.groupId === group.id)
				.map((visual) => visual.id),
		})),
		id: row.id,
		paletteGroups: paletteGroups.map(presentPaletteGroup),
		projectId: row.projectId,
		recordKind: MOODBOARD_KIND,
		revision: row.revision,
		title: row.title,
		visuals: visuals.map((visual) => presentVisual(row.projectId, visual)),
	};
}

function presentPaletteGroup(row: {
	colorSwatches: ColorSwatchRow[];
	id: string;
	title: string;
}): PaletteGroupView {
	return {
		colorSwatches: row.colorSwatches.map(presentColorSwatch),
		id: row.id,
		title: row.title,
	};
}

interface ColorSwatchRow {
	hex: string;
	id: string;
	note: string;
	paletteGroupId: string | null;
	sourceKind: string;
	sourceVisualId: string | null;
}

function presentColorSwatch(row: ColorSwatchRow): ColorSwatchView {
	const color = presentedColorFromHex(row.hex);
	return {
		hex: color.hex,
		hsl: color.hsl,
		id: row.id,
		note: row.note,
		paletteGroupId: row.paletteGroupId,
		rgb: color.rgb,
		source: presentColorSource(row),
	};
}

function presentColorSource(row: ColorSwatchRow): ColorSwatchView["source"] {
	if (row.sourceKind === COLOR_SOURCE_KIND.eyedrop && row.sourceVisualId) {
		return {
			kind: COLOR_SOURCE_KIND.eyedrop,
			visualId: row.sourceVisualId,
		};
	}
	if (row.sourceKind === COLOR_SOURCE_KIND.picker) {
		return { kind: COLOR_SOURCE_KIND.picker };
	}
	if (row.sourceKind === COLOR_SOURCE_KIND.rgb) {
		return { kind: COLOR_SOURCE_KIND.rgb };
	}
	if (row.sourceKind === COLOR_SOURCE_KIND.hsl) {
		return { kind: COLOR_SOURCE_KIND.hsl };
	}
	return { kind: COLOR_SOURCE_KIND.hex };
}

function presentVisual(
	projectId: string,
	row: {
		caption: string;
		crop: Prisma.JsonValue;
		externalUrl: string | null;
		fileAttachmentVersion: {
			fileAttachment: { id: string; title: string };
			id: string;
		} | null;
		groupId: string | null;
		id: string;
		originKind: string;
		rotation: number;
	}
): MoodboardVisualView {
	const presentation = presentTransform(row);
	if (
		row.originKind === VISUAL_ORIGIN_KIND.fileAttachment &&
		row.fileAttachmentVersion
	) {
		return {
			caption: row.caption,
			groupId: row.groupId,
			id: row.id,
			openHref: fileAttachmentOpenHref(
				projectId,
				row.fileAttachmentVersion.fileAttachment.id
			),
			openSourceRecord: MOODBOARDS_COPY.openSourceRecord,
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
		groupId: row.groupId,
		id: row.id,
		openHref: row.externalUrl,
		openSourceRecord: MOODBOARDS_COPY.openSourceRecord,
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

function collapsedIdsFromJson(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((item): item is string => typeof item === "string");
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
