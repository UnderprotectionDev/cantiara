import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";

import {
	type ArchiveScreenCommand,
	archiveScreenCommandSchema,
	type CreateScreenCommand,
	createScreenCommandSchema,
	emptyWireframeDocumentSchema,
	type PermanentDeleteOutcome,
	permanentlyDeleteScreenCommandSchema,
	presentScreenLife,
	restoreScreenCommandSchema,
	type SaveWireframeVersionCommand,
	SCREEN_EVENT_KIND,
	SCREEN_KIND,
	type ScreenView,
	type ScreenWriteOutcome,
	saveWireframeVersionCommandSchema,
	trashScreenCommandSchema,
	unarchiveScreenCommandSchema,
	WIREFRAME_DOCUMENT_SCHEMA,
	type WireframeVersionView,
} from "./screens-and-wireframes-model";

type PrismaTransaction = Prisma.TransactionClient;

interface ScreenRow {
	archivedAt: Date | null;
	id: string;
	projectId: string;
	revision: number;
	title: string;
	trashedAt: Date | null;
}

export async function createScreen(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	const parsed = createScreenCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const title = parsed.data.payload.title.trim();
	if (title.length === 0) {
		return { reason: "title-required", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		projectId: parsed.data.payload.projectId,
		title,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		createInTransaction(
			tx,
			{ ...parsed.data, payload: { ...parsed.data.payload, title } },
			commandKey,
			fingerprint
		)
	);
}

export async function saveExactWireframeVersion(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	const parsed = saveWireframeVersionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (isKonvaStageJson(parsed.data.payload.document)) {
		return { reason: "konva-json-not-durable", status: "rejected" };
	}
	const document = emptyWireframeDocumentSchema.safeParse(
		parsed.data.payload.document
	);
	if (!document.success) {
		return { reason: "invalid-wireframe-document", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		document: document.data,
		screenId: parsed.data.payload.screenId,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		saveVersionInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function archiveScreen(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	return await setLifecycle(
		prisma,
		command,
		archiveScreenCommandSchema,
		"archive"
	);
}

export async function unarchiveScreen(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	return await setLifecycle(
		prisma,
		command,
		unarchiveScreenCommandSchema,
		"unarchive"
	);
}

export async function trashScreen(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	return await setLifecycle(prisma, command, trashScreenCommandSchema, "trash");
}

export async function restoreScreen(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	return await setLifecycle(
		prisma,
		command,
		restoreScreenCommandSchema,
		"restore"
	);
}

export async function permanentlyDeleteScreen(
	prisma: PrismaClient,
	command: unknown
): Promise<PermanentDeleteOutcome> {
	const parsed = permanentlyDeleteScreenCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		kind: SCREEN_EVENT_KIND.deletePermanently,
		screenId: parsed.data.payload.screenId,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		deleteInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function getScreen(
	prisma: PrismaClient,
	screenId: string
): Promise<ScreenView | null> {
	if (!hasScreenDelegate(prisma)) {
		return null;
	}
	const row = await prisma.screen.findUnique({
		where: { id: screenId },
	});
	if (!row) {
		return null;
	}
	return await toView(prisma, row);
}

export async function listScreens(
	prisma: PrismaClient,
	input: {
		includeArchived?: boolean;
		projectId: string;
		trash?: boolean;
	}
): Promise<ScreenView[]> {
	if (!hasScreenDelegate(prisma)) {
		return [];
	}
	const rows = await prisma.screen.findMany({
		orderBy: { createdAt: "asc" },
		where: input.trash
			? { projectId: input.projectId, trashedAt: { not: null } }
			: {
					archivedAt: input.includeArchived ? undefined : null,
					projectId: input.projectId,
					trashedAt: null,
				},
	});
	return await Promise.all(rows.map((row) => toView(prisma, row)));
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateScreenCommand,
	commandKey: string,
	fingerprint: string
): Promise<ScreenWriteOutcome> {
	if (!hasScreenDelegate(tx)) {
		return { reason: "screen-unavailable", status: "rejected" };
	}
	await lockProject(tx, command.payload.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const created = await tx.screen.create({
		data: {
			id: crypto.randomUUID(),
			projectId: command.payload.projectId,
			revision: 1,
			title: command.payload.title,
		},
	});
	await tx.screenEvent.create({
		data: {
			actorId: command.actorId,
			id: crypto.randomUUID(),
			kind: SCREEN_EVENT_KIND.create,
			screenId: created.id,
		},
	});
	const view = await toView(tx, created);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { screen: view, status: "committed" };
}

async function saveVersionInTransaction(
	tx: PrismaTransaction,
	command: SaveWireframeVersionCommand,
	commandKey: string,
	fingerprint: string
): Promise<ScreenWriteOutcome> {
	if (!hasScreenDelegate(tx)) {
		return { reason: "screen-unavailable", status: "rejected" };
	}
	const current = await tx.screen.findUnique({
		where: { id: command.payload.screenId },
	});
	if (!current) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.screen.findUnique({
		where: { id: current.id },
	});
	if (!locked) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (locked.archivedAt || locked.trashedAt) {
		return { reason: "screen-not-writable", status: "rejected" };
	}
	const latest = await tx.wireframeVersion.findFirst({
		orderBy: { versionNumber: "desc" },
		where: { screenId: locked.id },
	});
	const versionNumber = (latest?.versionNumber ?? 0) + 1;
	const document = emptyWireframeDocumentSchema.parse(command.payload.document);
	await tx.wireframeVersion.create({
		data: {
			document: document as Prisma.InputJsonValue,
			id: crypto.randomUUID(),
			screenId: locked.id,
			versionNumber,
		},
	});
	const updated = await tx.screen.update({
		data: { revision: locked.revision + 1 },
		where: { id: locked.id },
	});
	await tx.screenEvent.create({
		data: {
			actorId: command.actorId,
			id: crypto.randomUUID(),
			kind: SCREEN_EVENT_KIND.saveVersion,
			screenId: updated.id,
		},
	});
	const view = await toView(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { screen: view, status: "committed" };
}

type LifecycleKind = "archive" | "restore" | "trash" | "unarchive";

async function setLifecycle(
	prisma: PrismaClient,
	command: unknown,
	schema: typeof archiveScreenCommandSchema,
	kind: LifecycleKind
): Promise<ScreenWriteOutcome> {
	const parsed = schema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		kind,
		screenId: parsed.data.payload.screenId,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		lifecycleInTransaction(tx, parsed.data, commandKey, fingerprint, kind)
	);
}

async function lifecycleInTransaction(
	tx: PrismaTransaction,
	command: ArchiveScreenCommand,
	commandKey: string,
	fingerprint: string,
	kind: LifecycleKind
): Promise<ScreenWriteOutcome> {
	if (!hasScreenDelegate(tx)) {
		return { reason: "screen-unavailable", status: "rejected" };
	}
	const current = await tx.screen.findUnique({
		where: { id: command.payload.screenId },
	});
	if (!current) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.screen.findUnique({
		where: { id: current.id },
	});
	if (!locked) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const next = nextLifecycle(locked, kind);
	if (next.status === "rejected") {
		return next;
	}
	const updated = await tx.screen.update({
		data: {
			archivedAt: next.archivedAt,
			revision: locked.revision + 1,
			trashedAt: next.trashedAt,
		},
		where: { id: locked.id },
	});
	await tx.screenEvent.create({
		data: {
			actorId: command.actorId,
			id: crypto.randomUUID(),
			kind: eventKind(kind),
			screenId: updated.id,
		},
	});
	const view = await toView(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { screen: view, status: "committed" };
}

function nextLifecycle(
	current: ScreenRow,
	kind: LifecycleKind
):
	| { archivedAt: Date | null; status: "ok"; trashedAt: Date | null }
	| { reason: string; status: "rejected" } {
	const now = new Date();
	if (kind === "archive") {
		if (current.trashedAt) {
			return { reason: "screen-in-trash", status: "rejected" };
		}
		return {
			archivedAt: current.archivedAt ?? now,
			status: "ok",
			trashedAt: null,
		};
	}
	if (kind === "unarchive") {
		if (current.trashedAt) {
			return { reason: "screen-in-trash", status: "rejected" };
		}
		return { archivedAt: null, status: "ok", trashedAt: null };
	}
	if (kind === "trash") {
		return {
			archivedAt: current.archivedAt,
			status: "ok",
			trashedAt: current.trashedAt ?? now,
		};
	}
	if (!current.trashedAt) {
		return { reason: "screen-not-in-trash", status: "rejected" };
	}
	return {
		archivedAt: current.archivedAt,
		status: "ok",
		trashedAt: null,
	};
}

function eventKind(kind: LifecycleKind): string {
	if (kind === "archive") {
		return SCREEN_EVENT_KIND.archive;
	}
	if (kind === "unarchive") {
		return SCREEN_EVENT_KIND.unarchive;
	}
	if (kind === "trash") {
		return SCREEN_EVENT_KIND.trash;
	}
	return SCREEN_EVENT_KIND.restore;
}

async function deleteInTransaction(
	tx: PrismaTransaction,
	command: ArchiveScreenCommand,
	commandKey: string,
	fingerprint: string
): Promise<PermanentDeleteOutcome> {
	if (!hasScreenDelegate(tx)) {
		return { reason: "screen-unavailable", status: "rejected" };
	}
	const current = await tx.screen.findUnique({
		where: { id: command.payload.screenId },
	});
	if (!current) {
		const existing = await tx.mutationReceipt.findUnique({
			where: { commandKey },
		});
		if (existing && existing.payloadFingerprint === fingerprint) {
			return { screenId: command.payload.screenId, status: "replayed" };
		}
		return { reason: "screen-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayDelete(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.screen.findUnique({
		where: { id: current.id },
	});
	if (!locked) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (!locked.trashedAt) {
		return { reason: "screen-not-in-trash", status: "rejected" };
	}
	await tx.screen.delete({ where: { id: locked.id } });
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: locked.revision + 1,
			id: crypto.randomUUID(),
			kind: "commit",
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify({
				screenId: locked.id,
				status: "committed",
			}),
			targetId: locked.id,
		},
	});
	return { screenId: locked.id, status: "committed" };
}

async function replayDelete(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<PermanentDeleteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { screenId: existing.targetId, status: "replayed" };
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<ScreenWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedScreen(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { screen: stored, status: "replayed" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		view: ScreenView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.view.revision,
			id: crypto.randomUUID(),
			kind: "commit",
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.view),
			targetId: input.view.id,
		},
	});
}

function storedScreen(value: string): ScreenView | null {
	try {
		const parsed = JSON.parse(value) as ScreenView;
		if (parsed.recordKind !== SCREEN_KIND) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

async function toView(
	db: PrismaClient | PrismaTransaction,
	row: ScreenRow
): Promise<ScreenView> {
	const versions = await db.wireframeVersion.findMany({
		orderBy: { versionNumber: "asc" },
		where: { screenId: row.id },
	});
	const events = await db.screenEvent.findMany({
		orderBy: { occurredAt: "asc" },
		where: { screenId: row.id },
	});
	return {
		archivedAt: row.archivedAt?.toISOString() ?? null,
		history: events.map((event) => ({
			kind: event.kind,
			occurredAt: event.occurredAt.toISOString(),
		})),
		id: row.id,
		life: presentScreenLife(row),
		projectId: row.projectId,
		recordKind: SCREEN_KIND,
		revision: row.revision,
		title: row.title,
		trashedAt: row.trashedAt?.toISOString() ?? null,
		versions: versions.map(toVersionView),
	};
}

function toVersionView(row: {
	createdAt: Date;
	document: Prisma.JsonValue;
	id: string;
	screenId: string;
	versionNumber: number;
}): WireframeVersionView {
	return {
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		schema: WIREFRAME_DOCUMENT_SCHEMA,
		screenId: row.screenId,
		versionNumber: row.versionNumber,
	};
}

function isKonvaStageJson(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		"className" in value &&
		(value as { className: unknown }).className === "Stage"
	);
}

function hasScreenDelegate(
	db: PrismaClient | PrismaTransaction
): db is PrismaClient | PrismaTransaction {
	return (
		"screen" in db &&
		typeof db.screen?.create === "function" &&
		typeof db.screen?.findMany === "function"
	);
}

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`screens:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
