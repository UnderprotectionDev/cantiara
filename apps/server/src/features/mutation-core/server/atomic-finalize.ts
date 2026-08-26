import type { Prisma, PrismaClient } from "@cantiara/db";
import { z } from "zod";

import {
	actorFor,
	advisoryKeys,
	HUMAN_ORIGIN,
	isRecord,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "./mutation-shared";

const STAGING_TTL_MS = 24 * 60 * 60 * 1000;
const STAGED = "staged";
const FINALIZING = "finalizing";
const COMMITTED = "committed";
const ROLLED_BACK = "rolled-back";
const CANCELLED = "cancelled";
const RECEIPT_COMMIT = "commit";
const RECEIPT_ROLLBACK = "rollback";

type PrismaTransaction = Prisma.TransactionClient;

const relationSchema = z.object({
	kind: z.string().min(1),
	targetId: z.string().min(1),
});

const atomicPayloadSchema = z.object({
	counterDelta: z.number().int().optional(),
	indexToken: z.string().min(1).optional(),
	relation: relationSchema.optional(),
	value: z.string(),
});

const atomicCommandSchema = z.object({
	actorId: z.string().min(1),
	authorization: z.enum(["allowed", "denied"]),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	payload: atomicPayloadSchema,
	quotaRemaining: z.number().int().nonnegative(),
	targetId: z.string().min(1),
	targetScope: z.string().min(1),
});

export type AtomicWriteCommand = z.infer<typeof atomicCommandSchema>;
export type AtomicPayload = z.infer<typeof atomicPayloadSchema>;

export interface AtomicReceipt {
	kind: typeof RECEIPT_COMMIT | typeof RECEIPT_ROLLBACK;
	revision: number;
	targetId: string;
	value: string;
}

export interface AtomicWriteView {
	operationId: string;
	status:
		| typeof STAGED
		| typeof FINALIZING
		| typeof COMMITTED
		| typeof ROLLED_BACK
		| typeof CANCELLED;
	ui: {
		cancelAvailable: boolean;
		label: typeof MUTATION_COPY.cancel | typeof MUTATION_COPY.finalizing;
	};
}

export interface AtomicLiveState {
	counter: number;
	indexTokens: string[];
	record: { revision: number; targetId: string; value: string } | null;
	relations: Array<{ kind: string; targetId: string }>;
}

export type AtomicWriteOutcome =
	| { operation: AtomicWriteView; status: "staged" }
	| { operation: AtomicWriteView; status: "cancelled" }
	| { operation: AtomicWriteView; receipt: AtomicReceipt; status: "committed" }
	| { operation: AtomicWriteView; receipt: AtomicReceipt; status: "replayed" }
	| {
			operation: AtomicWriteView;
			receipt: AtomicReceipt;
			status: "rolled-back";
	  }
	| {
			current: { revision: number; targetId: string; value: string };
			currentValueLabel: typeof MUTATION_COPY.currentValue;
			operation: AtomicWriteView;
			receipt: AtomicReceipt;
			status: "stale";
	  }
	| { conflict: typeof MUTATION_COPY.conflict; status: "conflict" }
	| {
			status: "refused";
			ui: {
				cancelAvailable: false;
				label: typeof MUTATION_COPY.finalizing;
			};
	  }
	| {
			reason:
				| "missing-authorization"
				| "missing-base-revision"
				| "missing-idempotency-key"
				| "missing-quota"
				| "missing-scope"
				| "operation-not-found"
				| "target-not-found";
			status: "rejected";
	  };

export interface AtomicClock {
	now?: Date;
}

export async function stageAtomicWrite(
	prisma: PrismaClient,
	command: unknown,
	clock: AtomicClock = {}
): Promise<AtomicWriteOutcome> {
	const parsed = parseAtomicCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const now = clock.now ?? new Date();
	return await prisma.$transaction((tx) =>
		stageInTransaction(tx, parsed.command, now)
	);
}

export async function readAtomicWrite(
	prisma: PrismaClient,
	operationId: string
): Promise<AtomicWriteView | null> {
	const row = await prisma.mutationStagingOperation.findUnique({
		where: { id: operationId },
	});
	if (!row) {
		return null;
	}
	return viewFor(row);
}

export async function cancelAtomicWrite(
	prisma: PrismaClient,
	operationId: string
): Promise<AtomicWriteOutcome> {
	return await prisma.$transaction(async (tx) => {
		const row = await tx.mutationStagingOperation.findUnique({
			where: { id: operationId },
		});
		if (!row) {
			return { reason: "operation-not-found", status: "rejected" };
		}
		await lockTargetAndCommand(tx, row.targetId, row.commandKey);
		const locked = await tx.mutationStagingOperation.findUnique({
			where: { id: operationId },
		});
		if (!locked) {
			return { reason: "operation-not-found", status: "rejected" };
		}
		if (locked.status !== STAGED) {
			return {
				status: "refused",
				ui: {
					cancelAvailable: false,
					label: MUTATION_COPY.finalizing,
				},
			};
		}
		await tx.mutationStagingOperation.delete({ where: { id: locked.id } });
		return {
			operation: {
				operationId: locked.id,
				status: CANCELLED,
				ui: {
					cancelAvailable: false,
					label: MUTATION_COPY.cancel,
				},
			},
			status: "cancelled",
		};
	});
}

export async function finalizeAtomicWrite(
	prisma: PrismaClient,
	command: unknown,
	clock: AtomicClock = {}
): Promise<AtomicWriteOutcome> {
	const parsed = parseAtomicCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const now = clock.now ?? new Date();
	const prepared = await prisma.$transaction((tx) =>
		prepareFinalize(tx, parsed.command, now)
	);
	if (prepared.status !== "ready") {
		return prepared.outcome;
	}
	try {
		return await prisma.$transaction((tx) =>
			commitLiveEffects(tx, parsed.command, prepared.operationId)
		);
	} catch {
		return await prisma.$transaction((tx) =>
			rollbackAfterBarrier(tx, parsed.command, prepared.operationId)
		);
	}
}

export async function readAtomicLiveState(
	prisma: PrismaClient,
	targetId: string
): Promise<AtomicLiveState> {
	const record = await prisma.mutationFixtureRecord.findUnique({
		where: { id: targetId },
	});
	const [relations, counter, indexRows] = await Promise.all([
		prisma.mutationFixtureRelation.findMany({
			orderBy: [{ kind: "asc" }, { targetId: "asc" }],
			where: { sourceId: targetId },
		}),
		prisma.mutationFixtureCounter.findUnique({ where: { targetId } }),
		prisma.mutationFixtureIndexEntry.findMany({
			orderBy: { token: "asc" },
			where: { targetId },
		}),
	]);
	return {
		counter: counter?.value ?? 0,
		indexTokens: indexRows.map((row) => row.token),
		record: record
			? { revision: record.revision, targetId: record.id, value: record.value }
			: null,
		relations: relations.map((row) => ({
			kind: row.kind,
			targetId: row.targetId,
		})),
	};
}

export async function cleanupExpiredStaging(
	prisma: PrismaClient,
	now: Date
): Promise<number> {
	const result = await prisma.mutationStagingOperation.deleteMany({
		where: {
			expiresAt: { lte: now },
			status: STAGED,
		},
	});
	return result.count;
}

async function stageInTransaction(
	tx: PrismaTransaction,
	command: AtomicWriteCommand,
	now: Date
): Promise<AtomicWriteOutcome> {
	const commandKey = atomicCommandKey(command);
	await lockTargetAndCommand(tx, command.targetId, commandKey);
	const replayed = await replayOrConflict(tx, command, commandKey);
	if (replayed) {
		return replayed;
	}
	const fingerprint = payloadFingerprint(command.payload);
	const existing = await tx.mutationStagingOperation.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return { operation: viewFor(existing), status: "staged" };
	}
	const created = await insertStaged(tx, command, commandKey, now, fingerprint);
	return { operation: viewFor(created), status: "staged" };
}

async function prepareFinalize(
	tx: PrismaTransaction,
	command: AtomicWriteCommand,
	now: Date
): Promise<
	| { operationId: string; status: "ready" }
	| { outcome: AtomicWriteOutcome; status: "done" }
> {
	const commandKey = atomicCommandKey(command);
	await lockTargetAndCommand(tx, command.targetId, commandKey);
	const replayed = await replayOrConflict(tx, command, commandKey);
	if (replayed) {
		return { outcome: replayed, status: "done" };
	}
	const staged = await ensureStaged(tx, command, commandKey, now);
	if (staged.status !== "ok") {
		return { outcome: staged.outcome, status: "done" };
	}
	if (staged.row.status === FINALIZING) {
		return { operationId: staged.row.id, status: "ready" };
	}
	if (staged.row.status !== STAGED) {
		return {
			outcome: {
				status: "refused",
				ui: {
					cancelAvailable: false,
					label: MUTATION_COPY.finalizing,
				},
			},
			status: "done",
		};
	}
	const barrier = await recheckBarrier(tx, command, staged.row);
	if (barrier.status !== "ok") {
		return { outcome: barrier.outcome, status: "done" };
	}
	await tx.mutationStagingOperation.update({
		data: { status: FINALIZING },
		where: { id: staged.row.id },
	});
	return { operationId: staged.row.id, status: "ready" };
}

async function commitLiveEffects(
	tx: PrismaTransaction,
	command: AtomicWriteCommand,
	operationId: string
): Promise<AtomicWriteOutcome> {
	const commandKey = atomicCommandKey(command);
	await lockTargetAndCommand(tx, command.targetId, commandKey);
	const current = await tx.mutationFixtureRecord.findUnique({
		where: { id: command.targetId },
	});
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const nextRevision = current.revision + 1;
	const nextValue = command.payload.value;
	await tx.mutationFixtureRecord.update({
		data: { revision: nextRevision, value: nextValue },
		where: { id: current.id },
	});
	if (command.payload.relation) {
		await tx.mutationFixtureRelation.create({
			data: {
				id: crypto.randomUUID(),
				kind: command.payload.relation.kind,
				sourceId: current.id,
				targetId: command.payload.relation.targetId,
			},
		});
	}
	if (command.payload.counterDelta !== undefined) {
		await tx.mutationFixtureCounter.upsert({
			create: {
				id: crypto.randomUUID(),
				targetId: current.id,
				value: command.payload.counterDelta,
			},
			update: { value: { increment: command.payload.counterDelta } },
			where: { targetId: current.id },
		});
	}
	if (command.payload.indexToken !== undefined) {
		await tx.mutationFixtureIndexEntry.create({
			data: {
				id: crypto.randomUUID(),
				targetId: current.id,
				token: command.payload.indexToken,
			},
		});
	}
	await tx.recordHistoryEntry.create({
		data: {
			actorId: command.actorId,
			actorType: actorFor(command.origin),
			id: crypto.randomUUID(),
			nextValue,
			occurredAt: new Date(),
			origin: command.origin,
			previousValue: current.value,
			revisionAfter: nextRevision,
			targetId: current.id,
		},
	});
	const receipt = await writeReceipt(tx, {
		command,
		commandKey,
		kind: RECEIPT_COMMIT,
		revision: nextRevision,
		value: nextValue,
	});
	const operation = await tx.mutationStagingOperation.update({
		data: { status: COMMITTED },
		where: { id: operationId },
	});
	return {
		operation: viewFor(operation),
		receipt,
		status: "committed",
	};
}

async function rollbackAfterBarrier(
	tx: PrismaTransaction,
	command: AtomicWriteCommand,
	operationId: string
): Promise<AtomicWriteOutcome> {
	const commandKey = atomicCommandKey(command);
	await lockTargetAndCommand(tx, command.targetId, commandKey);
	const current = await tx.mutationFixtureRecord.findUnique({
		where: { id: command.targetId },
	});
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return await persistRollback(tx, {
		command,
		commandKey,
		current,
		operationId,
	});
}

async function recheckBarrier(
	tx: PrismaTransaction,
	command: AtomicWriteCommand,
	staged: {
		baseRevision: number;
		id: string;
		payloadFingerprint: string;
		targetScope: string;
	}
): Promise<
	{ status: "ok" } | { outcome: AtomicWriteOutcome; status: "failed" }
> {
	const fingerprint = payloadFingerprint(command.payload);
	if (fingerprint !== staged.payloadFingerprint) {
		return {
			outcome: { conflict: MUTATION_COPY.conflict, status: "conflict" },
			status: "failed",
		};
	}
	const current = await tx.mutationFixtureRecord.findUnique({
		where: { id: command.targetId },
	});
	if (!current) {
		return {
			outcome: { reason: "target-not-found", status: "rejected" },
			status: "failed",
		};
	}
	const commandKey = atomicCommandKey(command);
	if (
		command.authorization !== "allowed" ||
		command.targetScope !== staged.targetScope ||
		command.quotaRemaining < 1
	) {
		return {
			outcome: await persistRollback(tx, {
				command,
				commandKey,
				current,
				operationId: staged.id,
			}),
			status: "failed",
		};
	}
	if (current.revision !== staged.baseRevision) {
		const outcome = await persistRollback(tx, {
			command,
			commandKey,
			current,
			operationId: staged.id,
		});
		if (outcome.status !== "rolled-back") {
			return { outcome, status: "failed" };
		}
		return {
			outcome: {
				current: {
					revision: current.revision,
					targetId: current.id,
					value: current.value,
				},
				currentValueLabel: MUTATION_COPY.currentValue,
				operation: outcome.operation,
				receipt: outcome.receipt,
				status: "stale",
			},
			status: "failed",
		};
	}
	return { status: "ok" };
}

async function persistRollback(
	tx: PrismaTransaction,
	input: {
		command: AtomicWriteCommand;
		commandKey: string;
		current: { id: string; revision: number; value: string };
		operationId: string;
	}
): Promise<Extract<AtomicWriteOutcome, { status: "rolled-back" }>> {
	const receipt = await writeReceipt(tx, {
		command: input.command,
		commandKey: input.commandKey,
		kind: RECEIPT_ROLLBACK,
		revision: input.current.revision,
		value: input.current.value,
	});
	const operation = await tx.mutationStagingOperation.update({
		data: { status: ROLLED_BACK },
		where: { id: input.operationId },
	});
	return {
		operation: viewFor(operation),
		receipt,
		status: "rolled-back",
	};
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		command: AtomicWriteCommand;
		commandKey: string;
		kind: typeof RECEIPT_COMMIT | typeof RECEIPT_ROLLBACK;
		revision: number;
		value: string;
	}
): Promise<AtomicReceipt> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.revision,
			id: crypto.randomUUID(),
			kind: input.kind,
			origin: input.command.origin,
			payloadFingerprint: payloadFingerprint(input.command.payload),
			resultValue: input.value,
			targetId: input.command.targetId,
		},
	});
	return {
		kind: input.kind,
		revision: input.revision,
		targetId: input.command.targetId,
		value: input.value,
	};
}

async function replayOrConflict(
	tx: PrismaTransaction,
	command: AtomicWriteCommand,
	commandKey: string
): Promise<AtomicWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	const fingerprint = payloadFingerprint(command.payload);
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const operation = await tx.mutationStagingOperation.findUnique({
		where: { commandKey },
	});
	if (!operation) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return {
		operation: viewFor(operation),
		receipt: {
			kind:
				existing.kind === RECEIPT_ROLLBACK ? RECEIPT_ROLLBACK : RECEIPT_COMMIT,
			revision: existing.committedRevision,
			targetId: existing.targetId,
			value: existing.resultValue,
		},
		status: "replayed",
	};
}

async function ensureStaged(
	tx: PrismaTransaction,
	command: AtomicWriteCommand,
	commandKey: string,
	now: Date
): Promise<
	| {
			row: {
				baseRevision: number;
				id: string;
				payloadFingerprint: string;
				status: string;
				targetScope: string;
			};
			status: "ok";
	  }
	| { outcome: AtomicWriteOutcome; status: "failed" }
> {
	const fingerprint = payloadFingerprint(command.payload);
	const existing = await tx.mutationStagingOperation.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return {
				outcome: { conflict: MUTATION_COPY.conflict, status: "conflict" },
				status: "failed",
			};
		}
		return { row: existing, status: "ok" };
	}
	const created = await insertStaged(tx, command, commandKey, now, fingerprint);
	return { row: created, status: "ok" };
}

async function insertStaged(
	tx: PrismaTransaction,
	command: AtomicWriteCommand,
	commandKey: string,
	now: Date,
	fingerprint: string
) {
	return await tx.mutationStagingOperation.create({
		data: {
			actorId: command.actorId,
			baseRevision: command.baseRevision,
			commandKey,
			expiresAt: new Date(now.getTime() + STAGING_TTL_MS),
			id: crypto.randomUUID(),
			origin: command.origin,
			payloadFingerprint: fingerprint,
			payloadJson: JSON.stringify(command.payload),
			status: STAGED,
			targetId: command.targetId,
			targetScope: command.targetScope,
		},
	});
}

function viewFor(row: { id: string; status: string }): AtomicWriteView {
	let status: AtomicWriteView["status"] = STAGED;
	if (row.status === COMMITTED) {
		status = COMMITTED;
	} else if (row.status === ROLLED_BACK) {
		status = ROLLED_BACK;
	} else if (row.status === FINALIZING) {
		status = FINALIZING;
	}
	const cancelAvailable = status === STAGED;
	return {
		operationId: row.id,
		status,
		ui: {
			cancelAvailable,
			label: cancelAvailable ? MUTATION_COPY.cancel : MUTATION_COPY.finalizing,
		},
	};
}

function atomicCommandKey(command: AtomicWriteCommand): string {
	return `human:${command.actorId}:${command.idempotencyKey}`;
}

async function lockTargetAndCommand(
	tx: PrismaTransaction,
	targetId: string,
	commandKey: string
): Promise<void> {
	const [targetA, targetB] = advisoryKeys(`mutation-target:${targetId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${targetA}, ${targetB})`;
	const [opA, opB] = advisoryKeys(`atomic:${commandKey}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${opA}, ${opB})`;
}

function parseAtomicCommand(
	command: unknown
):
	| { command: AtomicWriteCommand; status: "ok" }
	| { outcome: AtomicWriteOutcome; status: "rejected" } {
	if (!isRecord(command)) {
		return {
			outcome: { reason: "missing-base-revision", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		command.baseRevision === undefined ||
		command.baseRevision === null ||
		command.baseRevision === ""
	) {
		return {
			outcome: { reason: "missing-base-revision", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		typeof command.idempotencyKey !== "string" ||
		command.idempotencyKey.length === 0
	) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		command.authorization === undefined ||
		command.authorization === null ||
		command.authorization === ""
	) {
		return {
			outcome: { reason: "missing-authorization", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		typeof command.targetScope !== "string" ||
		command.targetScope.length === 0
	) {
		return {
			outcome: { reason: "missing-scope", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		command.quotaRemaining === undefined ||
		command.quotaRemaining === null ||
		command.quotaRemaining === ""
	) {
		return {
			outcome: { reason: "missing-quota", status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = atomicCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-base-revision", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}
