import type { Prisma, PrismaClient } from "@cantiara/db";

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
	MOODBOARD_KIND,
	type MoodboardView,
	type MoodboardVisualView,
	type MoodboardWriteOutcome,
	type SetMoodboardCaptionCommand,
	setMoodboardCaptionCommandSchema,
	VISUAL_ORIGIN_KIND,
} from "./moodboards-model";

type PrismaTransaction = Prisma.TransactionClient;

interface MoodboardRow {
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
			externalUrl: originFields.externalUrl,
			fileAttachmentVersionId: originFields.fileAttachmentVersionId,
			id: crypto.randomUUID(),
			moodboardId: current.id,
			originKind: originFields.originKind,
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
	externalUrl: string | null;
	fileAttachmentVersion: {
		fileAttachment: { id: string; title: string };
		id: string;
	} | null;
	id: string;
	originKind: string;
}): MoodboardVisualView {
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
		};
	}
	return {
		caption: row.caption,
		id: row.id,
		origin: {
			kind: VISUAL_ORIGIN_KIND.externalLink,
			url: row.externalUrl ?? "",
		},
	};
}
