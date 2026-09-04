import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { createRelationInTransaction } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";

import {
	type CreateFeedbackCommand,
	type CreateFeedbackFromSourceCommand,
	createFeedbackCommandSchema,
	createFeedbackFromSourceCommandSchema,
	FEEDBACK_EVENT_KIND,
	FEEDBACK_RECORD_KIND,
	FEEDBACK_STATUS,
	type FeedbackStatus,
	type FeedbackView,
	type FeedbackWriteOutcome,
	type SetFeedbackStatusCommand,
	setFeedbackStatusCommandSchema,
} from "./feedback-model";

type PrismaTransaction = Prisma.TransactionClient;

interface FeedbackRow {
	channel: string;
	id: string;
	occurredAt: Date;
	originalMessage: string;
	projectId: string;
	revision: number;
	status: string;
	url: string | null;
}

interface AttachmentRow {
	fileAttachmentId: string;
	id: string;
}

export async function createFeedback(
	prisma: PrismaClient,
	command: unknown
): Promise<FeedbackWriteOutcome> {
	const parsed = createFeedbackCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const occurredAt = parseOccurredAt(parsed.data.payload.occurredAt);
	if (!occurredAt) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		createInTransaction(tx, parsed.data, commandKey, fingerprint, occurredAt)
	);
}

export async function createFeedbackFromSource(
	prisma: PrismaClient,
	command: unknown
): Promise<FeedbackWriteOutcome> {
	const parsed = createFeedbackFromSourceCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	try {
		return await prisma.$transaction((tx) =>
			createFromSourceInTransaction(tx, parsed.data, commandKey, fingerprint)
		);
	} catch (error) {
		if (error instanceof Error && error.message === "origin-not-created") {
			return { reason: "origin-not-created", status: "rejected" };
		}
		throw error;
	}
}

export async function setFeedbackStatus(
	prisma: PrismaClient,
	command: unknown
): Promise<FeedbackWriteOutcome> {
	const parsed = setFeedbackStatusCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		setStatusInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function getFeedback(
	prisma: PrismaClient,
	feedbackId: string
): Promise<FeedbackView | null> {
	const row = await prisma.feedback.findUnique({
		where: { id: feedbackId },
	});
	if (!row) {
		return null;
	}
	const [view] = await hydrateFeedbackViews(prisma, [row]);
	return view ?? null;
}

export async function listFeedback(
	prisma: PrismaClient,
	projectId: string,
	filter: { status?: FeedbackStatus } = {}
): Promise<FeedbackView[]> {
	const rows = await prisma.feedback.findMany({
		orderBy: { occurredAt: "asc" },
		where: {
			projectId,
			...(filter.status ? { status: filter.status } : {}),
		},
	});
	return await hydrateFeedbackViews(prisma, rows);
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateFeedbackCommand,
	commandKey: string,
	fingerprint: string,
	occurredAt: Date
): Promise<FeedbackWriteOutcome> {
	await lockProject(tx, command.payload.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	return await persistFeedback(tx, {
		actorId: command.actorId,
		attachmentIds: command.payload.attachmentIds ?? [],
		channel: command.payload.channel,
		commandKey,
		fingerprint,
		occurredAt,
		originalMessage: command.payload.originalMessage,
		projectId: command.payload.projectId,
		url: command.payload.url,
	});
}

async function createFromSourceInTransaction(
	tx: PrismaTransaction,
	command: CreateFeedbackFromSourceCommand,
	commandKey: string,
	fingerprint: string
): Promise<FeedbackWriteOutcome> {
	const source = await tx.source.findUnique({
		where: { id: command.payload.sourceId },
	});
	if (!source) {
		return { reason: "source-not-found", status: "rejected" };
	}
	const version = await tx.sourceVersion.findUnique({
		where: {
			sourceId_versionNumber: {
				sourceId: source.id,
				versionNumber: source.approvedVersionNumber,
			},
		},
	});
	if (!version) {
		return { reason: "source-not-found", status: "rejected" };
	}
	await lockProject(tx, source.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const created = await persistFeedback(tx, {
		actorId: command.actorId,
		attachmentIds: [],
		channel: command.payload.channel,
		commandKey,
		fingerprint,
		occurredAt: version.accessedAt,
		originalMessage: version.capturedContent,
		projectId: source.projectId,
		url: version.url,
	});
	if (created.status !== "committed") {
		return created;
	}
	const origin = await createRelationInTransaction(tx, {
		actorId: command.actorId,
		from: { id: source.id, kind: "Source" },
		idempotencyKey: `${command.idempotencyKey}:origin`,
		origin: HUMAN_ORIGIN,
		previewAcknowledged: true,
		to: { id: created.feedback.id, kind: FEEDBACK_RECORD_KIND },
		type: RELATIONS_COPY.origin,
		viewerWorkspaceId: command.viewerWorkspaceId,
	});
	if (origin.status !== "committed" && origin.status !== "replayed") {
		throw new Error("origin-not-created");
	}
	return created;
}

async function persistFeedback(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		attachmentIds: readonly string[];
		channel: string;
		commandKey: string;
		fingerprint: string;
		occurredAt: Date;
		originalMessage: string;
		projectId: string;
		url: string | null;
	}
): Promise<FeedbackWriteOutcome> {
	const created = await tx.feedback.create({
		data: {
			channel: input.channel,
			id: crypto.randomUUID(),
			occurredAt: input.occurredAt,
			originalMessage: input.originalMessage,
			projectId: input.projectId,
			revision: 1,
			status: FEEDBACK_STATUS.new,
			url: input.url,
		},
	});
	await tx.feedbackEvent.create({
		data: {
			actorId: input.actorId,
			feedbackId: created.id,
			id: crypto.randomUUID(),
			kind: FEEDBACK_EVENT_KIND.create,
			nextStatus: FEEDBACK_STATUS.new,
			previousStatus: null,
		},
	});
	if (input.attachmentIds.length > 0) {
		await tx.feedbackAttachment.createMany({
			data: input.attachmentIds.map((fileAttachmentId) => ({
				feedbackId: created.id,
				fileAttachmentId,
				id: crypto.randomUUID(),
			})),
		});
	}
	const [view] = await hydrateFeedbackViews(tx, [created]);
	if (!view) {
		return { reason: "feedback-not-found", status: "rejected" };
	}
	await writeReceipt(tx, {
		actorId: input.actorId,
		commandKey: input.commandKey,
		fingerprint: input.fingerprint,
		view,
	});
	return { feedback: view, status: "committed" };
}

async function setStatusInTransaction(
	tx: PrismaTransaction,
	command: SetFeedbackStatusCommand,
	commandKey: string,
	fingerprint: string
): Promise<FeedbackWriteOutcome> {
	const current = await tx.feedback.findUnique({
		where: { id: command.payload.feedbackId },
	});
	if (!current) {
		return { reason: "feedback-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.feedback.findUnique({
		where: { id: current.id },
	});
	if (!locked) {
		return { reason: "feedback-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const updated = await tx.feedback.update({
		data: {
			revision: locked.revision + 1,
			status: command.payload.status,
		},
		where: { id: locked.id },
	});
	await tx.feedbackEvent.create({
		data: {
			actorId: command.actorId,
			feedbackId: updated.id,
			id: crypto.randomUUID(),
			kind: FEEDBACK_EVENT_KIND.setStatus,
			nextStatus: command.payload.status,
			previousStatus: locked.status,
		},
	});
	const [view] = await hydrateFeedbackViews(tx, [updated]);
	if (!view) {
		return { reason: "feedback-not-found", status: "rejected" };
	}
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { feedback: view, status: "committed" };
}

async function hydrateFeedbackViews(
	db: PrismaClient | PrismaTransaction,
	rows: FeedbackRow[]
): Promise<FeedbackView[]> {
	if (rows.length === 0) {
		return [];
	}
	const attachments = await db.feedbackAttachment.findMany({
		orderBy: { createdAt: "asc" },
		where: { feedbackId: { in: rows.map((row) => row.id) } },
	});
	const byFeedback = new Map<string, AttachmentRow[]>();
	for (const attachment of attachments) {
		const list = byFeedback.get(attachment.feedbackId) ?? [];
		list.push(attachment);
		byFeedback.set(attachment.feedbackId, list);
	}
	return rows.map((row) => toView(row, byFeedback.get(row.id) ?? []));
}

function toView(row: FeedbackRow, attachments: AttachmentRow[]): FeedbackView {
	return {
		attachments: attachments.map((attachment) => ({
			fileAttachmentId: attachment.fileAttachmentId,
			id: attachment.id,
		})),
		channel: row.channel,
		id: row.id,
		occurredAt: row.occurredAt.toISOString(),
		originalMessage: row.originalMessage,
		projectId: row.projectId,
		recordKind: FEEDBACK_RECORD_KIND,
		revision: row.revision,
		status: row.status as FeedbackStatus,
		url: row.url,
	};
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<FeedbackWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.feedback.findUnique({
		where: { id: existing.targetId },
	});
	if (live) {
		const [view] = await hydrateFeedbackViews(tx, [live]);
		if (view) {
			return { feedback: view, status: "replayed" };
		}
	}
	return { conflict: MUTATION_COPY.conflict, status: "conflict" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		view: FeedbackView;
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
	const [lockA, lockB] = advisoryKeys(`feedback:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

function parseOccurredAt(value: string | undefined): Date | null {
	if (!value) {
		return new Date();
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}
	return parsed;
}
