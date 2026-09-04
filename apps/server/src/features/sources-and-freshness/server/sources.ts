import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";

import { resolveSourceOrigin } from "./source-origin";
import {
	type CreateSourceCommand,
	createSourceCommandSchema,
	type SaveSourceVersionCommand,
	SOURCES_COPY,
	type SourceVersionView,
	type SourceView,
	type SourceWriteOutcome,
	saveSourceVersionCommandSchema,
} from "./sources-model";

type PrismaTransaction = Prisma.TransactionClient;

interface SourceRow {
	approvedVersionNumber: number;
	createdAt: Date;
	id: string;
	projectId: string;
	revision: number;
	updatedAt: Date;
}

interface SourceVersionRow {
	accessedAt: Date;
	capturedContent: string;
	excerpt: string;
	externalId: string | null;
	externalRecordType: string | null;
	id: string;
	provider: string | null;
	sourceId: string;
	title: string;
	url: string;
	versionNumber: number;
}

export async function createSource(
	prisma: PrismaClient,
	command: unknown
): Promise<SourceWriteOutcome> {
	const parsed = createSourceCommandSchema.safeParse(command);
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

export async function saveSourceVersion(
	prisma: PrismaClient,
	command: unknown
): Promise<SourceWriteOutcome> {
	const parsed = saveSourceVersionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		saveVersionInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function getSource(
	prisma: PrismaClient,
	sourceId: string
): Promise<SourceView | null> {
	const row = await prisma.source.findUnique({
		where: { id: sourceId },
	});
	if (!row) {
		return null;
	}
	const versions = await prisma.sourceVersion.findMany({
		orderBy: { versionNumber: "asc" },
		where: { sourceId: row.id },
	});
	return toView(row, versions);
}

export async function listSources(
	prisma: PrismaClient,
	projectId: string
): Promise<SourceView[]> {
	const rows = await prisma.source.findMany({
		orderBy: { createdAt: "asc" },
		where: { projectId },
	});
	if (rows.length === 0) {
		return [];
	}
	const versions = await prisma.sourceVersion.findMany({
		orderBy: { versionNumber: "asc" },
		where: { sourceId: { in: rows.map((row) => row.id) } },
	});
	const versionsBySource = new Map<string, SourceVersionRow[]>();
	for (const version of versions) {
		const list = versionsBySource.get(version.sourceId) ?? [];
		list.push(version);
		versionsBySource.set(version.sourceId, list);
	}
	return rows.map((row) => toView(row, versionsBySource.get(row.id) ?? []));
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateSourceCommand,
	commandKey: string,
	fingerprint: string
): Promise<SourceWriteOutcome> {
	const project = await tx.project.findUnique({
		where: { id: command.payload.projectId },
	});
	if (!project) {
		return { reason: "project-not-found", status: "rejected" };
	}
	await lockProject(tx, command.payload.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const accessedAt = parseAccessedAt(command.payload.accessedAt);
	if (!accessedAt) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const origin = resolveSourceOrigin({
		externalId: command.payload.externalId,
		externalRecordType: command.payload.externalRecordType,
		provider: command.payload.provider,
		url: command.payload.url,
	});
	const created = await tx.source.create({
		data: {
			approvedVersionNumber: 1,
			id: crypto.randomUUID(),
			projectId: command.payload.projectId,
			revision: 1,
		},
	});
	const version = await tx.sourceVersion.create({
		data: {
			accessedAt,
			capturedContent: command.payload.capturedContent,
			excerpt: command.payload.excerpt ?? "",
			externalId: origin.externalId,
			externalRecordType: origin.externalRecordType,
			id: crypto.randomUUID(),
			provider: origin.provider,
			sourceId: created.id,
			title: command.payload.title,
			url: command.payload.url,
			versionNumber: 1,
		},
	});
	const view = toView(created, [version]);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { source: view, status: "committed" };
}

async function saveVersionInTransaction(
	tx: PrismaTransaction,
	command: SaveSourceVersionCommand,
	commandKey: string,
	fingerprint: string
): Promise<SourceWriteOutcome> {
	const current = await tx.source.findUnique({
		where: { id: command.payload.sourceId },
	});
	if (!current) {
		return { reason: "source-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.source.findUnique({
		where: { id: current.id },
	});
	if (!locked) {
		return { reason: "source-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const accessedAt = parseAccessedAt(command.payload.accessedAt);
	if (!accessedAt) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const origin = resolveSourceOrigin({
		externalId: command.payload.externalId,
		externalRecordType: command.payload.externalRecordType,
		provider: command.payload.provider,
		url: command.payload.url,
	});
	const nextNumber = locked.approvedVersionNumber + 1;
	await tx.sourceVersion.create({
		data: {
			accessedAt,
			capturedContent: command.payload.capturedContent,
			excerpt: command.payload.excerpt ?? "",
			externalId: origin.externalId,
			externalRecordType: origin.externalRecordType,
			id: crypto.randomUUID(),
			provider: origin.provider,
			sourceId: locked.id,
			title: command.payload.title,
			url: command.payload.url,
			versionNumber: nextNumber,
		},
	});
	const updated = await tx.source.update({
		data: {
			approvedVersionNumber: nextNumber,
			revision: locked.revision + 1,
		},
		where: { id: locked.id },
	});
	const versions = await tx.sourceVersion.findMany({
		orderBy: { versionNumber: "asc" },
		where: { sourceId: updated.id },
	});
	const view = toView(updated, versions);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { source: view, status: "committed" };
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<SourceWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.source.findUnique({
		where: { id: existing.targetId },
	});
	if (!live) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const versions = await tx.sourceVersion.findMany({
		orderBy: { versionNumber: "asc" },
		where: { sourceId: live.id },
	});
	return { source: toView(live, versions), status: "replayed" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		view: SourceView;
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
	const [lockA, lockB] = advisoryKeys(`sources:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

function parseAccessedAt(value: string | undefined): Date | null {
	if (value === undefined) {
		return new Date();
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}
	return parsed;
}

function toView(row: SourceRow, versions: SourceVersionRow[]): SourceView {
	const approved =
		versions.find(
			(version) => version.versionNumber === row.approvedVersionNumber
		) ?? versions.at(-1);
	if (!approved) {
		throw new Error("source must have a version");
	}
	return {
		accessedAt: approved.accessedAt.toISOString(),
		approvedVersionNumber: row.approvedVersionNumber,
		capturedContent: approved.capturedContent,
		excerpt: approved.excerpt,
		externalId: approved.externalId,
		externalRecordType: approved.externalRecordType,
		id: row.id,
		projectId: row.projectId,
		provider: approved.provider,
		recordKind: SOURCES_COPY.source,
		revision: row.revision,
		title: approved.title,
		url: approved.url,
		versions: versions.map(toVersionView),
	};
}

function toVersionView(row: SourceVersionRow): SourceVersionView {
	return {
		accessedAt: row.accessedAt.toISOString(),
		capturedContent: row.capturedContent,
		excerpt: row.excerpt,
		externalId: row.externalId,
		externalRecordType: row.externalRecordType,
		id: row.id,
		provider: row.provider,
		title: row.title,
		url: row.url,
		versionNumber: row.versionNumber,
	};
}
