import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@cantiara/db";
import { z } from "zod";

export const MUTATION_COPY = {
	conflict: "Conflict",
	currentValue: "Current value",
	undo: "Undo",
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

export const CHANGE_KIND = {
	atomicTransform: "atomic-transform",
	externalSystem: "external-system",
	field: "field",
	merge: "merge",
	permanentDelete: "permanent-delete",
	publishedExport: "published-export",
	relation: "relation",
	securityRedaction: "security-redaction",
	viewMetadata: "view-metadata",
} as const;

export type ChangeKind = (typeof CHANGE_KIND)[keyof typeof CHANGE_KIND];

const SAFE_UNDO_KINDS = new Set<string>([
	CHANGE_KIND.atomicTransform,
	CHANGE_KIND.field,
	CHANGE_KIND.merge,
	CHANGE_KIND.relation,
	CHANGE_KIND.viewMetadata,
]);

const payloadSchema = z.object({
	attributedFields: z.record(z.string(), z.string()).optional(),
	attributedRelationToIds: z.array(z.string().min(1)).optional(),
	field: z.string().min(1).optional(),
	kind: z
		.enum([
			CHANGE_KIND.atomicTransform,
			CHANGE_KIND.externalSystem,
			CHANGE_KIND.field,
			CHANGE_KIND.merge,
			CHANGE_KIND.permanentDelete,
			CHANGE_KIND.publishedExport,
			CHANGE_KIND.relation,
			CHANGE_KIND.securityRedaction,
			CHANGE_KIND.viewMetadata,
		])
		.optional(),
	secondaryValue: z.string().optional(),
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

export interface UndoCommand {
	actorId: string;
	baseRevision: number;
	historyEntryId: string;
	idempotencyKey: string;
	origin: typeof HUMAN_ORIGIN;
	targetId: string;
}

const undoCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	historyEntryId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	targetId: z.string().min(1),
});

export interface MutationReceipt {
	revision: number;
	targetId: string;
	value: string;
}

export interface RecordHistoryEntryView {
	actor: MutationActor;
	actorId: string;
	changeKind: ChangeKind;
	fieldKey: string;
	id: string;
	nextValue: string;
	occurredAt: Date;
	origin: MutationOrigin;
	previousValue: string;
	revisionAfter: number;
	undo: typeof MUTATION_COPY.undo | null;
}

export type MutationOutcome =
	| { receipt: MutationReceipt; status: "committed" }
	| { receipt: MutationReceipt; status: "replayed" }
	| { conflict: typeof MUTATION_COPY.conflict; status: "conflict" }
	| {
			conflict: typeof MUTATION_COPY.conflict;
			current: MutationReceipt;
			currentValueLabel: typeof MUTATION_COPY.currentValue;
			status: "conflict";
	  }
	| {
			current: MutationReceipt;
			currentValueLabel: typeof MUTATION_COPY.currentValue;
			status: "stale";
	  }
	| {
			reason:
				| "fake-human-base"
				| "history-not-found"
				| "missing-base-revision"
				| "missing-delivery-id"
				| "missing-history-entry"
				| "missing-idempotency-key"
				| "missing-payload-fingerprint"
				| "missing-revision-condition"
				| "missing-source"
				| "target-not-found"
				| "undo-not-safe";
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

export async function readMutationFields(
	prisma: PrismaClient,
	targetId: string
): Promise<Record<string, string> | null> {
	const row = await prisma.mutationFixtureRecord.findUnique({
		where: { id: targetId },
	});
	if (!row) {
		return null;
	}
	return recordFields(row);
}

export async function readMutationRelations(
	prisma: PrismaClient,
	fromId: string
): Promise<{ kind: string; toId: string }[]> {
	const rows = await prisma.mutationFixtureRelation.findMany({
		orderBy: { createdAt: "asc" },
		where: { fromId },
	});
	return rows.map((row) => ({ kind: row.kind, toId: row.toId }));
}

export async function readRetiredInto(
	prisma: PrismaClient,
	targetId: string
): Promise<string | null> {
	const row = await prisma.mutationFixtureRecord.findUnique({
		where: { id: targetId },
	});
	return row?.retiredIntoId ?? null;
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
		changeKind: row.changeKind as ChangeKind,
		fieldKey: row.fieldKey,
		id: row.id,
		nextValue: row.nextValue,
		occurredAt: row.occurredAt,
		origin: row.origin as MutationOrigin,
		previousValue: row.previousValue,
		revisionAfter: row.revisionAfter,
		undo: SAFE_UNDO_KINDS.has(row.changeKind) ? MUTATION_COPY.undo : null,
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
	const applied = await applyChange(tx, {
		actorId: input.command.actorId,
		actorType: actorFor(input.command.origin),
		commandKey: input.commandKey,
		current,
		fingerprint: input.fingerprint,
		nextRevision,
		origin: input.command.origin,
		payload: input.command.payload,
	});
	if (applied.status !== "ok") {
		return applied.outcome;
	}
	return {
		receipt: {
			revision: nextRevision,
			targetId: current.id,
			value: applied.resultValue,
		},
		status: "committed",
	};
}

export async function applyUndo(
	prisma: PrismaClient,
	command: unknown
): Promise<MutationOutcome> {
	const parsed = parseUndoCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		historyEntryId: parsed.command.historyEntryId,
		undo: true,
	});
	const commandKey = `human:${parsed.command.actorId}:${parsed.command.idempotencyKey}`;
	const [lockA, lockB] = advisoryKeys(
		`mutation-target:${parsed.command.targetId}`
	);
	return await prisma.$transaction((tx) =>
		undoInTransaction(tx, {
			command: parsed.command,
			commandKey,
			fingerprint,
			lockA,
			lockB,
		})
	);
}

async function undoInTransaction(
	tx: PrismaTransaction,
	input: {
		command: UndoCommand;
		commandKey: string;
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
	if (current.revision !== input.command.baseRevision) {
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
	const entry = await tx.recordHistoryEntry.findUnique({
		where: { id: input.command.historyEntryId },
	});
	if (!entry || entry.targetId !== current.id) {
		return { reason: "history-not-found", status: "rejected" };
	}
	if (!SAFE_UNDO_KINDS.has(entry.changeKind)) {
		return { reason: "undo-not-safe", status: "rejected" };
	}
	if (await hasNewerSameFieldValue(tx, entry)) {
		const fields = recordFields(current);
		const currentField =
			entry.changeKind === CHANGE_KIND.field ||
			entry.changeKind === CHANGE_KIND.viewMetadata
				? readField(fields, entry.fieldKey)
				: current.value;
		return {
			conflict: MUTATION_COPY.conflict,
			current: {
				revision: current.revision,
				targetId: current.id,
				value: currentField,
			},
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "conflict",
		};
	}
	const nextRevision = current.revision + 1;
	const restored = await reverseChange(tx, {
		actorId: input.command.actorId,
		commandKey: input.commandKey,
		current,
		entry,
		fingerprint: input.fingerprint,
		nextRevision,
	});
	return {
		receipt: {
			revision: nextRevision,
			targetId: current.id,
			value: restored,
		},
		status: "committed",
	};
}

function parseUndoCommand(
	command: unknown
):
	| { command: UndoCommand; status: "ok" }
	| { outcome: MutationOutcome; status: "rejected" } {
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
		typeof command.historyEntryId !== "string" ||
		command.historyEntryId.length === 0
	) {
		return {
			outcome: { reason: "missing-history-entry", status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = undoCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-base-revision", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
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

interface FixtureRow {
	fieldsText: string;
	id: string;
	retiredIntoId: string | null;
	revision: number;
	value: string;
}

interface HistoryRow {
	affectedFields: string;
	changeKind: string;
	fieldKey: string;
	id: string;
	mergeAttributed: string | null;
	mergeRetiredId: string | null;
	nextValue: string;
	previousValue: string;
	revisionAfter: number;
	targetId: string;
}

function readField(fields: Record<string, string>, key: string): string {
	const value = fields[key];
	if (typeof value !== "string") {
		return "";
	}
	return value;
}

function recordFields(row: {
	fieldsText: string;
	value: string;
}): Record<string, string> {
	return { ...parseStringRecord(row.fieldsText), value: row.value };
}

function persistFields(fields: Record<string, string>): {
	fieldsText: string;
	value: string;
} {
	const { value = "", ...extra } = fields;
	const compact: Record<string, string> = {};
	for (const [key, entry] of Object.entries(extra)) {
		if (entry !== "") {
			compact[key] = entry;
		}
	}
	return { fieldsText: JSON.stringify(compact), value };
}

function parseStringRecord(text: string): Record<string, string> {
	try {
		const parsed: unknown = JSON.parse(text);
		if (!isRecord(parsed)) {
			return {};
		}
		const record: Record<string, string> = {};
		for (const [key, entry] of Object.entries(parsed)) {
			if (typeof entry === "string") {
				record[key] = entry;
			}
		}
		return record;
	} catch {
		return {};
	}
}

function parseAffected(text: string): string[] {
	try {
		const parsed: unknown = JSON.parse(text);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter((item): item is string => typeof item === "string");
	} catch {
		return [];
	}
}

function kindOf(payload: MutationPayload): ChangeKind {
	return payload.kind ?? CHANGE_KIND.field;
}

function fieldKeyOf(payload: MutationPayload): string {
	if (kindOf(payload) === CHANGE_KIND.merge) {
		return CHANGE_KIND.merge;
	}
	if (kindOf(payload) === CHANGE_KIND.atomicTransform) {
		return CHANGE_KIND.atomicTransform;
	}
	return payload.field ?? "value";
}

async function applyChange(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		actorType: MutationActor;
		commandKey: string;
		current: FixtureRow;
		fingerprint: string;
		nextRevision: number;
		origin: MutationOrigin;
		payload: MutationPayload;
	}
): Promise<
	| { resultValue: string; status: "ok" }
	| { outcome: MutationOutcome; status: "rejected" }
> {
	const kind = kindOf(input.payload);
	const fieldKey = fieldKeyOf(input.payload);
	const historyId = crypto.randomUUID();
	if (kind === CHANGE_KIND.merge) {
		return applyMerge(tx, { ...input, fieldKey, historyId, kind });
	}
	if (kind === CHANGE_KIND.relation) {
		return applyRelation(tx, { ...input, fieldKey, historyId, kind });
	}
	if (kind === CHANGE_KIND.atomicTransform) {
		return applyAtomicTransform(tx, { ...input, fieldKey, historyId, kind });
	}
	const fields = recordFields(input.current);
	const previousValue = readField(fields, fieldKey);
	const nextValue = input.payload.value;
	fields[fieldKey] = nextValue;
	const persisted = persistFields(fields);
	await tx.mutationFixtureRecord.update({
		data: {
			fieldsText: persisted.fieldsText,
			revision: input.nextRevision,
			value: persisted.value,
		},
		where: { id: input.current.id },
	});
	await writeReceiptAndHistory(tx, {
		actorId: input.actorId,
		actorType: input.actorType,
		affectedFields: [fieldKey],
		changeKind: kind,
		commandKey: input.commandKey,
		fieldKey,
		fingerprint: input.fingerprint,
		historyId,
		nextRevision: input.nextRevision,
		nextValue,
		origin: input.origin,
		previousValue,
		resultValue: persisted.value,
		targetId: input.current.id,
	});
	return { resultValue: persisted.value, status: "ok" };
}

async function applyAtomicTransform(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		actorType: MutationActor;
		commandKey: string;
		current: FixtureRow;
		fieldKey: string;
		fingerprint: string;
		historyId: string;
		kind: ChangeKind;
		nextRevision: number;
		origin: MutationOrigin;
		payload: MutationPayload;
	}
): Promise<{ resultValue: string; status: "ok" }> {
	const fields = recordFields(input.current);
	const previous = {
		note: readField(fields, "note"),
		value: readField(fields, "value"),
	};
	const next = {
		note: input.payload.secondaryValue ?? "",
		value: input.payload.value,
	};
	fields.value = next.value;
	fields.note = next.note;
	const persisted = persistFields(fields);
	await tx.mutationFixtureRecord.update({
		data: {
			fieldsText: persisted.fieldsText,
			revision: input.nextRevision,
			value: persisted.value,
		},
		where: { id: input.current.id },
	});
	await writeReceiptAndHistory(tx, {
		actorId: input.actorId,
		actorType: input.actorType,
		affectedFields: ["note", "value"],
		changeKind: input.kind,
		commandKey: input.commandKey,
		fieldKey: input.fieldKey,
		fingerprint: input.fingerprint,
		historyId: input.historyId,
		nextRevision: input.nextRevision,
		nextValue: JSON.stringify(next),
		origin: input.origin,
		previousValue: JSON.stringify(previous),
		resultValue: persisted.value,
		targetId: input.current.id,
	});
	return { resultValue: persisted.value, status: "ok" };
}

async function applyRelation(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		actorType: MutationActor;
		commandKey: string;
		current: FixtureRow;
		fieldKey: string;
		fingerprint: string;
		historyId: string;
		kind: ChangeKind;
		nextRevision: number;
		origin: MutationOrigin;
		payload: MutationPayload;
	}
): Promise<{ resultValue: string; status: "ok" }> {
	const toId = input.payload.value;
	await tx.mutationFixtureRelation.create({
		data: {
			createdAt: new Date(),
			fromId: input.current.id,
			id: crypto.randomUUID(),
			kind: input.fieldKey,
			toId,
		},
	});
	await tx.mutationFixtureRecord.update({
		data: { revision: input.nextRevision },
		where: { id: input.current.id },
	});
	await writeReceiptAndHistory(tx, {
		actorId: input.actorId,
		actorType: input.actorType,
		affectedFields: [input.fieldKey],
		changeKind: input.kind,
		commandKey: input.commandKey,
		fieldKey: input.fieldKey,
		fingerprint: input.fingerprint,
		historyId: input.historyId,
		nextRevision: input.nextRevision,
		nextValue: toId,
		origin: input.origin,
		previousValue: "",
		resultValue: input.current.value,
		targetId: input.current.id,
	});
	return { resultValue: input.current.value, status: "ok" };
}

async function applyMerge(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		actorType: MutationActor;
		commandKey: string;
		current: FixtureRow;
		fieldKey: string;
		fingerprint: string;
		historyId: string;
		kind: ChangeKind;
		nextRevision: number;
		origin: MutationOrigin;
		payload: MutationPayload;
	}
): Promise<
	| { resultValue: string; status: "ok" }
	| { outcome: MutationOutcome; status: "rejected" }
> {
	const retiredId = input.payload.value;
	const retired = await tx.mutationFixtureRecord.findUnique({
		where: { id: retiredId },
	});
	if (!retired) {
		return {
			outcome: { reason: "target-not-found", status: "rejected" },
			status: "rejected",
		};
	}
	const [retiredLockA, retiredLockB] = advisoryKeys(
		`mutation-target:${retiredId}`
	);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${retiredLockA}, ${retiredLockB})`;
	const attributedFields = input.payload.attributedFields ?? {};
	const attributedRelationToIds = input.payload.attributedRelationToIds ?? [];
	const fields = recordFields(input.current);
	const previousSnapshot = { ...fields };
	for (const [key, value] of Object.entries(attributedFields)) {
		fields[key] = value;
	}
	const persisted = persistFields(fields);
	await tx.mutationFixtureRecord.update({
		data: {
			fieldsText: persisted.fieldsText,
			revision: input.nextRevision,
			value: persisted.value,
		},
		where: { id: input.current.id },
	});
	await tx.mutationFixtureRecord.update({
		data: { retiredIntoId: input.current.id },
		where: { id: retiredId },
	});
	await tx.mutationFixtureRelation.deleteMany({
		where: {
			fromId: retiredId,
			kind: "related",
			toId: { in: attributedRelationToIds },
		},
	});
	if (attributedRelationToIds.length > 0) {
		await tx.mutationFixtureRelation.createMany({
			data: attributedRelationToIds.map((toId) => ({
				createdAt: new Date(),
				fromId: input.current.id,
				id: crypto.randomUUID(),
				kind: "related",
				toId,
			})),
		});
	}
	const mergeAttributed = JSON.stringify({
		fields: attributedFields,
		relationToIds: attributedRelationToIds,
	});
	await writeReceiptAndHistory(tx, {
		actorId: input.actorId,
		actorType: input.actorType,
		affectedFields: Object.keys(attributedFields),
		changeKind: input.kind,
		commandKey: input.commandKey,
		fieldKey: input.fieldKey,
		fingerprint: input.fingerprint,
		historyId: input.historyId,
		mergeAttributed,
		mergeRetiredId: retiredId,
		nextRevision: input.nextRevision,
		nextValue: JSON.stringify(fields),
		origin: input.origin,
		previousValue: JSON.stringify(previousSnapshot),
		resultValue: persisted.value,
		targetId: input.current.id,
	});
	return { resultValue: persisted.value, status: "ok" };
}

async function writeReceiptAndHistory(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		actorType: MutationActor;
		affectedFields: string[];
		changeKind: ChangeKind;
		commandKey: string;
		fieldKey: string;
		fingerprint: string;
		historyId: string;
		mergeAttributed?: string;
		mergeRetiredId?: string;
		nextRevision: number;
		nextValue: string;
		origin: MutationOrigin;
		previousValue: string;
		resultValue: string;
		targetId: string;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: input.actorType,
			commandKey: input.commandKey,
			committedRevision: input.nextRevision,
			id: crypto.randomUUID(),
			origin: input.origin,
			payloadFingerprint: input.fingerprint,
			resultValue: input.resultValue,
			targetId: input.targetId,
		},
	});
	await tx.recordHistoryEntry.create({
		data: {
			actorId: input.actorId,
			actorType: input.actorType,
			affectedFields: JSON.stringify(input.affectedFields),
			changeKind: input.changeKind,
			fieldKey: input.fieldKey,
			id: input.historyId,
			mergeAttributed: input.mergeAttributed,
			mergeRetiredId: input.mergeRetiredId,
			nextValue: input.nextValue,
			occurredAt: new Date(),
			origin: input.origin,
			previousValue: input.previousValue,
			revisionAfter: input.nextRevision,
			targetId: input.targetId,
		},
	});
}

async function hasNewerSameFieldValue(
	tx: PrismaTransaction,
	entry: HistoryRow
): Promise<boolean> {
	const affected = parseAffected(entry.affectedFields);
	const later = await tx.recordHistoryEntry.findMany({
		where: {
			revisionAfter: { gt: entry.revisionAfter },
			targetId: entry.targetId,
		},
	});
	return later.some((row) =>
		parseAffected(row.affectedFields).some((field) => affected.includes(field))
	);
}

async function reverseChange(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		current: FixtureRow;
		entry: HistoryRow;
		fingerprint: string;
		nextRevision: number;
	}
): Promise<string> {
	if (input.entry.changeKind === CHANGE_KIND.merge) {
		return reverseMerge(tx, input);
	}
	if (input.entry.changeKind === CHANGE_KIND.relation) {
		await tx.mutationFixtureRelation.deleteMany({
			where: {
				fromId: input.current.id,
				kind: input.entry.fieldKey,
				toId: input.entry.nextValue,
			},
		});
		await tx.mutationFixtureRecord.update({
			data: { revision: input.nextRevision },
			where: { id: input.current.id },
		});
		await writeReceiptAndHistory(tx, {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			affectedFields: parseAffected(input.entry.affectedFields),
			changeKind: CHANGE_KIND.relation,
			commandKey: input.commandKey,
			fieldKey: input.entry.fieldKey,
			fingerprint: input.fingerprint,
			historyId: crypto.randomUUID(),
			nextRevision: input.nextRevision,
			nextValue: input.entry.previousValue,
			origin: HUMAN_ORIGIN,
			previousValue: input.entry.nextValue,
			resultValue: input.current.value,
			targetId: input.current.id,
		});
		return input.current.value;
	}
	if (input.entry.changeKind === CHANGE_KIND.atomicTransform) {
		const previous = parseStringRecord(input.entry.previousValue);
		const fields = recordFields(input.current);
		fields.value = readField(previous, "value");
		fields.note = readField(previous, "note");
		const persisted = persistFields(fields);
		await tx.mutationFixtureRecord.update({
			data: {
				fieldsText: persisted.fieldsText,
				revision: input.nextRevision,
				value: persisted.value,
			},
			where: { id: input.current.id },
		});
		await writeReceiptAndHistory(tx, {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			affectedFields: ["note", "value"],
			changeKind: CHANGE_KIND.atomicTransform,
			commandKey: input.commandKey,
			fieldKey: input.entry.fieldKey,
			fingerprint: input.fingerprint,
			historyId: crypto.randomUUID(),
			nextRevision: input.nextRevision,
			nextValue: input.entry.previousValue,
			origin: HUMAN_ORIGIN,
			previousValue: input.entry.nextValue,
			resultValue: persisted.value,
			targetId: input.current.id,
		});
		return persisted.value;
	}
	const fields = recordFields(input.current);
	const previousField = readField(fields, input.entry.fieldKey);
	fields[input.entry.fieldKey] = input.entry.previousValue;
	const persisted = persistFields(fields);
	await tx.mutationFixtureRecord.update({
		data: {
			fieldsText: persisted.fieldsText,
			revision: input.nextRevision,
			value: persisted.value,
		},
		where: { id: input.current.id },
	});
	await writeReceiptAndHistory(tx, {
		actorId: input.actorId,
		actorType: MUTATION_ACTOR.user,
		affectedFields: parseAffected(input.entry.affectedFields),
		changeKind: input.entry.changeKind as ChangeKind,
		commandKey: input.commandKey,
		fieldKey: input.entry.fieldKey,
		fingerprint: input.fingerprint,
		historyId: crypto.randomUUID(),
		nextRevision: input.nextRevision,
		nextValue: input.entry.previousValue,
		origin: HUMAN_ORIGIN,
		previousValue: previousField,
		resultValue: persisted.value,
		targetId: input.current.id,
	});
	return persisted.value;
}

async function reverseMerge(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		current: FixtureRow;
		entry: HistoryRow;
		fingerprint: string;
		nextRevision: number;
	}
): Promise<string> {
	const retiredId = input.entry.mergeRetiredId;
	if (!retiredId) {
		return input.current.value;
	}
	const [retiredLockA, retiredLockB] = advisoryKeys(
		`mutation-target:${retiredId}`
	);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${retiredLockA}, ${retiredLockB})`;
	const attributed = parseMergeAttributed(input.entry.mergeAttributed);
	const previous = parseStringRecord(input.entry.previousValue);
	const fields = recordFields(input.current);
	const retired = await tx.mutationFixtureRecord.findUnique({
		where: { id: retiredId },
	});
	const retiredFields = retired ? recordFields(retired) : { value: "" };
	for (const [key, value] of Object.entries(attributed.fields)) {
		fields[key] = readField(previous, key);
		retiredFields[key] = value;
	}
	const persisted = persistFields(fields);
	const retiredPersisted = persistFields(retiredFields);
	await tx.mutationFixtureRecord.update({
		data: {
			fieldsText: persisted.fieldsText,
			revision: input.nextRevision,
			value: persisted.value,
		},
		where: { id: input.current.id },
	});
	await tx.mutationFixtureRecord.update({
		data: {
			fieldsText: retiredPersisted.fieldsText,
			retiredIntoId: null,
			value: retiredPersisted.value,
		},
		where: { id: retiredId },
	});
	await tx.mutationFixtureRelation.deleteMany({
		where: {
			fromId: input.current.id,
			kind: "related",
			toId: { in: attributed.relationToIds },
		},
	});
	if (attributed.relationToIds.length > 0) {
		await tx.mutationFixtureRelation.createMany({
			data: attributed.relationToIds.map((toId) => ({
				createdAt: new Date(),
				fromId: retiredId,
				id: crypto.randomUUID(),
				kind: "related",
				toId,
			})),
		});
	}
	await writeReceiptAndHistory(tx, {
		actorId: input.actorId,
		actorType: MUTATION_ACTOR.user,
		affectedFields: Object.keys(attributed.fields),
		changeKind: CHANGE_KIND.merge,
		commandKey: input.commandKey,
		fieldKey: CHANGE_KIND.merge,
		fingerprint: input.fingerprint,
		historyId: crypto.randomUUID(),
		mergeAttributed: input.entry.mergeAttributed ?? undefined,
		mergeRetiredId: retiredId,
		nextRevision: input.nextRevision,
		nextValue: input.entry.previousValue,
		origin: HUMAN_ORIGIN,
		previousValue: input.entry.nextValue,
		resultValue: persisted.value,
		targetId: input.current.id,
	});
	return persisted.value;
}

function parseMergeAttributed(text: string | null): {
	fields: Record<string, string>;
	relationToIds: string[];
} {
	if (!text) {
		return { fields: {}, relationToIds: [] };
	}
	try {
		const parsed: unknown = JSON.parse(text);
		if (!isRecord(parsed)) {
			return { fields: {}, relationToIds: [] };
		}
		const fields =
			typeof parsed.fields === "object" && parsed.fields !== null
				? parseStringRecord(JSON.stringify(parsed.fields))
				: {};
		const relationToIds = Array.isArray(parsed.relationToIds)
			? parsed.relationToIds.filter(
					(item): item is string => typeof item === "string"
				)
			: [];
		return { fields, relationToIds };
	} catch {
		return { fields: {}, relationToIds: [] };
	}
}
