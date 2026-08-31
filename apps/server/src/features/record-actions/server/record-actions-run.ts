import type { Prisma, PrismaClient } from "@cantiara/db";

import { accountProfileCalendarDay } from "../../daily-focus/server/daily-focus";
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
	CALENDAR_DATE_PATTERN,
	type PreviewRecordActionOutcome,
	previewRecordActionInputSchema,
	RECORD_ACTION_COPY,
	RECORD_ACTION_POST_BARRIER_UI,
	type RecordActionChosenInput,
	type RecordActionFieldDiff,
	type RecordActionInput,
	type RecordActionInputValue,
	type RecordActionPreview,
	type RecordActionRejectionReason,
	type RecordActionRunOutcome,
	type RecordActionRunView,
	type RecordActionStep,
	recordActionInputSchema,
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

type RuntimeDb = PrismaClient | PrismaTransaction;

function hasDelegate(
	db: RuntimeDb,
	name: "dailyFocusMembership" | "recordActionRun"
): boolean {
	const delegate = (db as unknown as Record<string, { findUnique?: unknown }>)[
		name
	];
	return typeof delegate?.findUnique === "function";
}

async function membershipDay(
	db: RuntimeDb,
	accountId: string
): Promise<string> {
	return await accountProfileCalendarDay(db, accountId, new Date());
}

async function findDailyFocusMembership(
	db: RuntimeDb,
	accountId: string,
	workId: string
): Promise<{ id: string } | null> {
	const calendarDay = await membershipDay(db, accountId);
	if (hasDelegate(db, "dailyFocusMembership")) {
		return await db.dailyFocusMembership.findUnique({
			where: {
				accountId_workId_calendarDay: { accountId, calendarDay, workId },
			},
		});
	}
	const rows = await db.$queryRaw<Array<{ id: string }>>`
		SELECT id FROM "daily_focus_membership"
		WHERE "accountId" = ${accountId} AND "workId" = ${workId} AND "calendarDay" = ${calendarDay}
		LIMIT 1
	`;
	return rows[0] ?? null;
}

async function insertDailyFocusMembership(
	db: RuntimeDb,
	input: { accountId: string; id: string; workId: string }
): Promise<void> {
	const calendarDay = await membershipDay(db, input.accountId);
	if (hasDelegate(db, "dailyFocusMembership")) {
		await db.dailyFocusMembership.create({
			data: { ...input, calendarDay },
		});
		return;
	}
	await db.$executeRaw`
		INSERT INTO "daily_focus_membership" (id, "accountId", "workId", "calendarDay", "createdAt", "updatedAt")
		VALUES (${input.id}, ${input.accountId}, ${input.workId}, ${calendarDay}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`;
}

async function deleteDailyFocusMembership(
	db: RuntimeDb,
	accountId: string,
	workId: string
): Promise<void> {
	const calendarDay = await membershipDay(db, accountId);
	if (hasDelegate(db, "dailyFocusMembership")) {
		await db.dailyFocusMembership.deleteMany({
			where: { accountId, calendarDay, workId },
		});
		return;
	}
	await db.$executeRaw`
		DELETE FROM "daily_focus_membership"
		WHERE "accountId" = ${accountId} AND "workId" = ${workId} AND "calendarDay" = ${calendarDay}
	`;
}

interface StoredRecordActionRun {
	actorId: string;
	appliedJson: Prisma.JsonValue;
	id: string;
	recordActionId: string;
	undoneAt: Date | null;
	workId: string;
}

async function createRecordActionRunRow(
	db: RuntimeDb,
	input: {
		actorId: string;
		appliedJson: RecordActionFieldDiff[];
		attributedJson: Record<string, string | null>;
		id: string;
		recordActionId: string;
		workId: string;
		workRevisionAfter: number;
	}
): Promise<void> {
	if (hasDelegate(db, "recordActionRun")) {
		await db.recordActionRun.create({
			data: {
				actorId: input.actorId,
				appliedJson: input.appliedJson,
				attributedJson: input.attributedJson,
				id: input.id,
				recordActionId: input.recordActionId,
				undoneAt: null,
				workId: input.workId,
				workRevisionAfter: input.workRevisionAfter,
			},
		});
		return;
	}
	const applied = JSON.stringify(input.appliedJson);
	const attributed = JSON.stringify(input.attributedJson);
	await db.$executeRaw`
		INSERT INTO "record_action_run" (
			id, "recordActionId", "workId", "actorId",
			"attributedJson", "appliedJson", "workRevisionAfter",
			"undoneAt", "createdAt", "updatedAt"
		)
		VALUES (
			${input.id}, ${input.recordActionId}, ${input.workId}, ${input.actorId},
			CAST(${attributed} AS JSONB), CAST(${applied} AS JSONB), ${input.workRevisionAfter},
			NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		)
	`;
}

async function findRecordActionRun(
	db: RuntimeDb,
	id: string
): Promise<StoredRecordActionRun | null> {
	if (hasDelegate(db, "recordActionRun")) {
		return await db.recordActionRun.findUnique({ where: { id } });
	}
	const rows = await db.$queryRaw<
		Array<{
			actorId: string;
			appliedJson: Prisma.JsonValue;
			id: string;
			recordActionId: string;
			undoneAt: Date | null;
			workId: string;
		}>
	>`
		SELECT id, "recordActionId", "workId", "actorId", "appliedJson", "undoneAt"
		FROM "record_action_run"
		WHERE id = ${id}
		LIMIT 1
	`;
	return rows[0] ?? null;
}

export async function recordActionIdForRun(
	db: PrismaClient,
	runId: string
): Promise<string | null> {
	const run = await findRecordActionRun(db, runId);
	return run?.recordActionId ?? null;
}

async function markRecordActionRunUndone(
	db: RuntimeDb,
	id: string
): Promise<void> {
	if (hasDelegate(db, "recordActionRun")) {
		await db.recordActionRun.update({
			data: { undoneAt: new Date() },
			where: { id },
		});
		return;
	}
	await db.$executeRaw`
		UPDATE "record_action_run"
		SET "undoneAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
		WHERE id = ${id}
	`;
}

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
	const previewed = await toPreview(
		prisma,
		loaded,
		parsed.data.inputValues ?? []
	);
	if (previewed.status !== "ok") {
		return previewed;
	}
	return { preview: previewed.preview, status: "ok" };
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
	const previewed = await toPreview(
		tx,
		loaded,
		command.payload.inputValues ?? []
	);
	if (previewed.status !== "ok") {
		return previewed;
	}
	const { preview } = previewed;
	if (command.payload.previewFingerprint !== preview.fingerprint) {
		return { reason: "preview-mismatch", status: "rejected" };
	}
	const nextRevision =
		preview.fields.length === 0
			? loaded.work.revision
			: loaded.work.revision + 1;
	await writeFields(tx, loaded, preview.fields, nextRevision);
	const runId = crypto.randomUUID();
	await createRecordActionRunRow(tx, {
		actorId: command.actorId,
		appliedJson: preview.fields,
		attributedJson: attributedFrom(preview.fields),
		id: runId,
		recordActionId: loaded.actionId,
		workId: loaded.work.id,
		workRevisionAfter: nextRevision,
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
	const run = await findRecordActionRun(tx, command.payload.runId);
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
	const member = await findDailyFocusMembership(tx, run.actorId, work.id);
	if (await currentDiverged(tx, work, member !== null, applied)) {
		return {
			explanation: RECORD_ACTION_COPY.laterWrite,
			reason: "later-write",
			status: "rejected",
		};
	}
	const inverse = inverseFields(applied);
	const nextRevision = work.revision + 1;
	await writeInverse(
		tx,
		work.id,
		work.projectId,
		run.actorId,
		inverse,
		nextRevision
	);
	await markRecordActionRunUndone(tx, run.id);
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
	LoadedTarget | { reason: RecordActionRejectionReason; status: "rejected" }
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
	const inputs = parseInputs(
		"inputs" in action ? (action.inputs as Prisma.JsonValue) : []
	);
	const membership =
		actorId.length === 0
			? null
			: await findDailyFocusMembership(db, actorId, work.id);
	const customFields = await loadCustomFieldState(db, inputs, work.id);
	const relatedIds = await loadRelatedWorkIds(db, work.id);
	return {
		actionId: action.id,
		actorId,
		customFields,
		inputs,
		member: membership !== null,
		projectId: work.projectId,
		relatedIds,
		status: "ok",
		steps,
		work: {
			description: work.description,
			id: work.id,
			key: work.key,
			revision: work.revision,
			status: work.status,
			title: work.title,
			type: work.type,
		},
	};
}

interface LoadedTarget {
	actionId: string;
	actorId: string;
	customFields: Record<
		string,
		{ current: string | null; options: string[]; type: string }
	>;
	inputs: RecordActionInput[];
	member: boolean;
	projectId: string;
	relatedIds: string[];
	status: "ok";
	steps: RecordActionStep[];
	work: {
		description: string | null;
		id: string;
		key: string;
		revision: number;
		status: string;
		title: string;
		type: string;
	};
}

async function toPreview(
	db: RuntimeDb,
	loaded: LoadedTarget,
	inputValues: readonly RecordActionInputValue[]
): Promise<
	| { preview: RecordActionPreview; status: "ok" }
	| { reason: RecordActionRejectionReason; status: "rejected" }
> {
	const chosen = chosenInputs(loaded.inputs, inputValues);
	if (chosen.status !== "ok") {
		return chosen;
	}
	const inputFields = await diffsForInputs(db, loaded, chosen.inputs);
	if (inputFields.status !== "ok") {
		return inputFields;
	}
	const fields = [
		...diffsFor(loaded.work, loaded.member, loaded.steps),
		...inputFields.fields,
	];
	return {
		preview: {
			actor: MUTATION_ACTOR.user,
			baseRevision: loaded.work.revision,
			copy: {
				apply: RECORD_ACTION_COPY.apply,
				finalizing: MUTATION_COPY.finalizing,
				preview: RECORD_ACTION_COPY.preview,
				start: RECORD_ACTION_COPY.start,
			},
			fields,
			fingerprint: payloadFingerprint({ chosen: chosen.inputs, fields }),
			inputs: chosen.inputs,
			recordActionId: loaded.actionId,
			targetRecordId: loaded.work.id,
		},
		status: "ok",
	};
}

function chosenInputs(
	declared: readonly RecordActionInput[],
	values: readonly RecordActionInputValue[]
):
	| { inputs: RecordActionChosenInput[]; status: "ok" }
	| { reason: RecordActionRejectionReason; status: "rejected" } {
	const byKey = new Map(values.map((item) => [item.key, item.value.trim()]));
	const inputs: RecordActionChosenInput[] = [];
	for (const input of declared) {
		const value = byKey.get(input.key) ?? "";
		if (value.length === 0) {
			return { reason: "missing-runtime-input", status: "rejected" };
		}
		inputs.push({
			key: input.key,
			kind: input.kind,
			label: input.label,
			value,
		});
	}
	return { inputs, status: "ok" };
}

async function diffsForInputs(
	db: RuntimeDb,
	loaded: LoadedTarget,
	chosen: readonly RecordActionChosenInput[]
): Promise<
	| { fields: RecordActionFieldDiff[]; status: "ok" }
	| { reason: RecordActionRejectionReason; status: "rejected" }
> {
	const fields: RecordActionFieldDiff[] = [];
	for (const value of chosen) {
		const declared = loaded.inputs.find((input) => input.key === value.key);
		if (!declared) {
			return { reason: "unknown-input", status: "rejected" };
		}
		// biome-ignore lint/performance/noAwaitInLoops: each input can reject before later fields are written.
		const diff = await diffForInput(db, loaded, declared, value.value);
		if (diff.status !== "ok") {
			return diff;
		}
		if (diff.field) {
			fields.push(diff.field);
		}
	}
	return { fields, status: "ok" };
}

async function diffForInput(
	db: RuntimeDb,
	loaded: LoadedTarget,
	declared: RecordActionInput,
	value: string
): Promise<
	| { field: RecordActionFieldDiff | null; status: "ok" }
	| { reason: RecordActionRejectionReason; status: "rejected" }
> {
	if (declared.kind === "Relation") {
		if (value === loaded.work.id) {
			return { reason: "related-record-required", status: "rejected" };
		}
		const related = await db.work.findUnique({ where: { id: value } });
		if (!related || related.projectId !== loaded.projectId) {
			return { reason: "related-record-required", status: "rejected" };
		}
		if (loaded.relatedIds.includes(value)) {
			return { field: null, status: "ok" };
		}
		return {
			field: {
				from: null,
				id: relationFieldId(declared.key),
				label: RECORD_ACTION_COPY.relation,
				to: value,
			},
			status: "ok",
		};
	}
	if (declared.kind === "Date" && !CALENDAR_DATE_PATTERN.test(value)) {
		return { reason: "unknown-input", status: "rejected" };
	}
	if (declared.kind === "Number" && !Number.isFinite(Number(value))) {
		return { reason: "unknown-input", status: "rejected" };
	}
	const field = loaded.customFields[declared.fieldId];
	if (!field) {
		return { reason: "unknown-input", status: "rejected" };
	}
	if (declared.kind === "Select" && !field.options.includes(value)) {
		return { reason: "unknown-input", status: "rejected" };
	}
	const next = declared.kind === "Number" ? String(Number(value)) : value;
	if (field.current === next) {
		return { field: null, status: "ok" };
	}
	return {
		field: {
			from: field.current,
			id: customFieldId(declared.fieldId),
			label: declared.label,
			to: next,
		},
		status: "ok",
	};
}

function customFieldId(fieldId: string): string {
	return `customField:${fieldId}`;
}

function relationFieldId(key: string): string {
	return `relation:${key}`;
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
		projectId: string;
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
	if (membership) {
		if (membership.to === MEMBER_VALUES.member) {
			await insertDailyFocusMembership(tx, {
				accountId: loaded.actorId,
				id: crypto.randomUUID(),
				workId: loaded.work.id,
			});
		} else {
			await deleteDailyFocusMembership(tx, loaded.actorId, loaded.work.id);
		}
	}
	for (const field of fields) {
		if (field.id.startsWith("customField:")) {
			// biome-ignore lint/performance/noAwaitInLoops: catalog writes stay in one transaction order.
			await writeCustomFieldValue(
				tx,
				field.id.slice("customField:".length),
				loaded.work.id,
				field.to
			);
		}
		if (field.id.startsWith("relation:")) {
			await writeRelatedWork(
				tx,
				loaded.work.id,
				loaded.projectId,
				field.to,
				field.from
			);
		}
	}
}

async function writeInverse(
	tx: PrismaTransaction,
	workId: string,
	projectId: string,
	actorId: string,
	fields: RecordActionFieldDiff[],
	nextRevision: number
): Promise<void> {
	await writeFields(
		tx,
		{ actorId, projectId, work: { id: workId, status: "" } },
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

async function currentDiverged(
	db: RuntimeDb,
	work: {
		description: string | null;
		id: string;
		status: string;
		title: string;
		type: string;
	},
	member: boolean,
	applied: RecordActionFieldDiff[]
): Promise<boolean> {
	const current: Record<string, string | null> = {
		dailyFocusMembership: member
			? MEMBER_VALUES.member
			: MEMBER_VALUES.notMember,
		description: work.description,
		status: work.status,
		title: work.title,
		type: work.type,
	};
	const relatedIds = await loadRelatedWorkIds(db, work.id);
	for (const field of applied) {
		if (field.id.startsWith("customField:")) {
			const definitionId = field.id.slice("customField:".length);
			// biome-ignore lint/performance/noAwaitInLoops: later-write checks stop at the first divergence.
			const row = await db.projectCustomFieldValue.findUnique({
				where: {
					definitionId_recordType_recordId: {
						definitionId,
						recordId: work.id,
						recordType: "Work",
					},
				},
			});
			if ((displayCustomValue(row?.value ?? null) ?? "") !== field.to) {
				return true;
			}
			continue;
		}
		if (field.id.startsWith("relation:")) {
			if (!relatedIds.includes(field.to)) {
				return true;
			}
			continue;
		}
		if ((current[field.id] ?? "") !== field.to) {
			return true;
		}
	}
	return false;
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

function parseInputs(value: Prisma.JsonValue): RecordActionInput[] {
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

async function loadCustomFieldState(
	db: RuntimeDb,
	inputs: readonly RecordActionInput[],
	workId: string
): Promise<
	Record<string, { current: string | null; options: string[]; type: string }>
> {
	const result: Record<
		string,
		{ current: string | null; options: string[]; type: string }
	> = {};
	for (const input of inputs) {
		if (input.kind === "Relation") {
			continue;
		}
		// biome-ignore lint/performance/noAwaitInLoops: definitions are loaded only for declared inputs.
		const definition = await db.projectCustomFieldDefinition.findUnique({
			where: { id: input.fieldId },
		});
		if (!definition) {
			continue;
		}
		const row = await db.projectCustomFieldValue.findUnique({
			where: {
				definitionId_recordType_recordId: {
					definitionId: definition.id,
					recordId: workId,
					recordType: "Work",
				},
			},
		});
		result[definition.id] = {
			current: displayCustomValue(row?.value ?? null),
			options: definition.options,
			type: definition.type,
		};
	}
	return result;
}

async function loadRelatedWorkIds(
	db: RuntimeDb,
	workId: string
): Promise<string[]> {
	const rows = await db.typedRelation.findMany({
		where: {
			fromId: workId,
			fromKind: "Work",
			toKind: "Work",
			type: "Related",
		},
	});
	return rows.map((row) => row.toId);
}

function displayCustomValue(value: Prisma.JsonValue | null): string | null {
	if (!isRecord(value) || typeof value.kind !== "string") {
		return null;
	}
	if (value.kind === "unset") {
		return null;
	}
	if (value.kind === "date" && typeof value.date === "string") {
		return value.date;
	}
	if (value.kind === "number" && typeof value.number === "number") {
		return String(value.number);
	}
	if (value.kind === "single-select" && typeof value.option === "string") {
		return value.option;
	}
	return null;
}

async function writeCustomFieldValue(
	tx: PrismaTransaction,
	definitionId: string,
	workId: string,
	to: string
): Promise<void> {
	const definition = await tx.projectCustomFieldDefinition.findUnique({
		where: { id: definitionId },
	});
	if (!definition) {
		return;
	}
	let stored: Prisma.InputJsonValue = { kind: "unset" };
	if (to.length > 0 && definition.type === "Date") {
		stored = { date: to, kind: "date" };
	} else if (to.length > 0 && definition.type === "Number") {
		stored = { kind: "number", number: Number(to) };
	} else if (to.length > 0) {
		stored = { kind: "single-select", option: to };
	}
	const existing = await tx.projectCustomFieldValue.findUnique({
		where: {
			definitionId_recordType_recordId: {
				definitionId,
				recordId: workId,
				recordType: "Work",
			},
		},
	});
	if (existing) {
		await tx.projectCustomFieldValue.update({
			data: {
				revision: existing.revision + 1,
				value: stored,
			},
			where: { id: existing.id },
		});
		return;
	}
	await tx.projectCustomFieldValue.create({
		data: {
			definitionId,
			id: crypto.randomUUID(),
			recordId: workId,
			recordType: "Work",
			revision: 1,
			value: stored,
		},
	});
}

async function writeRelatedWork(
	tx: PrismaTransaction,
	fromId: string,
	projectId: string,
	toId: string,
	previousId: string | null
): Promise<void> {
	if (previousId && previousId.length > 0 && previousId !== toId) {
		await tx.typedRelation.deleteMany({
			where: {
				fromId,
				fromKind: "Work",
				toId: previousId,
				toKind: "Work",
				type: "Related",
			},
		});
	}
	if (toId.length === 0) {
		return;
	}
	const related = await tx.work.findUnique({ where: { id: toId } });
	if (!related || related.projectId !== projectId) {
		return;
	}
	const existing = await tx.typedRelation.findFirst({
		where: {
			fromId,
			fromKind: "Work",
			toId,
			toKind: "Work",
			type: "Related",
		},
	});
	if (existing) {
		return;
	}
	await tx.typedRelation.create({
		data: {
			fromId,
			fromKind: "Work",
			id: crypto.randomUUID(),
			originComponentMissing: false,
			revision: 1,
			toId,
			toKind: "Work",
			type: "Related",
		},
	});
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
