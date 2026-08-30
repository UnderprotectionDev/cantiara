import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	isRecord,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	type ApplyRecordActionCommand,
	applyRecordActionCommandSchema,
	type PreviewRecordActionOutcome,
	previewRecordActionInputSchema,
	RECORD_ACTION_COPY,
	RECORD_ACTION_POST_BARRIER_UI,
	type RecordActionFieldDiff,
	type RecordActionPreview,
	type RecordActionRejectionReason,
	type RecordActionRunOutcome,
	type RecordActionRunView,
	type RecordActionStep,
	recordActionRunViewSchema,
	recordActionStepSchema,
	type UndoRecordActionCommand,
	undoRecordActionCommandSchema,
} from "./record-actions-model";

type PrismaTransaction = Prisma.TransactionClient;

const MEMBER_VALUES = {
	member: RECORD_ACTION_COPY.dailyFocusMember,
	notMember: RECORD_ACTION_COPY.dailyFocusNotMember,
} as const;

export async function previewRecordAction(
	prisma: PrismaClient,
	input: unknown
): Promise<PreviewRecordActionOutcome> {
	const parsed = previewRecordActionInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (hasMultipleTargets(parsed.data)) {
		return { reason: "multi-target", status: "rejected" };
	}
	const loaded = await loadTarget(
		prisma,
		parsed.data.recordActionId,
		parsed.data.targetRecordId,
		parsed.data.actorId ?? ""
	);
	if (loaded.status !== "ok") {
		return loaded;
	}
	const closeReason = closedWithoutCloseStep(loaded.steps);
	if (closeReason) {
		return { reason: closeReason, status: "rejected" };
	}
	return { preview: toPreview(loaded), status: "ok" };
}

export async function applyRecordAction(
	prisma: PrismaClient,
	command: unknown
): Promise<RecordActionRunOutcome> {
	const parsed = parseApplyCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	if (parsed.command.payload.previewAcknowledged !== true) {
		return { reason: "explicit-start-required", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		applyInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function undoRecordAction(
	prisma: PrismaClient,
	command: unknown
): Promise<RecordActionRunOutcome> {
	const parsed = parseUndoCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		runId: parsed.command.payload.runId,
		undo: true,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		undoInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

async function applyInTransaction(
	tx: PrismaTransaction,
	command: ApplyRecordActionCommand,
	commandKey: string,
	fingerprint: string
): Promise<RecordActionRunOutcome> {
	if (hasMultipleTargets(command.payload)) {
		return { reason: "multi-target", status: "rejected" };
	}
	const first = await loadTarget(
		tx,
		command.payload.recordActionId,
		command.payload.targetRecordId,
		command.actorId
	);
	if (first.status !== "ok") {
		return first;
	}
	await lockWork(tx, first.work.id);
	const replayed = await replayRun(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const loaded = await loadTarget(
		tx,
		command.payload.recordActionId,
		command.payload.targetRecordId,
		command.actorId
	);
	if (loaded.status !== "ok") {
		return loaded;
	}
	if (loaded.work.revision !== command.baseRevision) {
		return {
			currentValueLabel: MUTATION_COPY.currentValue,
			revision: loaded.work.revision,
			status: "stale",
		};
	}
	const closeReason = closedWithoutCloseStep(loaded.steps);
	if (closeReason) {
		return { reason: closeReason, status: "rejected" };
	}
	const preview = toPreview(loaded);
	if (
		command.payload.previewFingerprint !== undefined &&
		command.payload.previewFingerprint !== preview.fingerprint
	) {
		return { reason: "preview-mismatch", status: "rejected" };
	}
	const nextRevision =
		preview.fields.length === 0
			? loaded.work.revision
			: loaded.work.revision + 1;
	await writeFields(tx, loaded, preview.fields, nextRevision);
	const runId = crypto.randomUUID();
	await tx.recordActionRun.create({
		data: {
			actorId: command.actorId,
			appliedJson: preview.fields,
			attributedJson: attributedFrom(preview.fields),
			id: runId,
			recordActionId: loaded.actionId,
			undoneAt: null,
			workId: loaded.work.id,
			workRevisionAfter: nextRevision,
		},
	});
	const run = toRunView({
		fields: preview.fields,
		id: runId,
		recordActionId: loaded.actionId,
		revision: nextRevision,
		targetRecordId: loaded.work.id,
		undo: preview.fields.length > 0 ? MUTATION_COPY.undo : null,
	});
	await writeRunReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		run,
	});
	return {
		run,
		status: "committed",
		ui: RECORD_ACTION_POST_BARRIER_UI,
	};
}

async function undoInTransaction(
	tx: PrismaTransaction,
	command: UndoRecordActionCommand,
	commandKey: string,
	fingerprint: string
): Promise<RecordActionRunOutcome> {
	const run = await tx.recordActionRun.findUnique({
		where: { id: command.payload.runId },
	});
	if (!run) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockWork(tx, run.workId);
	const replayed = await replayRun(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const work = await tx.work.findUnique({ where: { id: run.workId } });
	if (!work) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (work.revision !== command.baseRevision) {
		return {
			currentValueLabel: MUTATION_COPY.currentValue,
			revision: work.revision,
			status: "stale",
		};
	}
	if (run.undoneAt) {
		return {
			explanation: RECORD_ACTION_COPY.undoNotSafe,
			reason: "undo-not-safe",
			status: "rejected",
		};
	}
	const applied = parseFields(run.appliedJson);
	if (applied.length === 0) {
		return {
			explanation: RECORD_ACTION_COPY.undoNotSafe,
			reason: "undo-not-safe",
			status: "rejected",
		};
	}
	const member = await tx.dailyFocusMembership.findUnique({
		where: {
			accountId_workId: { accountId: run.actorId, workId: work.id },
		},
	});
	if (currentDiverged(work, member !== null, applied)) {
		return {
			explanation: RECORD_ACTION_COPY.laterWrite,
			reason: "later-write",
			status: "rejected",
		};
	}
	const inverse = inverseFields(applied);
	const nextRevision = work.revision + 1;
	await writeInverse(tx, work.id, run.actorId, inverse, nextRevision);
	await tx.recordActionRun.update({
		data: { undoneAt: new Date() },
		where: { id: run.id },
	});
	const view = toRunView({
		fields: inverse,
		id: run.id,
		recordActionId: run.recordActionId,
		revision: nextRevision,
		targetRecordId: work.id,
		undo: null,
	});
	await writeRunReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		run: view,
	});
	return {
		run: view,
		status: "committed",
		ui: RECORD_ACTION_POST_BARRIER_UI,
	};
}

async function loadTarget(
	db: PrismaClient | PrismaTransaction,
	recordActionId: string,
	targetRecordId: string,
	actorId: string
): Promise<
	| {
			actionId: string;
			actorId: string;
			member: boolean;
			status: "ok";
			steps: RecordActionStep[];
			work: {
				description: string | null;
				id: string;
				revision: number;
				status: string;
				title: string;
				type: string;
			};
	  }
	| { reason: RecordActionRejectionReason; status: "rejected" }
> {
	const action = await db.recordAction.findUnique({
		where: { id: recordActionId },
	});
	if (!action) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (action.trashedAt) {
		return { reason: "trashed-not-effective", status: "rejected" };
	}
	const work = await db.work.findUnique({ where: { id: targetRecordId } });
	if (!work || work.projectId !== action.projectId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const steps = parseSteps(action.steps);
	if (steps.length === 0) {
		return { reason: "empty-steps", status: "rejected" };
	}
	const membership =
		actorId.length === 0
			? null
			: await db.dailyFocusMembership.findUnique({
					where: {
						accountId_workId: { accountId: actorId, workId: work.id },
					},
				});
	return {
		actionId: action.id,
		actorId,
		member: membership !== null,
		status: "ok",
		steps,
		work: {
			description: work.description,
			id: work.id,
			revision: work.revision,
			status: work.status,
			title: work.title,
			type: work.type,
		},
	};
}

function toPreview(loaded: {
	actionId: string;
	member: boolean;
	steps: RecordActionStep[];
	work: {
		description: string | null;
		id: string;
		revision: number;
		status: string;
		title: string;
		type: string;
	};
}): RecordActionPreview {
	const fields = diffsFor(loaded.work, loaded.member, loaded.steps);
	return {
		actor: MUTATION_ACTOR.user,
		baseRevision: loaded.work.revision,
		copy: {
			apply: RECORD_ACTION_COPY.apply,
			finalizing: MUTATION_COPY.finalizing,
			preview: RECORD_ACTION_COPY.preview,
			start: RECORD_ACTION_COPY.start,
		},
		fields,
		fingerprint: payloadFingerprint(fields),
		recordActionId: loaded.actionId,
		targetRecordId: loaded.work.id,
	};
}

function diffsFor(
	work: {
		description: string | null;
		status: string;
		title: string;
		type: string;
	},
	member: boolean,
	steps: RecordActionStep[]
): RecordActionFieldDiff[] {
	return steps.flatMap((step) => diffForStep(work, member, step) ?? []);
}

function diffForStep(
	work: {
		description: string | null;
		status: string;
		title: string;
		type: string;
	},
	member: boolean,
	step: RecordActionStep
): RecordActionFieldDiff | null {
	if (step.kind === "setWorkStatus") {
		if (step.status === work.status) {
			return null;
		}
		return {
			from: work.status,
			id: "status",
			label: RECORD_ACTION_COPY.setWorkStatus,
			to: step.status,
		};
	}
	if (step.kind === "dailyFocusMembership") {
		const nextMember = step.operation === "add";
		if (nextMember === member) {
			return null;
		}
		return {
			from: member ? MEMBER_VALUES.member : MEMBER_VALUES.notMember,
			id: "dailyFocusMembership",
			label:
				step.operation === "add"
					? RECORD_ACTION_COPY.dailyFocusAdd
					: RECORD_ACTION_COPY.dailyFocusRemove,
			to: nextMember ? MEMBER_VALUES.member : MEMBER_VALUES.notMember,
		};
	}
	const current = currentField(work, step.fieldKey);
	if (current === step.value) {
		return null;
	}
	return {
		from: current,
		id: step.fieldKey,
		label: `${RECORD_ACTION_COPY.setExistingField}: ${step.fieldKey}`,
		to: step.value,
	};
}

function currentField(
	work: { description: string | null; title: string; type: string },
	fieldKey: "title" | "type" | "description"
): string | null {
	if (fieldKey === "title") {
		return work.title;
	}
	if (fieldKey === "type") {
		return work.type;
	}
	return work.description;
}

function closedWithoutCloseStep(
	steps: RecordActionStep[]
): RecordActionRejectionReason | null {
	for (const step of steps) {
		if (step.kind === "setWorkStatus" && step.status === WORK_STATUS.closed) {
			return "close-step-required";
		}
	}
	return null;
}

async function writeFields(
	tx: PrismaTransaction,
	loaded: {
		actorId: string;
		work: { id: string; status: string };
	},
	fields: RecordActionFieldDiff[],
	nextRevision: number
): Promise<void> {
	if (fields.length === 0) {
		return;
	}
	const data: {
		description?: string | null;
		revision: number;
		status?: string;
		title?: string;
		type?: string;
	} = { revision: nextRevision };
	for (const field of fields) {
		if (field.id === "status") {
			data.status = field.to;
		}
		if (field.id === "title") {
			data.title = field.to;
		}
		if (field.id === "type") {
			data.type = field.to;
		}
		if (field.id === "description") {
			data.description = field.to;
		}
	}
	await tx.work.update({ data, where: { id: loaded.work.id } });
	if (data.status) {
		await tx.workLifecycleEvent.create({
			data: {
				closureResult: null,
				id: crypto.randomUUID(),
				kind: "status",
				reason: null,
				status: data.status,
				workId: loaded.work.id,
			},
		});
	}
	const membership = fields.find(
		(field) => field.id === "dailyFocusMembership"
	);
	if (!membership) {
		return;
	}
	if (membership.to === MEMBER_VALUES.member) {
		await tx.dailyFocusMembership.create({
			data: {
				accountId: loaded.actorId,
				id: crypto.randomUUID(),
				workId: loaded.work.id,
			},
		});
		return;
	}
	await tx.dailyFocusMembership.deleteMany({
		where: { accountId: loaded.actorId, workId: loaded.work.id },
	});
}

async function writeInverse(
	tx: PrismaTransaction,
	workId: string,
	actorId: string,
	fields: RecordActionFieldDiff[],
	nextRevision: number
): Promise<void> {
	await writeFields(
		tx,
		{ actorId, work: { id: workId, status: "" } },
		fields,
		nextRevision
	);
}

function attributedFrom(
	fields: RecordActionFieldDiff[]
): Record<string, string | null> {
	const attributed: Record<string, string | null> = {};
	for (const field of fields) {
		attributed[field.id] = field.from;
	}
	return attributed;
}

function inverseFields(
	fields: RecordActionFieldDiff[]
): RecordActionFieldDiff[] {
	return fields.map((field) => ({
		from: field.to,
		id: field.id,
		label: field.label,
		to: field.from ?? "",
	}));
}

function currentDiverged(
	work: {
		description: string | null;
		status: string;
		title: string;
		type: string;
	},
	member: boolean,
	applied: RecordActionFieldDiff[]
): boolean {
	const current: Record<string, string | null> = {
		dailyFocusMembership: member
			? MEMBER_VALUES.member
			: MEMBER_VALUES.notMember,
		description: work.description,
		status: work.status,
		title: work.title,
		type: work.type,
	};
	return applied.some((field) => (current[field.id] ?? "") !== field.to);
}

function parseSteps(value: Prisma.JsonValue): RecordActionStep[] {
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

function parseFields(value: Prisma.JsonValue): RecordActionFieldDiff[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const fields: RecordActionFieldDiff[] = [];
	for (const item of value) {
		if (!isRecord(item)) {
			continue;
		}
		if (
			typeof item.id !== "string" ||
			typeof item.label !== "string" ||
			typeof item.to !== "string"
		) {
			continue;
		}
		fields.push({
			from: typeof item.from === "string" ? item.from : null,
			id: item.id,
			label: item.label,
			to: item.to,
		});
	}
	return fields;
}

function toRunView(input: {
	fields: RecordActionFieldDiff[];
	id: string;
	recordActionId: string;
	revision: number;
	targetRecordId: string;
	undo: "Undo" | null;
}): RecordActionRunView {
	return {
		actor: MUTATION_ACTOR.user,
		fields: input.fields,
		id: input.id,
		recordActionId: input.recordActionId,
		revision: input.revision,
		targetRecordId: input.targetRecordId,
		undo: input.undo,
	};
}

async function replayRun(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<RecordActionRunOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedRun(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return {
		run: stored,
		status: "replayed",
		ui: RECORD_ACTION_POST_BARRIER_UI,
	};
}

async function writeRunReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		run: RecordActionRunView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.run.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.run),
			targetId: input.run.id,
		},
	});
}

function storedRun(value: string): RecordActionRunView | null {
	try {
		return recordActionRunViewSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}

async function lockWork(tx: PrismaTransaction, workId: string): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`record-actions:work:${workId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

function hasMultipleTargets(input: {
	targetRecordIds?: readonly string[];
}): boolean {
	return (input.targetRecordIds?.length ?? 0) > 1;
}

function parseApplyCommand(
	command: unknown
):
	| { command: ApplyRecordActionCommand; status: "ok" }
	| { outcome: RecordActionRunOutcome; status: "rejected" } {
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
	if (typeof command.baseRevision !== "number") {
		return {
			outcome: { reason: "missing-base-revision", status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = applyRecordActionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

function parseUndoCommand(
	command: unknown
):
	| { command: UndoRecordActionCommand; status: "ok" }
	| { outcome: RecordActionRunOutcome; status: "rejected" } {
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
	if (typeof command.baseRevision !== "number") {
		return {
			outcome: { reason: "missing-base-revision", status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = undoRecordActionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "target-not-found", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}
