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
import { presentNamedView } from "../../smart-collections/server/smart-collections-model";
import { createWorkInTransaction } from "../../work-lifecycle/server/work-lifecycle";

import {
	type BindFeedbackOriginCommand,
	type BindFeedbackOriginOutcome,
	bindFeedbackOriginCommandSchema,
	type ConvertFeedbackOutcome,
	type ConvertFeedbackPreview,
	type ConvertFeedbackToWorkCommand,
	type CreateFeedbackCommand,
	type CreateFeedbackFromSourceCommand,
	convertFeedbackToWorkCommandSchema,
	createFeedbackCommandSchema,
	createFeedbackFromSourceCommandSchema,
	FEEDBACK_COPY,
	FEEDBACK_EVENT_KIND,
	FEEDBACK_RECORD_KIND,
	FEEDBACK_STATUS,
	type FeedbackStatus,
	type FeedbackView,
	type FeedbackWriteOutcome,
	type FeedRow,
	type FeedView,
	type ListFeedQuery,
	listFeedQuerySchema,
	type PreviewConvertFeedbackOutcome,
	previewConvertFeedbackToWorkInputSchema,
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
	try {
		return await prisma.$transaction((tx) =>
			createInTransaction(tx, parsed.data, commandKey, fingerprint, occurredAt)
		);
	} catch (error) {
		return identityWriteError(error);
	}
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
		const identity = identityWriteError(error);
		if (identity.status === "rejected") {
			return identity;
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

export async function previewConvertFeedbackToWork(
	prisma: PrismaClient,
	input: unknown
): Promise<PreviewConvertFeedbackOutcome> {
	const parsed = previewConvertFeedbackToWorkInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const row = await prisma.feedback.findUnique({
		where: { id: parsed.data.feedbackId },
	});
	if (!row) {
		return { reason: "feedback-not-found", status: "rejected" };
	}
	return {
		preview: withConvertFingerprint({
			body: row.originalMessage,
			label: FEEDBACK_COPY.convertToWork,
			origin: RELATIONS_COPY.origin,
			projectId: parsed.data.projectId ?? row.projectId,
			recordKind: "Work",
			recordsToCreate: 1,
			title: mappedTitle(row.originalMessage, parsed.data.title),
		}),
		status: "ok",
	};
}

export async function convertFeedbackToWork(
	prisma: PrismaClient,
	command: unknown
): Promise<ConvertFeedbackOutcome> {
	const parsed = convertFeedbackToWorkCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.payload.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	if (!parsed.data.payload.previewFingerprint) {
		return { reason: "preview-required", status: "rejected" };
	}
	const previewed = await previewConvertFeedbackToWork(prisma, {
		feedbackId: parsed.data.payload.feedbackId,
		projectId: parsed.data.payload.projectId,
		title: parsed.data.payload.title,
	});
	if (previewed.status !== "ok") {
		return previewed;
	}
	if (
		convertFingerprint(previewed.preview) !==
		parsed.data.payload.previewFingerprint
	) {
		return { reason: "preview-mismatch", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	try {
		return await prisma.$transaction((tx) =>
			convertInTransaction(
				tx,
				parsed.data,
				previewed.preview,
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

export async function bindFeedbackOrigin(
	prisma: PrismaClient,
	command: unknown
): Promise<BindFeedbackOriginOutcome> {
	const parsed = bindFeedbackOriginCommandSchema.safeParse(command);
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
			bindOriginInTransaction(tx, parsed.data, commandKey, fingerprint)
		);
	} catch (error) {
		if (error instanceof BindBarrierError) {
			return error.outcome;
		}
		throw error;
	}
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

const FEED_WRITES = { priority: false, status: false } as const;

export async function listFeed(
	prisma: PrismaClient,
	query: unknown
): Promise<FeedView> {
	const parsed = listFeedQuerySchema.safeParse(query);
	if (!parsed.success) {
		return emptyFeed();
	}
	const rows = await collectFeedRows(prisma, parsed.data);
	const ordered = orderFeedRows(rows, parsed.data);
	return {
		notificationSignals: [],
		rows: ordered,
		socialActions: [],
		writes: FEED_WRITES,
	};
}

function emptyFeed(): FeedView {
	return {
		notificationSignals: [],
		rows: [],
		socialActions: [],
		writes: FEED_WRITES,
	};
}

async function collectFeedRows(
	prisma: PrismaClient,
	query: ListFeedQuery
): Promise<FeedRow[]> {
	const [feedbackRows, sources] = await Promise.all([
		listFeedback(prisma, query.projectId),
		prisma.source.findMany({
			include: { versions: { orderBy: { versionNumber: "asc" } } },
			where: { projectId: query.projectId },
		}),
	]);
	const identities = await loadContactNames(
		prisma,
		feedbackRows.flatMap((row) => (row.contactId ? [row.contactId] : []))
	);
	const feedbackFeed = feedbackRows.map((row) => ({
		attachments: row.attachments,
		body: row.originalMessage,
		id: row.id,
		identityOrChannel:
			(row.contactId ? identities.get(row.contactId) : undefined) ??
			row.channel,
		occurredAt: row.occurredAt,
		openSourceRecord: FEEDBACK_COPY.openSourceRecord,
		projectId: row.projectId,
		recordKind: FEEDBACK_RECORD_KIND,
		relatedDecisionIds: [] as string[],
		relatedWorkIds: [] as string[],
	}));
	const sourceFeed: FeedRow[] = [];
	for (const source of sources) {
		const approved = source.versions.find(
			(version) => version.versionNumber === source.approvedVersionNumber
		);
		if (!approved || approved.capturedContent.trim().length === 0) {
			continue;
		}
		sourceFeed.push({
			attachments: [],
			body: approved.capturedContent,
			id: source.id,
			identityOrChannel: approved.title,
			occurredAt: approved.accessedAt.toISOString(),
			openSourceRecord: FEEDBACK_COPY.openSourceRecord,
			projectId: source.projectId,
			recordKind: "Source",
			relatedDecisionIds: [],
			relatedWorkIds: [],
		});
	}
	const rows = [...feedbackFeed, ...sourceFeed];
	await attachRelatedRecords(prisma, rows);
	return rows;
}

async function loadContactNames(
	prisma: PrismaClient,
	contactIds: readonly string[]
): Promise<Map<string, string>> {
	const names = new Map<string, string>();
	if (contactIds.length === 0) {
		return names;
	}
	const contacts = await prisma.contact.findMany({
		where: { id: { in: [...contactIds] } },
	});
	for (const contact of contacts) {
		if (contact.displayName) {
			names.set(contact.id, contact.displayName);
		}
	}
	return names;
}

async function attachRelatedRecords(
	prisma: PrismaClient,
	rows: FeedRow[]
): Promise<void> {
	if (rows.length === 0) {
		return;
	}
	const ids = rows.map((row) => row.id);
	const edges = await prisma.typedRelation.findMany({
		where: {
			OR: [{ fromId: { in: ids } }, { toId: { in: ids } }],
		},
	});
	const byId = new Map(rows.map((row) => [row.id, row]));
	for (const edge of edges) {
		const relatedKind = relatedWorkOrDecision(edge);
		if (!relatedKind) {
			continue;
		}
		const owner = byId.get(edge.fromId) ?? byId.get(edge.toId);
		if (!owner) {
			continue;
		}
		if (
			relatedKind.kind === "Work" &&
			!owner.relatedWorkIds.includes(relatedKind.id)
		) {
			owner.relatedWorkIds.push(relatedKind.id);
		}
		if (
			relatedKind.kind === "Decision" &&
			!owner.relatedDecisionIds.includes(relatedKind.id)
		) {
			owner.relatedDecisionIds.push(relatedKind.id);
		}
	}
}

function relatedWorkOrDecision(edge: {
	fromId: string;
	fromKind: string;
	toId: string;
	toKind: string;
}): { id: string; kind: "Work" | "Decision" } | null {
	if (edge.toKind === "Work" || edge.toKind === "Decision") {
		return { id: edge.toId, kind: edge.toKind };
	}
	if (edge.fromKind === "Work" || edge.fromKind === "Decision") {
		return { id: edge.fromId, kind: edge.fromKind };
	}
	return null;
}

function orderFeedRows(rows: FeedRow[], query: ListFeedQuery): FeedRow[] {
	const byTime = [...rows].sort((left, right) =>
		right.occurredAt.localeCompare(left.occurredAt)
	);
	const presented = presentNamedView(
		{
			members: byTime.map((row) => ({
				because: [],
				id: row.id,
				kind: row.recordKind,
				projectId: row.projectId,
				title: row.identityOrChannel,
			})),
			summary: FEEDBACK_COPY.feed,
		},
		{
			filterText: query.filterText ?? "",
			groupField: null,
			id: "feed",
			isDefault: true,
			name: FEEDBACK_COPY.feed,
			presentation: "List",
			purpose: null,
			sortDirection:
				query.sortField === "title" ? (query.sortDirection ?? "asc") : null,
			sortField: query.sortField === "title" ? "title" : null,
			visibleFields: [],
		}
	);
	const byId = new Map(byTime.map((row) => [row.id, row]));
	return presented.presented.flatMap((member) => {
		const row = byId.get(member.id);
		return row ? [row] : [];
	});
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
		companyId: command.payload.companyId,
		contactId: command.payload.contactId,
		fingerprint,
		idempotencyKey: command.idempotencyKey,
		occurredAt,
		originalMessage: command.payload.originalMessage,
		projectId: command.payload.projectId,
		url: command.payload.url,
		viewerWorkspaceId: command.viewerWorkspaceId,
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
		idempotencyKey: command.idempotencyKey,
		occurredAt: version.accessedAt,
		originalMessage: version.capturedContent,
		projectId: source.projectId,
		url: version.url,
		viewerWorkspaceId: command.viewerWorkspaceId,
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
		companyId?: string;
		contactId?: string;
		fingerprint: string;
		idempotencyKey: string;
		occurredAt: Date;
		originalMessage: string;
		projectId: string;
		url: string | null;
		viewerWorkspaceId?: string;
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
	await linkOptionalIdentity(tx, {
		actorId: input.actorId,
		companyId: input.companyId,
		contactId: input.contactId,
		feedbackId: created.id,
		idempotencyKey: input.idempotencyKey,
		viewerWorkspaceId: input.viewerWorkspaceId,
	});
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
	const identity = await loadIdentityByFeedback(
		db,
		rows.map((row) => row.id)
	);
	const byFeedback = new Map<string, AttachmentRow[]>();
	for (const attachment of attachments) {
		const list = byFeedback.get(attachment.feedbackId) ?? [];
		list.push(attachment);
		byFeedback.set(attachment.feedbackId, list);
	}
	return rows.map((row) =>
		toView(row, byFeedback.get(row.id) ?? [], identity.get(row.id) ?? {})
	);
}

function toView(
	row: FeedbackRow,
	attachments: AttachmentRow[],
	identity: { companyId?: string; contactId?: string }
): FeedbackView {
	return {
		attachments: attachments.map((attachment) => ({
			fileAttachmentId: attachment.fileAttachmentId,
			id: attachment.id,
		})),
		channel: row.channel,
		companyId: identity.companyId ?? null,
		contactId: identity.contactId ?? null,
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

const LINE_SPLIT = /\r?\n/;

class ConvertBarrierError extends Error {
	outcome: ConvertFeedbackOutcome;
	constructor(outcome: ConvertFeedbackOutcome) {
		super("convert-barrier");
		this.outcome = outcome;
	}
}

class BindBarrierError extends Error {
	outcome: BindFeedbackOriginOutcome;
	constructor(outcome: BindFeedbackOriginOutcome) {
		super("bind-barrier");
		this.outcome = outcome;
	}
}

function identityWriteError(error: unknown): FeedbackWriteOutcome {
	if (
		error instanceof Error &&
		(error.message === "contact-not-found" ||
			error.message === "company-not-found" ||
			error.message === "identity-not-linked")
	) {
		return {
			reason: error.message,
			status: "rejected",
		};
	}
	if (error instanceof Error && error.message === "invalid-command") {
		return { reason: "invalid-command", status: "rejected" };
	}
	throw error;
}

async function loadIdentityByFeedback(
	db: PrismaClient | PrismaTransaction,
	feedbackIds: readonly string[]
): Promise<Map<string, { companyId?: string; contactId?: string }>> {
	const identity = new Map<
		string,
		{ companyId?: string; contactId?: string }
	>();
	if (feedbackIds.length === 0) {
		return identity;
	}
	const edges = await db.typedRelation.findMany({
		where: {
			fromId: { in: [...feedbackIds] },
			fromKind: FEEDBACK_RECORD_KIND,
			type: {
				in: [RELATIONS_COPY.participant, RELATIONS_COPY.related],
			},
		},
	});
	for (const edge of edges) {
		const current = identity.get(edge.fromId) ?? {};
		if (edge.type === RELATIONS_COPY.participant && edge.toKind === "Contact") {
			current.contactId = edge.toId;
		}
		if (edge.type === RELATIONS_COPY.related && edge.toKind === "Company") {
			current.companyId = edge.toId;
		}
		identity.set(edge.fromId, current);
	}
	return identity;
}

async function linkOptionalIdentity(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		companyId?: string;
		contactId?: string;
		feedbackId: string;
		idempotencyKey: string;
		viewerWorkspaceId?: string;
	}
): Promise<void> {
	if (!(input.contactId || input.companyId)) {
		return;
	}
	if (!input.viewerWorkspaceId) {
		throw new Error("invalid-command");
	}
	if (input.contactId) {
		const contact = await tx.contact.findUnique({
			where: { id: input.contactId },
		});
		if (!contact || contact.workspaceId !== input.viewerWorkspaceId) {
			throw new Error("contact-not-found");
		}
		const linked = await createRelationInTransaction(tx, {
			actorId: input.actorId,
			from: { id: input.feedbackId, kind: FEEDBACK_RECORD_KIND },
			idempotencyKey: `${input.idempotencyKey}:contact`,
			origin: HUMAN_ORIGIN,
			previewAcknowledged: true,
			to: { id: contact.id, kind: "Contact" },
			type: RELATIONS_COPY.participant,
			viewerWorkspaceId: input.viewerWorkspaceId,
		});
		if (linked.status !== "committed" && linked.status !== "replayed") {
			throw new Error("identity-not-linked");
		}
	}
	if (input.companyId) {
		const company = await tx.company.findUnique({
			where: { id: input.companyId },
		});
		if (!company || company.workspaceId !== input.viewerWorkspaceId) {
			throw new Error("company-not-found");
		}
		const linked = await createRelationInTransaction(tx, {
			actorId: input.actorId,
			from: { id: input.feedbackId, kind: FEEDBACK_RECORD_KIND },
			idempotencyKey: `${input.idempotencyKey}:company`,
			origin: HUMAN_ORIGIN,
			previewAcknowledged: true,
			to: { id: company.id, kind: "Company" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: input.viewerWorkspaceId,
		});
		if (linked.status !== "committed" && linked.status !== "replayed") {
			throw new Error("identity-not-linked");
		}
	}
}

function mappedTitle(originalMessage: string, title?: string): string {
	if (title !== undefined) {
		return title.trim();
	}
	const line = originalMessage.split(LINE_SPLIT, 1)[0]?.trim() ?? "";
	return line.length > 0 ? line : originalMessage;
}

function convertFingerprint(preview: ConvertFeedbackPreview): string {
	const { fingerprint: _fingerprint, ...rest } = preview;
	return payloadFingerprint(rest);
}

function withConvertFingerprint(
	preview: Omit<ConvertFeedbackPreview, "fingerprint">
): ConvertFeedbackPreview {
	return { ...preview, fingerprint: payloadFingerprint(preview) };
}

async function convertInTransaction(
	tx: PrismaTransaction,
	command: ConvertFeedbackToWorkCommand,
	preview: ConvertFeedbackPreview,
	commandKey: string,
	fingerprint: string
): Promise<ConvertFeedbackOutcome> {
	const replayed = await replayConvert(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const current = await tx.feedback.findUnique({
		where: { id: command.payload.feedbackId },
	});
	if (!current) {
		return { reason: "feedback-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const created = await createWorkInTransaction(tx, {
		actorId: command.actorId,
		idempotencyKey: `${command.idempotencyKey}:work`,
		origin: HUMAN_ORIGIN,
		payload: {
			projectId: preview.projectId,
			title: preview.title,
		},
	});
	if (created.status !== "committed" && created.status !== "replayed") {
		if (created.status === "rejected" && created.reason === "missing-title") {
			return { reason: "missing-title", status: "rejected" };
		}
		throw new ConvertBarrierError({
			reason: "invalid-command",
			status: "rejected",
		});
	}
	const origin = await createRelationInTransaction(tx, {
		actorId: command.actorId,
		from: { id: current.id, kind: FEEDBACK_RECORD_KIND },
		idempotencyKey: `${command.idempotencyKey}:origin`,
		origin: HUMAN_ORIGIN,
		previewAcknowledged: true,
		to: { id: created.work.id, kind: "Work" },
		type: RELATIONS_COPY.origin,
		viewerWorkspaceId: command.viewerWorkspaceId,
	});
	if (origin.status !== "committed" && origin.status !== "replayed") {
		throw new ConvertBarrierError({
			reason: "origin-not-created",
			status: "rejected",
		});
	}
	const [view] = await hydrateFeedbackViews(tx, [current]);
	if (!view) {
		throw new ConvertBarrierError({
			reason: "feedback-not-found",
			status: "rejected",
		});
	}
	const result = {
		feedback: view,
		records: [
			{
				id: created.work.id,
				kind: "Work" as const,
				title: created.work.title,
			},
		],
	};
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: view.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(result),
			targetId: view.id,
		},
	});
	return { ...result, status: "committed" };
}

async function bindOriginInTransaction(
	tx: PrismaTransaction,
	command: BindFeedbackOriginCommand,
	commandKey: string,
	fingerprint: string
): Promise<BindFeedbackOriginOutcome> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		try {
			const stored: unknown = JSON.parse(existing.resultValue);
			if (
				stored &&
				typeof stored === "object" &&
				"feedback" in stored &&
				"workId" in stored
			) {
				return {
					...(stored as {
						feedback: FeedbackView;
						workId: string;
					}),
					status: "replayed",
				};
			}
		} catch {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const current = await tx.feedback.findUnique({
		where: { id: command.payload.feedbackId },
	});
	if (!current) {
		return { reason: "feedback-not-found", status: "rejected" };
	}
	const work = await tx.work.findUnique({
		where: { id: command.payload.workId },
	});
	if (!work || work.retiredIntoId) {
		return { reason: "work-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const origin = await createRelationInTransaction(tx, {
		actorId: command.actorId,
		from: { id: current.id, kind: FEEDBACK_RECORD_KIND },
		idempotencyKey: `${command.idempotencyKey}:origin`,
		origin: HUMAN_ORIGIN,
		previewAcknowledged: true,
		to: { id: work.id, kind: "Work" },
		type: RELATIONS_COPY.origin,
		viewerWorkspaceId: command.viewerWorkspaceId,
	});
	if (origin.status !== "committed" && origin.status !== "replayed") {
		throw new BindBarrierError({
			reason: "origin-not-created",
			status: "rejected",
		});
	}
	const [view] = await hydrateFeedbackViews(tx, [current]);
	if (!view) {
		return { reason: "feedback-not-found", status: "rejected" };
	}
	const result = { feedback: view, workId: work.id };
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: view.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(result),
			targetId: view.id,
		},
	});
	return { ...result, status: "committed" };
}

async function replayConvert(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<ConvertFeedbackOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	try {
		const stored: unknown = JSON.parse(existing.resultValue);
		if (
			stored &&
			typeof stored === "object" &&
			"feedback" in stored &&
			"records" in stored
		) {
			return {
				...(stored as {
					feedback: FeedbackView;
					records: Array<{ id: string; kind: "Work"; title: string }>;
				}),
				status: "replayed",
			};
		}
	} catch {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { conflict: MUTATION_COPY.conflict, status: "conflict" };
}
