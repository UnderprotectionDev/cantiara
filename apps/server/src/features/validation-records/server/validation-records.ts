import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { createRelation } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";

import {
	type CreateValidationRecordCommand,
	createValidationRecordCommandSchema,
	type RelateValidationContextCommand,
	relateValidationContextCommandSchema,
	VALIDATION_CONTEXT_KINDS,
	VALIDATION_RECORD_KIND,
	VALIDATION_RELATION_KIND,
	type ValidationContextKind,
	type ValidationContextRef,
	type ValidationRecordView,
	type ValidationRecordWriteOutcome,
} from "./validation-records-model";

type PrismaTransaction = Prisma.TransactionClient;

interface ValidationRecordRow {
	id: string;
	method: string;
	projectId: string;
	result: string;
	revision: number;
	title: string;
}

export async function createValidationRecord(
	prisma: PrismaClient,
	command: unknown
): Promise<ValidationRecordWriteOutcome> {
	const parsed = createValidationRecordCommandSchema.safeParse(command);
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

export async function relateValidationContext(
	prisma: PrismaClient,
	command: unknown
): Promise<ValidationRecordWriteOutcome> {
	const parsed = relateValidationContextCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await relateInTransaction(prisma, parsed.data);
}

export async function getValidationRecord(
	prisma: PrismaClient,
	validationRecordId: string,
	viewerWorkspaceId: string
): Promise<ValidationRecordView | null> {
	const row = await prisma.validationRecord.findUnique({
		where: { id: validationRecordId },
	});
	if (!row) {
		return null;
	}
	return await toView(prisma, row, viewerWorkspaceId);
}

export async function listValidationRecords(
	prisma: PrismaClient,
	projectId: string,
	viewerWorkspaceId: string
): Promise<ValidationRecordView[]> {
	const rows = await prisma.validationRecord.findMany({
		orderBy: { createdAt: "asc" },
		where: { projectId },
	});
	return await Promise.all(
		rows.map((row) => toView(prisma, row, viewerWorkspaceId))
	);
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateValidationRecordCommand,
	commandKey: string,
	fingerprint: string
): Promise<ValidationRecordWriteOutcome> {
	await lockProject(tx, command.payload.projectId);
	const replayed = await replayOrConflict(
		tx,
		commandKey,
		fingerprint,
		command.viewerWorkspaceId
	);
	if (replayed) {
		return replayed;
	}
	const created = await tx.validationRecord.create({
		data: {
			id: crypto.randomUUID(),
			method: command.payload.method,
			projectId: command.payload.projectId,
			result: command.payload.result,
			revision: 1,
			title: command.payload.title,
		},
	});
	const view = await toView(tx, created, command.viewerWorkspaceId);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { status: "committed", validationRecord: view };
}

async function relateInTransaction(
	prisma: PrismaClient,
	command: RelateValidationContextCommand
): Promise<ValidationRecordWriteOutcome> {
	const current = await prisma.validationRecord.findUnique({
		where: { id: command.payload.validationRecordId },
	});
	if (!current) {
		return { reason: "validation-record-not-found", status: "rejected" };
	}
	if (command.payload.related.kind === "Decision") {
		const decision = await prisma.decision.findUnique({
			where: { id: command.payload.related.id },
		});
		if (!decision || decision.projectId !== current.projectId) {
			return { reason: "decision-not-found", status: "rejected" };
		}
	}
	const related = await createRelation(prisma, {
		actorId: command.actorId,
		from: {
			id: current.id,
			kind: VALIDATION_RELATION_KIND,
		},
		idempotencyKey: command.idempotencyKey,
		origin: "human",
		previewAcknowledged: true,
		to: command.payload.related,
		type: RELATIONS_COPY.related,
		viewerWorkspaceId: command.viewerWorkspaceId,
	});
	if (related.status === "rejected") {
		if (related.reason === "ends-not-allowed") {
			return { reason: "ends-not-allowed", status: "rejected" };
		}
		return { reason: "invalid-command", status: "rejected" };
	}
	if (related.status === "conflict") {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const view = await getValidationRecord(
		prisma,
		current.id,
		command.viewerWorkspaceId
	);
	if (!view) {
		return { reason: "validation-record-not-found", status: "rejected" };
	}
	if (related.status === "replayed") {
		return { status: "replayed", validationRecord: view };
	}
	return { status: "committed", validationRecord: view };
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string,
	viewerWorkspaceId: string
): Promise<ValidationRecordWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.validationRecord.findUnique({
		where: { id: existing.targetId },
	});
	if (live) {
		return {
			status: "replayed",
			validationRecord: await toView(tx, live, viewerWorkspaceId),
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
		view: ValidationRecordView;
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
	const [lockA, lockB] = advisoryKeys(
		`validation-records:project:${projectId}`
	);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

async function toView(
	db: PrismaClient | PrismaTransaction,
	row: ValidationRecordRow,
	viewerWorkspaceId: string
): Promise<ValidationRecordView> {
	return {
		id: row.id,
		method: row.method,
		projectId: row.projectId,
		recordKind: VALIDATION_RECORD_KIND,
		relatedContext: await loadRelatedContext(db, row.id, viewerWorkspaceId),
		result: row.result,
		revision: row.revision,
		title: row.title,
	};
}

async function loadRelatedContext(
	db: PrismaClient | PrismaTransaction,
	validationRecordId: string,
	_viewerWorkspaceId: string
): Promise<ValidationContextRef[]> {
	const rows = await db.typedRelation.findMany({
		orderBy: { establishedAt: "asc" },
		where: {
			OR: [
				{
					fromId: validationRecordId,
					fromKind: VALIDATION_RELATION_KIND,
				},
				{
					toId: validationRecordId,
					toKind: VALIDATION_RELATION_KIND,
				},
			],
			type: RELATIONS_COPY.related,
		},
	});
	const ends: Array<{ id: string; kind: ValidationContextKind }> = [];
	for (const row of rows) {
		const other =
			row.fromId === validationRecordId &&
			row.fromKind === VALIDATION_RELATION_KIND
				? { id: row.toId, kind: row.toKind }
				: { id: row.fromId, kind: row.fromKind };
		if (!isContextKind(other.kind)) {
			continue;
		}
		ends.push({ id: other.id, kind: other.kind });
	}
	return await Promise.all(
		ends.map(async (other) => ({
			id: other.id,
			kind: other.kind,
			title: await contextTitle(db, other.id, other.kind),
		}))
	);
}

function isContextKind(kind: string): kind is ValidationContextKind {
	return (VALIDATION_CONTEXT_KINDS as readonly string[]).includes(kind);
}

async function contextTitle(
	db: PrismaClient | PrismaTransaction,
	id: string,
	kind: ValidationContextKind
): Promise<string> {
	if (kind !== "Decision") {
		return id;
	}
	const decision = await db.decision.findUnique({ where: { id } });
	return decision?.title ?? id;
}
