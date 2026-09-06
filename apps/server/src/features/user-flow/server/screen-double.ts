import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	type CreateScreenCommand,
	createScreenCommandSchema,
	type ScreenLifecycleCommand,
	type ScreenView,
	type ScreenWriteOutcome,
	screenLifecycleCommandSchema,
} from "./user-flow-model";

type PrismaTransaction = Prisma.TransactionClient;

export interface WireframeVersionDouble {
	id: string;
	preview: string;
}

interface ScreenRow {
	archivedAt: Date | null;
	body: string;
	currentWireframeVersionId: string | null;
	id: string;
	projectId: string;
	redactedAt: Date | null;
	revision: number;
	title: string;
	trashedAt: Date | null;
	wireframeVersionsJson: string;
}

export function parseWireframeVersions(raw: string): WireframeVersionDouble[] {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.flatMap((entry) => {
			if (
				typeof entry !== "object" ||
				entry === null ||
				typeof (entry as { id?: unknown }).id !== "string" ||
				typeof (entry as { preview?: unknown }).preview !== "string"
			) {
				return [];
			}
			return [
				{
					id: (entry as { id: string }).id,
					preview: (entry as { preview: string }).preview,
				},
			];
		});
	} catch {
		return [];
	}
}

export async function createScreen(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	const parsed = createScreenCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await writeCreateScreen(prisma, parsed.data);
}

export async function archiveScreen(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	return await applyLifecycle(prisma, command, "archive", (row) => ({
		archivedAt: row.archivedAt ?? new Date(),
		trashedAt: null,
	}));
}

export async function trashScreen(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	return await applyLifecycle(prisma, command, "trash", () => ({
		trashedAt: new Date(),
	}));
}

export async function restoreScreen(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	return await applyLifecycle(prisma, command, "restore", () => ({
		archivedAt: null,
		trashedAt: null,
	}));
}

export async function permanentlyDeleteScreen(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	const parsed = screenLifecycleCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		permanentlyDeleteInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function redactScreen(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	return await applyLifecycle(prisma, command, "redact", () => ({
		body: "",
		currentWireframeVersionId: null,
		redactedAt: new Date(),
		title: "",
		wireframeVersionsJson: "[]",
	}));
}

export async function getScreenRow(
	prisma: PrismaClient | PrismaTransaction,
	screenId: string
): Promise<ScreenRow | null> {
	if (
		!("screen" in prisma) ||
		typeof prisma.screen?.findUnique !== "function"
	) {
		return null;
	}
	return await prisma.screen.findUnique({ where: { id: screenId } });
}

export async function listScreensForProject(
	prisma: PrismaClient,
	projectId: string
): Promise<ScreenView[]> {
	if (!("screen" in prisma) || typeof prisma.screen?.findMany !== "function") {
		return [];
	}
	const rows = await prisma.screen.findMany({
		orderBy: { createdAt: "asc" },
		where: { projectId, trashedAt: null },
	});
	return rows.map(toScreenView);
}

function toScreenView(row: ScreenRow): ScreenView {
	return {
		body: row.body,
		id: row.id,
		projectId: row.projectId,
		revision: row.revision,
		title: row.title,
	};
}

async function writeCreateScreen(
	prisma: PrismaClient,
	command: CreateScreenCommand
): Promise<ScreenWriteOutcome> {
	const fingerprint = payloadFingerprint(command.payload);
	const commandKey = commandKeyFor(command.actorId, command.idempotencyKey);
	return await prisma.$transaction((tx) =>
		createScreenInTransaction(tx, command, commandKey, fingerprint)
	);
}

async function createScreenInTransaction(
	tx: PrismaTransaction,
	command: CreateScreenCommand,
	commandKey: string,
	fingerprint: string
): Promise<ScreenWriteOutcome> {
	await lockProject(tx, command.payload.projectId);
	const replayed = await replayScreen(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const versions = command.payload.wireframeVersions ?? [];
	const created = await tx.screen.create({
		data: {
			body: command.payload.body ?? "",
			currentWireframeVersionId:
				command.payload.currentWireframeVersionId ?? versions[0]?.id ?? null,
			id: crypto.randomUUID(),
			projectId: command.payload.projectId,
			revision: 1,
			title: command.payload.title,
			wireframeVersionsJson: JSON.stringify(versions),
		},
	});
	const view = toScreenView(created);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		revision: view.revision,
		targetId: view.id,
		value: JSON.stringify(view),
	});
	return { screen: view, status: "committed" };
}

async function applyLifecycle(
	prisma: PrismaClient,
	command: unknown,
	kind: string,
	patch: (row: ScreenRow) => Prisma.ScreenUpdateInput
): Promise<ScreenWriteOutcome> {
	const parsed = screenLifecycleCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		...parsed.data.payload,
		kind,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		lifecycleInTransaction(tx, parsed.data, commandKey, fingerprint, patch)
	);
}

async function lifecycleInTransaction(
	tx: PrismaTransaction,
	command: ScreenLifecycleCommand,
	commandKey: string,
	fingerprint: string,
	patch: (row: ScreenRow) => Prisma.ScreenUpdateInput
): Promise<ScreenWriteOutcome> {
	const replayed = await replayScreen(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const row = await tx.screen.findUnique({
		where: { id: command.payload.screenId },
	});
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, row.projectId);
	const updated = await tx.screen.update({
		data: { ...patch(row), revision: row.revision + 1 },
		where: { id: row.id },
	});
	const view = toScreenView(updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		revision: view.revision,
		targetId: view.id,
		value: JSON.stringify(view),
	});
	return { screen: view, status: "committed" };
}

async function permanentlyDeleteInTransaction(
	tx: PrismaTransaction,
	command: ScreenLifecycleCommand,
	commandKey: string,
	fingerprint: string
): Promise<ScreenWriteOutcome> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return {
			screen: JSON.parse(existing.resultValue) as ScreenView,
			status: "replayed",
		};
	}
	const row = await tx.screen.findUnique({
		where: { id: command.payload.screenId },
	});
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, row.projectId);
	const view = toScreenView(row);
	await tx.screen.delete({ where: { id: row.id } });
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		revision: view.revision,
		targetId: view.id,
		value: JSON.stringify(view),
	});
	return { screen: view, status: "committed" };
}

async function replayScreen(
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
	const live = await tx.screen.findUnique({ where: { id: existing.targetId } });
	if (!live) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { screen: toScreenView(live), status: "replayed" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		revision: number;
		targetId: string;
		value: string;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: input.value,
			targetId: input.targetId,
		},
	});
}

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`user-flow:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
