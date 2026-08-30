import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	isRecord,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	type CreateRecordActionCommand,
	createRecordActionCommandSchema,
	FORBIDDEN_RECORD_ACTION_INPUT_KINDS,
	FORBIDDEN_RECORD_ACTION_STEP_KINDS,
	RECORD_ACTION_TARGET_KIND,
	type RecordActionInput,
	type RecordActionOutcome,
	type RecordActionRejectionReason,
	type RecordActionStep,
	type RecordActionView,
	type ResolveRecordActionOutcome,
	recordActionInputSchema,
	recordActionStepSchema,
	recordActionViewSchema,
	resolveRecordActionInputSchema,
	type TrashRecordActionCommand,
	trashRecordActionCommandSchema,
} from "./record-actions-model";

type PrismaTransaction = Prisma.TransactionClient;

export async function defineRecordAction(
	prisma: PrismaClient,
	command: unknown
): Promise<RecordActionOutcome> {
	const parsed = parseCreateCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		createInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function trashRecordAction(
	prisma: PrismaClient,
	command: unknown
): Promise<RecordActionOutcome> {
	const parsed = parseTrashCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		trashInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function listRecordActions(
	prisma: PrismaClient,
	projectId: string
): Promise<RecordActionView[]> {
	const rows = await prisma.recordAction.findMany({
		orderBy: { createdAt: "asc" },
		where: { projectId, trashedAt: null },
	});
	return rows.map(toView);
}

export async function resolveRecordAction(
	prisma: PrismaClient,
	input: unknown
): Promise<ResolveRecordActionOutcome> {
	const parsed = resolveRecordActionInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (hasMultipleTargets(parsed.data)) {
		return { reason: "multi-target", status: "rejected" };
	}
	const row = await prisma.recordAction.findUnique({
		where: { id: parsed.data.recordActionId },
	});
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (row.trashedAt) {
		return { reason: "trashed-not-effective", status: "rejected" };
	}
	return {
		resolved: {
			actor: MUTATION_ACTOR.user,
			definition: toView(row),
			targetKind: RECORD_ACTION_TARGET_KIND,
			targetRecordId: parsed.data.targetRecordId,
		},
		status: "ok",
	};
}

function parseCreateCommand(
	command: unknown
):
	| { command: CreateRecordActionCommand; status: "ok" }
	| { outcome: RecordActionOutcome; status: "rejected" } {
	const envelope = parseEnvelope(command);
	if (envelope.status !== "ok") {
		return envelope;
	}
	const parsed = createRecordActionCommandSchema.safeParse(envelope.command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

function parseTrashCommand(
	command: unknown
):
	| { command: TrashRecordActionCommand; status: "ok" }
	| { outcome: RecordActionOutcome; status: "rejected" } {
	const envelope = parseEnvelope(command);
	if (envelope.status !== "ok") {
		return envelope;
	}
	const parsed = trashRecordActionCommandSchema.safeParse(envelope.command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

function parseEnvelope(
	command: unknown
):
	| { command: Record<string, unknown>; status: "ok" }
	| { outcome: RecordActionOutcome; status: "rejected" } {
	if (!isRecord(command)) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
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
	return { command, status: "ok" };
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateRecordActionCommand,
	commandKey: string,
	fingerprint: string
): Promise<RecordActionOutcome> {
	const project = await tx.project.findUnique({
		where: { id: command.payload.projectId },
	});
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const validated = await validateDefinitionPayload(tx, command.payload);
	if (validated.status !== "ok") {
		return validated.outcome;
	}
	await lockProject(tx, project.id);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const id = crypto.randomUUID();
	await tx.recordAction.create({
		data: {
			id,
			inputs: validated.inputs,
			name: validated.name,
			projectId: project.id,
			revision: 1,
			steps: validated.steps,
			targetKind: RECORD_ACTION_TARGET_KIND,
		},
	});
	const row = await tx.recordAction.findUnique({ where: { id } });
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const action = toView(row);
	await writeReceipt(tx, {
		action,
		actorId: command.actorId,
		commandKey,
		fingerprint,
	});
	return { action, status: "committed" };
}

async function trashInTransaction(
	tx: PrismaTransaction,
	command: TrashRecordActionCommand,
	commandKey: string,
	fingerprint: string
): Promise<RecordActionOutcome> {
	const existing = await tx.recordAction.findUnique({
		where: { id: command.payload.recordActionId },
	});
	if (!existing) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (existing.trashedAt) {
		return { reason: "trashed-not-effective", status: "rejected" };
	}
	await lockProject(tx, existing.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const now = new Date();
	await tx.recordAction.update({
		data: {
			revision: existing.revision + 1,
			trashedAt: now,
		},
		where: { id: existing.id },
	});
	const row = await tx.recordAction.findUnique({
		where: { id: existing.id },
	});
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const action = toView(row);
	await writeReceipt(tx, {
		action,
		actorId: command.actorId,
		commandKey,
		fingerprint,
	});
	return { action, status: "committed" };
}

async function validateDefinitionPayload(
	tx: PrismaTransaction,
	payload: CreateRecordActionCommand["payload"]
): Promise<
	| {
			inputs: RecordActionInput[];
			name: string;
			status: "ok";
			steps: RecordActionStep[];
	  }
	| { outcome: RecordActionOutcome; status: "rejected" }
> {
	if (hasMultipleTargets(payload)) {
		return {
			outcome: { reason: "multi-target", status: "rejected" },
			status: "rejected",
		};
	}
	const name = payload.name?.trim() ?? "";
	if (name.length === 0) {
		return {
			outcome: { reason: "missing-name", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		payload.targetKind !== undefined &&
		payload.targetKind !== RECORD_ACTION_TARGET_KIND
	) {
		return {
			outcome: { reason: "unknown-target-kind", status: "rejected" },
			status: "rejected",
		};
	}
	const stepReason = forbiddenOrUnknownSteps(payload.steps);
	if (stepReason) {
		return {
			outcome: { reason: stepReason, status: "rejected" },
			status: "rejected",
		};
	}
	const steps: RecordActionStep[] = [];
	for (const step of payload.steps ?? []) {
		const parsed = recordActionStepSchema.safeParse(step);
		if (!parsed.success) {
			return {
				outcome: { reason: "unknown-step", status: "rejected" },
				status: "rejected",
			};
		}
		steps.push(parsed.data);
	}
	if (steps.length === 0) {
		return {
			outcome: { reason: "empty-steps", status: "rejected" },
			status: "rejected",
		};
	}
	const inputReason = forbiddenOrUnknownInputs(payload.inputs);
	if (inputReason) {
		return {
			outcome: { reason: inputReason, status: "rejected" },
			status: "rejected",
		};
	}
	const inputs: RecordActionInput[] = [];
	const keys = new Set<string>();
	for (const input of payload.inputs ?? []) {
		const parsed = recordActionInputSchema.safeParse(input);
		if (!parsed.success) {
			return {
				outcome: { reason: "unknown-input", status: "rejected" },
				status: "rejected",
			};
		}
		if (keys.has(parsed.data.key)) {
			return {
				outcome: { reason: "unknown-input", status: "rejected" },
				status: "rejected",
			};
		}
		keys.add(parsed.data.key);
		// biome-ignore lint/performance/noAwaitInLoops: each input binds to an existing field before the next is accepted.
		const bound = await bindRuntimeInput(tx, payload.projectId, parsed.data);
		if (bound.status !== "ok") {
			return bound;
		}
		inputs.push(parsed.data);
	}
	return { inputs, name, status: "ok", steps };
}

async function bindRuntimeInput(
	tx: PrismaTransaction,
	projectId: string,
	input: RecordActionInput
): Promise<
	{ status: "ok" } | { outcome: RecordActionOutcome; status: "rejected" }
> {
	if (input.kind === "Relation") {
		return { status: "ok" };
	}
	const field = await tx.projectCustomFieldDefinition.findUnique({
		where: { id: input.fieldId },
	});
	if (!field || field.projectId !== projectId) {
		return {
			outcome: { reason: "unknown-input", status: "rejected" },
			status: "rejected",
		};
	}
	if (!field.boundRecordTypes.includes(RECORD_ACTION_TARGET_KIND)) {
		return {
			outcome: { reason: "unknown-input", status: "rejected" },
			status: "rejected",
		};
	}
	let expectedType = "Single select";
	if (input.kind === "Date") {
		expectedType = "Date";
	} else if (input.kind === "Number") {
		expectedType = "Number";
	}
	if (field.type !== expectedType) {
		return {
			outcome: { reason: "unknown-input", status: "rejected" },
			status: "rejected",
		};
	}
	return { status: "ok" };
}

function forbiddenOrUnknownInputs(
	inputs: unknown[] | undefined
): RecordActionRejectionReason | null {
	if (!inputs) {
		return null;
	}
	for (const input of inputs) {
		if (!isRecord(input) || typeof input.kind !== "string") {
			return "unknown-input";
		}
		if (
			(FORBIDDEN_RECORD_ACTION_INPUT_KINDS as readonly string[]).includes(
				input.kind
			)
		) {
			return "forbidden-input";
		}
	}
	return null;
}

function forbiddenOrUnknownSteps(
	steps: unknown[] | undefined
): RecordActionRejectionReason | null {
	if (!steps) {
		return null;
	}
	for (const step of steps) {
		if (!isRecord(step) || typeof step.kind !== "string") {
			return "unknown-step";
		}
		if (step.kind === "bulkEdit") {
			return "bulk-edit-not-allowed";
		}
		if (
			(FORBIDDEN_RECORD_ACTION_STEP_KINDS as readonly string[]).includes(
				step.kind
			)
		) {
			return "forbidden-step";
		}
	}
	return null;
}

function hasMultipleTargets(input: {
	targetRecordIds?: readonly string[];
}): boolean {
	return (input.targetRecordIds?.length ?? 0) > 1;
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<RecordActionOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.recordAction.findUnique({
		where: { id: existing.targetId },
	});
	if (live && !live.trashedAt) {
		return { action: toView(live), status: "replayed" };
	}
	const stored = storedAction(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { action: stored, status: "replayed" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		action: RecordActionView;
		commandKey: string;
		fingerprint: string;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.action.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.action),
			targetId: input.action.id,
		},
	});
}

function storedAction(value: string): RecordActionView | null {
	try {
		return recordActionViewSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`record-actions:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

function toView(row: {
	id: string;
	inputs?: Prisma.JsonValue;
	name: string;
	projectId: string;
	revision: number;
	steps: Prisma.JsonValue;
}): RecordActionView {
	const steps = zArraySteps(row.steps);
	return {
		actor: MUTATION_ACTOR.user,
		id: row.id,
		inputs: zArrayInputs(row.inputs ?? []),
		name: row.name,
		projectId: row.projectId,
		revision: row.revision,
		steps,
		targetKind: RECORD_ACTION_TARGET_KIND,
	};
}

function zArrayInputs(value: Prisma.JsonValue): RecordActionInput[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const inputs: RecordActionInput[] = [];
	for (const item of value) {
		const parsed = recordActionInputSchema.safeParse(item);
		if (parsed.success) {
			inputs.push(parsed.data);
		}
	}
	return inputs;
}

function zArraySteps(value: Prisma.JsonValue): RecordActionStep[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const steps: RecordActionStep[] = [];
	for (const item of value) {
		const parsed = recordActionStepSchema.safeParse(item);
		if (parsed.success) {
			steps.push(parsed.data);
		}
	}
	return steps;
}
