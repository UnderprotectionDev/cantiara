import type { PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";

import {
	findLinkedBlockRow,
	insertLinkedBlockRow,
	listLinkedBlockRows,
	updateLinkedBlockRow,
} from "./linked-block-store";
import {
	deleteScreenRow,
	findLatestWireframeVersionRow,
	findScreenRow,
	findWireframeVersionRow,
	insertScreenEvent,
	insertScreenRow,
	insertWireframeVersion,
	latestWireframeVersionNumber,
	listScreenEvents,
	listScreenRows,
	listWireframeVersions,
	type ScreenDb,
	type ScreenRow,
	updateScreenRow,
} from "./screen-store";
import {
	type AffectedScreenPreview,
	type ArchiveScreenCommand,
	applyLinkedBlockChangeCommandSchema,
	archiveScreenCommandSchema,
	type CreateScreenCommand,
	createLinkedBlockCommandSchema,
	createScreenCommandSchema,
	detachLinkedBlockCommandSchema,
	type ExportWireframePayload,
	exportWireframePayloadSchema,
	type LinkedBlockPreviewOutcome,
	type LinkedBlockView,
	type LinkedBlockWriteOutcome,
	openPresentationPayloadSchema,
	type PermanentDeleteOutcome,
	type PresentationOutcome,
	type PresentationScreenView,
	type PresentationView,
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
	type WireframeExportOutcome,
	type WireframeVersionDocumentView,
	type WireframeVersionView,
} from "./screens-and-wireframes-model";
import {
	detachNodeFromLinkedBlock,
	parseWireframeDocument,
	WIREFRAME_DOCUMENT_SCHEMA,
	type WireframeDocument,
	wireframeLinkedBlockDefinitionSchema,
} from "./wireframe-document";
import {
	loadDefinitions,
	presentWireframeDocument,
	snapshotWireframeDocument,
} from "./wireframe-present";
import {
	buildPresentationView,
	exportFromExactScreens,
	followPresentationLink as followLoadedPresentationLink,
} from "./wireframe-prototype";

type PrismaTransaction = ScreenDb;

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
	const document = parseWireframeDocument(parsed.data.payload.document);
	if (document.status !== "ok") {
		return { reason: document.reason, status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		document: document.document,
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
	const row = await findScreenRow(prisma, screenId);
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
	const rows = await listScreenRows(prisma, input);
	return await Promise.all(rows.map((row) => toView(prisma, row)));
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateScreenCommand,
	commandKey: string,
	fingerprint: string
): Promise<ScreenWriteOutcome> {
	await lockProject(tx, command.payload.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const created = await insertScreenRow(tx, {
		id: crypto.randomUUID(),
		projectId: command.payload.projectId,
		revision: 1,
		title: command.payload.title,
	});
	await insertScreenEvent(tx, {
		actorId: command.actorId,
		id: crypto.randomUUID(),
		kind: SCREEN_EVENT_KIND.create,
		screenId: created.id,
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
	const current = await findScreenRow(tx, command.payload.screenId);
	if (!current) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await findScreenRow(tx, current.id);
	if (!locked) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (locked.archivedAt || locked.trashedAt) {
		return { reason: "screen-not-writable", status: "rejected" };
	}
	const parsedDocument = parseWireframeDocument(command.payload.document);
	if (parsedDocument.status !== "ok") {
		return { reason: parsedDocument.reason, status: "rejected" };
	}
	const linked = await assertLinkedBlocksInProject(
		tx,
		locked.projectId,
		parsedDocument.document
	);
	if (linked.status === "rejected") {
		return linked;
	}
	const document = await snapshotWireframeDocument(tx, parsedDocument.document);
	const versionNumber = (await latestWireframeVersionNumber(tx, locked.id)) + 1;
	await insertWireframeVersion(tx, {
		document,
		id: crypto.randomUUID(),
		screenId: locked.id,
		versionNumber,
	});
	const updated = await updateScreenRow(tx, {
		...locked,
		revision: locked.revision + 1,
	});
	await insertScreenEvent(tx, {
		actorId: command.actorId,
		id: crypto.randomUUID(),
		kind: SCREEN_EVENT_KIND.saveVersion,
		screenId: updated.id,
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
	const current = await findScreenRow(tx, command.payload.screenId);
	if (!current) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await findScreenRow(tx, current.id);
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
	const updated = await updateScreenRow(tx, {
		...locked,
		archivedAt: next.archivedAt,
		revision: locked.revision + 1,
		trashedAt: next.trashedAt,
	});
	await insertScreenEvent(tx, {
		actorId: command.actorId,
		id: crypto.randomUUID(),
		kind: eventKind(kind),
		screenId: updated.id,
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
	const current = await findScreenRow(tx, command.payload.screenId);
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
	const locked = await findScreenRow(tx, current.id);
	if (!locked) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (!locked.trashedAt) {
		return { reason: "screen-not-in-trash", status: "rejected" };
	}
	await deleteScreenRow(tx, locked.id);
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
	const versions = await listWireframeVersions(db, row.id);
	const events = await listScreenEvents(db, row.id);
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

export async function listLinkedBlocks(
	prisma: PrismaClient,
	projectId: string
): Promise<LinkedBlockView[]> {
	const rows = await listLinkedBlockRows(prisma, projectId);
	return rows.map(toLinkedBlockView);
}

export async function getExactWireframeVersion(
	prisma: PrismaClient,
	input: { overlayCurrent?: boolean; screenId: string; versionNumber: number }
): Promise<WireframeVersionDocumentView | null> {
	const screen = await findScreenRow(prisma, input.screenId);
	if (!screen) {
		return null;
	}
	const row = await findWireframeVersionRow(prisma, {
		screenId: input.screenId,
		versionNumber: input.versionNumber,
	});
	if (!row) {
		return null;
	}
	const parsed = parseWireframeDocument(row.document);
	if (parsed.status !== "ok") {
		return null;
	}
	const presented = await presentWireframeDocument(prisma, {
		document: parsed.document,
		mode: input.overlayCurrent ? "current" : "historical",
		projectId: screen.projectId,
	});
	return {
		...toVersionView(row),
		document: parsed.document,
		presentedNodes: presented.presentedNodes,
	};
}

export async function openPresentationMode(
	prisma: PrismaClient,
	input: unknown
): Promise<PresentationOutcome> {
	const parsed = openPresentationPayloadSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const screens = await loadPinnedScreens(prisma, parsed.data.pins);
	const view = buildPresentationView({
		currentScreenId: parsed.data.startScreenId,
		screens,
		startScreenId: parsed.data.startScreenId,
	});
	if ("status" in view) {
		return view;
	}
	return { ...view, status: "ok" };
}

export function followPresentationLink(
	view: PresentationView,
	nodeId: string
): PresentationView {
	return followLoadedPresentationLink(view, nodeId);
}

export async function exportWireframe(
	prisma: PrismaClient,
	input: unknown
): Promise<WireframeExportOutcome> {
	const parsed = exportWireframePayloadSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await exportPinnedWireframe(prisma, parsed.data);
}

async function exportPinnedWireframe(
	prisma: PrismaClient,
	input: ExportWireframePayload
): Promise<WireframeExportOutcome> {
	const screens = await loadPinnedScreens(prisma, input.pins);
	return await exportFromExactScreens({
		format: input.format,
		screens,
		selectionNodeIds: input.selectionNodeIds,
		startScreenId: input.startScreenId,
	});
}

async function loadPinnedScreens(
	prisma: PrismaClient,
	pins: readonly { screenId: string; versionNumber: number }[]
): Promise<PresentationScreenView[]> {
	const loaded = await Promise.all(
		[...pins]
			.sort((left, right) => left.screenId.localeCompare(right.screenId))
			.map(async (pin) => {
				const version = await getExactWireframeVersion(prisma, pin);
				if (!version) {
					return null;
				}
				const screen = await findScreenRow(prisma, pin.screenId);
				if (!screen) {
					return null;
				}
				return {
					document: version.document,
					id: version.screenId,
					title: screen.title,
					versionNumber: version.versionNumber,
				};
			})
	);
	return loaded.filter((row) => row !== null);
}

export async function createLinkedBlock(
	prisma: PrismaClient,
	command: unknown
): Promise<LinkedBlockWriteOutcome> {
	const parsed = createLinkedBlockCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction(async (tx) => {
		await lockProject(tx, parsed.data.payload.projectId);
		const replayed = await replayLinkedBlock(tx, commandKey, fingerprint);
		if (replayed) {
			return replayed;
		}
		const created = await insertLinkedBlockRow(tx, {
			definition: parsed.data.payload.definition,
			id: crypto.randomUUID(),
			name: parsed.data.payload.name,
			projectId: parsed.data.payload.projectId,
			revision: 1,
		});
		const view = toLinkedBlockView(created);
		await writeLinkedReceipt(tx, {
			actorId: parsed.data.actorId,
			commandKey,
			fingerprint,
			view,
		});
		return { linkedBlock: view, status: "committed" };
	});
}

export async function previewLinkedBlockChange(
	prisma: PrismaClient,
	input: unknown
): Promise<LinkedBlockPreviewOutcome> {
	const parsed =
		applyLinkedBlockChangeCommandSchema.shape.payload.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const current = await findLinkedBlockRow(prisma, parsed.data.linkedBlockId);
	if (!current || current.projectId !== parsed.data.projectId) {
		return { reason: "linked-block-not-found", status: "rejected" };
	}
	const affectedScreens = await listAffectedScreens(
		prisma,
		parsed.data.projectId,
		parsed.data.linkedBlockId
	);
	return {
		affectedScreens,
		previewFingerprint: payloadFingerprint({
			affectedScreenIds: affectedScreens.map((screen) => screen.id),
			linkedBlockId: parsed.data.linkedBlockId,
			nextDefinition: parsed.data.nextDefinition,
		}),
		status: "ok",
	};
}

export async function applyLinkedBlockChange(
	prisma: PrismaClient,
	command: unknown
): Promise<LinkedBlockWriteOutcome> {
	const parsed = applyLinkedBlockChangeCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	const previewed = await previewLinkedBlockChange(prisma, parsed.data.payload);
	if (previewed.status !== "ok") {
		return previewed;
	}
	if (previewed.previewFingerprint !== parsed.data.previewFingerprint) {
		return { reason: "preview-mismatch", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction(async (tx) => {
		const current = await findLinkedBlockRow(
			tx,
			parsed.data.payload.linkedBlockId
		);
		if (!current || current.projectId !== parsed.data.payload.projectId) {
			return { reason: "linked-block-not-found", status: "rejected" };
		}
		await lockProject(tx, current.projectId);
		const replayed = await replayLinkedBlock(tx, commandKey, fingerprint);
		if (replayed) {
			return replayed;
		}
		const updated = await updateLinkedBlockRow(tx, {
			...current,
			definition: parsed.data.payload.nextDefinition,
			revision: current.revision + 1,
		});
		const view = toLinkedBlockView(updated);
		await writeLinkedReceipt(tx, {
			actorId: parsed.data.actorId,
			commandKey,
			fingerprint,
			view,
		});
		return { linkedBlock: view, status: "committed" };
	});
}

export async function detachLinkedBlock(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	const parsed = detachLinkedBlockCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction(async (tx) => {
		const current = await findScreenRow(tx, parsed.data.payload.screenId);
		if (!current) {
			return { reason: "screen-not-found", status: "rejected" };
		}
		await lockProject(tx, current.projectId);
		const replayed = await replayOrConflict(tx, commandKey, fingerprint);
		if (replayed) {
			return replayed;
		}
		const locked = await findScreenRow(tx, current.id);
		if (!locked) {
			return { reason: "screen-not-found", status: "rejected" };
		}
		if (locked.revision !== parsed.data.baseRevision) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		if (locked.archivedAt || locked.trashedAt) {
			return { reason: "screen-not-writable", status: "rejected" };
		}
		const latest = await findLatestWireframeVersionRow(tx, locked.id);
		if (!latest) {
			return { reason: "wireframe-version-not-found", status: "rejected" };
		}
		const parsedDocument = parseWireframeDocument(latest.document);
		if (parsedDocument.status !== "ok") {
			return { reason: parsedDocument.reason, status: "rejected" };
		}
		const node = parsedDocument.document.nodes.find(
			(item) => item.id === parsed.data.payload.nodeId
		);
		if (!node?.linkedBlockId) {
			return { reason: "not-linked", status: "rejected" };
		}
		const definitions = await loadDefinitions(tx, locked.projectId);
		const definition = definitions.get(node.linkedBlockId);
		if (!definition) {
			return { reason: "linked-block-not-found", status: "rejected" };
		}
		const detached: WireframeDocument = {
			...parsedDocument.document,
			nodes: parsedDocument.document.nodes.map((item) =>
				item.id === node.id ? detachNodeFromLinkedBlock(item, definition) : item
			),
		};
		const document = await snapshotWireframeDocument(tx, detached);
		const versionNumber =
			(await latestWireframeVersionNumber(tx, locked.id)) + 1;
		await insertWireframeVersion(tx, {
			document,
			id: crypto.randomUUID(),
			screenId: locked.id,
			versionNumber,
		});
		const updated = await updateScreenRow(tx, {
			...locked,
			revision: locked.revision + 1,
		});
		await insertScreenEvent(tx, {
			actorId: parsed.data.actorId,
			id: crypto.randomUUID(),
			kind: SCREEN_EVENT_KIND.saveVersion,
			screenId: updated.id,
		});
		const view = await toView(tx, updated);
		await writeReceipt(tx, {
			actorId: parsed.data.actorId,
			commandKey,
			fingerprint,
			view,
		});
		return { screen: view, status: "committed" };
	});
}

async function assertLinkedBlocksInProject(
	tx: ScreenDb,
	projectId: string,
	document: WireframeDocument
): Promise<{ status: "ok" } | { reason: string; status: "rejected" }> {
	const ids = [
		...new Set(
			document.nodes.flatMap((node) =>
				node.linkedBlockId ? [node.linkedBlockId] : []
			)
		),
	];
	const rows = await Promise.all(ids.map((id) => findLinkedBlockRow(tx, id)));
	for (const row of rows) {
		if (!row) {
			return { reason: "linked-block-not-found", status: "rejected" };
		}
		if (row.projectId !== projectId) {
			return { reason: "cross-project-live-library", status: "rejected" };
		}
	}
	return { status: "ok" };
}

async function listAffectedScreens(
	prisma: PrismaClient,
	projectId: string,
	linkedBlockId: string
): Promise<AffectedScreenPreview[]> {
	const screens = await listScreenRows(prisma, { projectId });
	const latestRows = await Promise.all(
		screens.map(async (screen) => ({
			latest: await findLatestWireframeVersionRow(prisma, screen.id),
			screen,
		}))
	);
	const affected: AffectedScreenPreview[] = [];
	for (const { latest, screen } of latestRows) {
		if (!latest) {
			continue;
		}
		const parsed = parseWireframeDocument(latest.document);
		if (parsed.status !== "ok") {
			continue;
		}
		if (
			parsed.document.nodes.some((node) => node.linkedBlockId === linkedBlockId)
		) {
			affected.push({ id: screen.id, title: screen.title });
		}
	}
	return affected;
}

function toLinkedBlockView(row: {
	definition: unknown;
	id: string;
	name: string;
	projectId: string;
	revision: number;
}): LinkedBlockView {
	return {
		definition: wireframeLinkedBlockDefinitionSchema.parse(row.definition),
		id: row.id,
		name: row.name,
		projectId: row.projectId,
		revision: row.revision,
	};
}

async function replayLinkedBlock(
	tx: ScreenDb,
	commandKey: string,
	fingerprint: string
): Promise<LinkedBlockWriteOutcome | null> {
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
		const stored = JSON.parse(existing.resultValue) as LinkedBlockView;
		if (!(stored.id && stored.projectId)) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return { linkedBlock: stored, status: "replayed" };
	} catch {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
}

async function writeLinkedReceipt(
	tx: ScreenDb,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		view: LinkedBlockView;
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
