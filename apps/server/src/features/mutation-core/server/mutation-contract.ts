import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@cantiara/db";
import { z } from "zod";

export const MUTATION_COPY = {
	conflict: "Conflict",
	currentValue: "Current value",
} as const;

export const MUTATION_ACTOR = {
	authorizedIntegration: "Authorized integration",
	github: "GitHub",
	systemAutomation: "System automation",
	user: "User",
} as const;

export type MutationActor =
	(typeof MUTATION_ACTOR)[keyof typeof MUTATION_ACTOR];

const HUMAN_ORIGIN = "human";
const NON_HUMAN_ORIGINS = [
	"authorized-integration",
	"github",
	"system-automation",
] as const;

export type NonHumanOrigin = (typeof NON_HUMAN_ORIGINS)[number];
export type MutationOrigin = typeof HUMAN_ORIGIN | NonHumanOrigin;

const payloadSchema = z.object({
	value: z.string(),
});

export type MutationPayload = z.infer<typeof payloadSchema>;

export interface HumanMutationCommand {
	actorId: string;
	baseRevision: number;
	idempotencyKey: string;
	origin: typeof HUMAN_ORIGIN;
	payload: MutationPayload;
	targetId: string;
}

export interface NonHumanMutationCommand {
	actorId: string;
	deliveryId: string;
	origin: NonHumanOrigin;
	payload: MutationPayload;
	payloadFingerprint: string;
	revisionCondition: number;
	targetId: string;
	verifiedSourceId: string;
}

export type MutationCommand = HumanMutationCommand | NonHumanMutationCommand;

export interface MutationReceipt {
	revision: number;
	targetId: string;
	value: string;
}

export interface RecordHistoryEntryView {
	actor: MutationActor;
	actorId: string;
	nextValue: string;
	occurredAt: Date;
	origin: MutationOrigin;
	previousValue: string;
	revisionAfter: number;
}

export type MutationOutcome =
	| { receipt: MutationReceipt; status: "committed" }
	| { receipt: MutationReceipt; status: "replayed" }
	| { conflict: typeof MUTATION_COPY.conflict; status: "conflict" }
	| {
			current: MutationReceipt;
			currentValueLabel: typeof MUTATION_COPY.currentValue;
			status: "stale";
	  }
	| {
			reason:
				| "fake-human-base"
				| "missing-base-revision"
				| "missing-delivery-id"
				| "missing-idempotency-key"
				| "missing-payload-fingerprint"
				| "missing-revision-condition"
				| "missing-source"
				| "target-not-found";
			status: "rejected";
	  };

type PrismaTransaction = Prisma.TransactionClient;

const humanCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	payload: payloadSchema,
	targetId: z.string().min(1),
});

const nonHumanCommandSchema = z.object({
	actorId: z.string().min(1),
	deliveryId: z.string().min(1),
	origin: z.enum(NON_HUMAN_ORIGINS),
	payload: payloadSchema,
	payloadFingerprint: z.string().min(1),
	revisionCondition: z.number().int().nonnegative(),
	targetId: z.string().min(1),
	verifiedSourceId: z.string().min(1),
});

export async function createMutationTarget(
	prisma: PrismaClient,
	value: string
): Promise<MutationReceipt> {
	const row = await prisma.mutationFixtureRecord.create({
		data: {
			id: crypto.randomUUID(),
			revision: 1,
			value,
		},
	});
	return { revision: row.revision, targetId: row.id, value: row.value };
}

export async function readMutationTarget(
	prisma: PrismaClient,
	targetId: string
): Promise<MutationReceipt | null> {
	const row = await prisma.mutationFixtureRecord.findUnique({
		where: { id: targetId },
	});
	if (!row) {
		return null;
	}
	return { revision: row.revision, targetId: row.id, value: row.value };
}

export async function readRecordHistory(
	prisma: PrismaClient,
	targetId: string
): Promise<RecordHistoryEntryView[]> {
	const rows = await prisma.recordHistoryEntry.findMany({
		orderBy: { occurredAt: "asc" },
		where: { targetId },
	});
	return rows.map((row) => ({
		actor: row.actorType as MutationActor,
		actorId: row.actorId,
		nextValue: row.nextValue,
		occurredAt: row.occurredAt,
		origin: row.origin as MutationOrigin,
		previousValue: row.previousValue,
		revisionAfter: row.revisionAfter,
	}));
}

export async function applyMutation(
	prisma: PrismaClient,
	command: unknown
): Promise<MutationOutcome> {
	const parsed = parseCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	if (
		parsed.command.origin !== HUMAN_ORIGIN &&
		parsed.command.payloadFingerprint !== fingerprint
	) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const commandKey = commandKeyFor(parsed.command);
	const expectedRevision =
		parsed.command.origin === HUMAN_ORIGIN
			? parsed.command.baseRevision
			: parsed.command.revisionCondition;
	const targetLock = `mutation-target:${parsed.command.targetId}`;
	const [lockA, lockB] = advisoryKeys(targetLock);
	return await prisma.$transaction((tx) =>
		applyInTransaction(tx, {
			command: parsed.command,
			commandKey,
			expectedRevision,
			fingerprint,
			lockA,
			lockB,
		})
	);
}

async function applyInTransaction(
	tx: PrismaTransaction,
	input: {
		command: MutationCommand;
		commandKey: string;
		expectedRevision: number;
		fingerprint: string;
		lockA: number;
		lockB: number;
	}
): Promise<MutationOutcome> {
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${input.lockA}, ${input.lockB})`;
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey: input.commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint === input.fingerprint) {
			return {
				receipt: {
					revision: existing.committedRevision,
					targetId: existing.targetId,
					value: existing.resultValue,
				},
				status: "replayed",
			};
		}
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const current = await tx.mutationFixtureRecord.findUnique({
		where: { id: input.command.targetId },
	});
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (current.revision !== input.expectedRevision) {
		return {
			current: {
				revision: current.revision,
				targetId: current.id,
				value: current.value,
			},
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	const nextRevision = current.revision + 1;
	const nextValue = input.command.payload.value;
	await tx.mutationFixtureRecord.update({
		data: { revision: nextRevision, value: nextValue },
		where: { id: current.id },
	});
	await tx.mutationReceipt.create({
		data: {
			actorId: input.command.actorId,
			actorType: actorFor(input.command.origin),
			commandKey: input.commandKey,
			committedRevision: nextRevision,
			id: crypto.randomUUID(),
			origin: input.command.origin,
			payloadFingerprint: input.fingerprint,
			resultValue: nextValue,
			targetId: current.id,
		},
	});
	await tx.recordHistoryEntry.create({
		data: {
			actorId: input.command.actorId,
			actorType: actorFor(input.command.origin),
			id: crypto.randomUUID(),
			nextValue,
			occurredAt: new Date(),
			origin: input.command.origin,
			previousValue: current.value,
			revisionAfter: nextRevision,
			targetId: current.id,
		},
	});
	return {
		receipt: {
			revision: nextRevision,
			targetId: current.id,
			value: nextValue,
		},
		status: "committed",
	};
}

function parseCommand(
	command: unknown
):
	| { command: MutationCommand; status: "ok" }
	| { outcome: MutationOutcome; status: "rejected" } {
	if (!isRecord(command)) {
		return {
			outcome: { reason: "missing-base-revision", status: "rejected" },
			status: "rejected",
		};
	}
	if (command.origin === HUMAN_ORIGIN) {
		const humanRejection = rejectHuman(command);
		if (humanRejection) {
			return { outcome: humanRejection, status: "rejected" };
		}
		const parsed = humanCommandSchema.safeParse(command);
		if (!parsed.success) {
			return {
				outcome: { reason: "missing-base-revision", status: "rejected" },
				status: "rejected",
			};
		}
		return { command: parsed.data, status: "ok" };
	}
	if (isNonHumanOrigin(command.origin)) {
		if ("baseRevision" in command || "idempotencyKey" in command) {
			return {
				outcome: { reason: "fake-human-base", status: "rejected" },
				status: "rejected",
			};
		}
		const nonHumanRejection = rejectNonHuman(command);
		if (nonHumanRejection) {
			return { outcome: nonHumanRejection, status: "rejected" };
		}
		const parsed = nonHumanCommandSchema.safeParse(command);
		if (!parsed.success) {
			return {
				outcome: { reason: "missing-source", status: "rejected" },
				status: "rejected",
			};
		}
		return { command: parsed.data, status: "ok" };
	}
	return {
		outcome: { reason: "missing-base-revision", status: "rejected" },
		status: "rejected",
	};
}

function rejectHuman(command: Record<string, unknown>): MutationOutcome | null {
	if (
		command.baseRevision === undefined ||
		command.baseRevision === null ||
		command.baseRevision === ""
	) {
		return { reason: "missing-base-revision", status: "rejected" };
	}
	if (
		typeof command.idempotencyKey !== "string" ||
		command.idempotencyKey.length === 0
	) {
		return { reason: "missing-idempotency-key", status: "rejected" };
	}
	return null;
}

function rejectNonHuman(
	command: Record<string, unknown>
): MutationOutcome | null {
	if (
		typeof command.verifiedSourceId !== "string" ||
		command.verifiedSourceId.length === 0
	) {
		return { reason: "missing-source", status: "rejected" };
	}
	if (
		typeof command.deliveryId !== "string" ||
		command.deliveryId.length === 0
	) {
		return { reason: "missing-delivery-id", status: "rejected" };
	}
	if (
		typeof command.payloadFingerprint !== "string" ||
		command.payloadFingerprint.length === 0
	) {
		return { reason: "missing-payload-fingerprint", status: "rejected" };
	}
	if (
		command.revisionCondition === undefined ||
		command.revisionCondition === null ||
		command.revisionCondition === ""
	) {
		return { reason: "missing-revision-condition", status: "rejected" };
	}
	return null;
}

function commandKeyFor(command: MutationCommand): string {
	if (command.origin === HUMAN_ORIGIN) {
		return `human:${command.actorId}:${command.idempotencyKey}`;
	}
	return `source:${command.verifiedSourceId}:${command.deliveryId}`;
}

function actorFor(origin: MutationOrigin): MutationActor {
	if (origin === HUMAN_ORIGIN) {
		return MUTATION_ACTOR.user;
	}
	if (origin === "github") {
		return MUTATION_ACTOR.github;
	}
	if (origin === "authorized-integration") {
		return MUTATION_ACTOR.authorizedIntegration;
	}
	return MUTATION_ACTOR.systemAutomation;
}

function isNonHumanOrigin(origin: unknown): origin is NonHumanOrigin {
	return (
		origin === "github" ||
		origin === "system-automation" ||
		origin === "authorized-integration"
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function payloadFingerprint(payload: unknown): string {
	return createHash("sha256").update(canonicalize(payload)).digest("hex");
}

function canonicalize(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map(canonicalize).join(",")}]`;
	}
	const record = value as Record<string, unknown>;
	const keys = Object.keys(record).sort();
	return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function advisoryKeys(label: string): [number, number] {
	const digest = createHash("sha256").update(label).digest();
	return [digest.readInt32BE(0), digest.readInt32BE(4)];
}
