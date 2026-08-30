import type { PrismaClient } from "@cantiara/db";

import {
	HUMAN_ORIGIN,
	isRecord,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	changeWorkStatus,
	closeWork,
	getWork,
	previewClose,
	updateWorkTitle,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	type ClosePreview,
	WORK_STATUS,
} from "../../work-lifecycle/server/work-lifecycle-model";
import {
	BULK_EDITING_COPY,
	previewBulkEditInputSchema,
	previewBulkFieldChangeSchema,
	type StartBulkEditInput,
	startBulkEditInputSchema,
	undoBulkEditInputSchema,
} from "./bulk-editing-model";

const FORBIDDEN_CHANGE_KEYS = ["createField", "importRecords", "newField"];

export interface BulkFieldDiff {
	from: string | null;
	id: "status" | "title" | "closureResult";
	label: string;
	to: string;
}

export interface BulkEditPreviewRecord {
	fields: BulkFieldDiff[];
	key: string;
	revision: number;
	title: string;
	workId: string;
}

export type PreviewBulkEditOutcome =
	| {
			closePreview: ClosePreview | { reason: "target-not-found" };
			preview: {
				copy: typeof BULK_EDITING_COPY;
				records: BulkEditPreviewRecord[];
			};
			status: "ok";
	  }
	| {
			preview: {
				copy: typeof BULK_EDITING_COPY;
				records: BulkEditPreviewRecord[];
			};
			status: "ok";
	  }
	| {
			closePreview: ClosePreview | { reason: "target-not-found" };
			reason: "close-step-required";
			status: "rejected";
	  }
	| {
			reason:
				| "selection-required"
				| "schema-or-import-refused"
				| "target-not-found";
			status: "rejected";
	  };

export async function previewBulkEdit(
	prisma: PrismaClient,
	input: unknown
): Promise<PreviewBulkEditOutcome> {
	if (!isRecord(input)) {
		return { reason: "selection-required", status: "rejected" };
	}
	const selectedWorkIds = Array.isArray(input.selectedWorkIds)
		? input.selectedWorkIds.filter(
				(id): id is string => typeof id === "string" && id.length > 0
			)
		: [];
	if (selectedWorkIds.length === 0) {
		return { reason: "selection-required", status: "rejected" };
	}
	if (hasForbiddenChanges(input.changes)) {
		return { reason: "schema-or-import-refused", status: "rejected" };
	}
	const parsedChanges = previewBulkFieldChangeSchema.safeParse(
		input.changes ?? {}
	);
	if (!parsedChanges.success) {
		return { reason: "schema-or-import-refused", status: "rejected" };
	}
	const envelope = previewBulkEditInputSchema.safeParse({
		changes: parsedChanges.data,
		filterWorkIds: input.filterWorkIds,
		selectedWorkIds,
	});
	if (!envelope.success) {
		return { reason: "schema-or-import-refused", status: "rejected" };
	}
	const { changes } = envelope.data;
	if (
		changes.status === WORK_STATUS.closed &&
		changes.closureResult === undefined
	) {
		return {
			closePreview: await invokeCloseResult(prisma, selectedWorkIds),
			reason: "close-step-required",
			status: "rejected",
		};
	}
	const rows = await prisma.work.findMany({
		where: { id: { in: selectedWorkIds } },
	});
	if (rows.length !== selectedWorkIds.length) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const byId = new Map(rows.map((row) => [row.id, row]));
	const records: BulkEditPreviewRecord[] = [];
	for (const workId of selectedWorkIds) {
		const row = byId.get(workId);
		if (!row) {
			return { reason: "target-not-found", status: "rejected" };
		}
		records.push({
			fields: diffsFor(row, changes),
			key: row.key,
			revision: row.revision,
			title: row.title,
			workId: row.id,
		});
	}
	const preview = {
		copy: BULK_EDITING_COPY,
		records,
	};
	if (changes.status !== WORK_STATUS.closed) {
		return { preview, status: "ok" };
	}
	return {
		closePreview: await invokeCloseResult(prisma, selectedWorkIds),
		preview,
		status: "ok",
	};
}

async function invokeCloseResult(
	prisma: PrismaClient,
	selectedWorkIds: string[]
) {
	const previews = await Promise.all(
		selectedWorkIds.map((workId) => previewClose(prisma, { workId }))
	);
	return previews[0] ?? { reason: "target-not-found" as const };
}

function hasForbiddenChanges(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}
	return FORBIDDEN_CHANGE_KEYS.some((key) => key in value);
}

function diffsFor(
	row: { closureResult: string | null; status: string; title: string },
	changes: {
		closureResult?: string;
		status?: string;
		title?: string;
	}
): BulkFieldDiff[] {
	const fields: BulkFieldDiff[] = [];
	if (changes.status !== undefined && changes.status !== row.status) {
		fields.push({
			from: row.status,
			id: "status",
			label: BULK_EDITING_COPY.status,
			to: changes.status,
		});
	}
	if (
		changes.closureResult !== undefined &&
		changes.closureResult !== row.closureResult
	) {
		fields.push({
			from: row.closureResult,
			id: "closureResult",
			label: BULK_EDITING_COPY.closureResult,
			to: changes.closureResult,
		});
	}
	if (changes.title !== undefined && changes.title !== row.title) {
		fields.push({
			from: row.title,
			id: "title",
			label: BULK_EDITING_COPY.title,
			to: changes.title,
		});
	}
	return fields;
}

const STAGED = "staged";
const FINALIZING = "finalizing";
const COMMITTED = "committed";
const CANCELLED = "cancelled";
const STAGING_TTL_MS = 24 * 60 * 60 * 1000;
const JOB_KIND = "bulk-edit";

type BulkFieldId = "status" | "title" | "closureResult";

interface StoredUndoField {
	id: BulkFieldId;
	next: string;
	previous: string | null;
}

interface StoredBulkRecord {
	actor: typeof MUTATION_ACTOR.user;
	baseRevision: number;
	conflict?: typeof MUTATION_COPY.conflict;
	currentValueLabel?: typeof MUTATION_COPY.currentValue;
	historyEntryId?: string;
	idempotencyKey: string;
	key: string;
	result: "pending" | "succeeded" | "failed";
	supportReference?: string;
	title: string;
	undo: typeof MUTATION_COPY.undo | null;
	undoFields?: StoredUndoField[];
	workId: string;
}

interface StoredBulkJob {
	actorId: string;
	changes: {
		closureResult?: string;
		status?: string;
		title?: string;
	};
	kind: typeof JOB_KIND;
	records: StoredBulkRecord[];
}

export interface BulkEditJobView {
	actor: typeof MUTATION_ACTOR.user;
	copy: typeof BULK_EDITING_COPY;
	jobId: string;
	progress: { completed: number; total: number };
	records: StoredBulkRecord[];
	status:
		| typeof STAGED
		| typeof FINALIZING
		| typeof COMMITTED
		| typeof CANCELLED;
	ui: {
		cancelAvailable: boolean;
		label: typeof MUTATION_COPY.cancel | typeof MUTATION_COPY.finalizing;
	};
}

export type StartBulkEditOutcome =
	| { job: BulkEditJobView; status: "ok" }
	| {
			closePreview: ClosePreview | { reason: "target-not-found" };
			reason: "close-step-required";
			status: "rejected";
	  }
	| {
			reason:
				| "selection-required"
				| "schema-or-import-refused"
				| "target-not-found"
				| "operation-not-found";
			status: "rejected";
	  };

export type CancelBulkEditOutcome =
	| { job: BulkEditJobView; status: "cancelled" }
	| {
			status: "refused";
			ui: {
				cancelAvailable: false;
				label: typeof MUTATION_COPY.finalizing;
			};
	  }
	| { reason: "operation-not-found"; status: "rejected" };

export type UndoBulkEditOutcome =
	| {
			actor: typeof MUTATION_ACTOR.user;
			status: "committed";
			undo: typeof MUTATION_COPY.undo;
	  }
	| {
			conflict: typeof MUTATION_COPY.conflict;
			currentValueLabel: typeof MUTATION_COPY.currentValue;
			status: "conflict";
	  }
	| {
			reason: "history-not-found" | "operation-not-found" | "target-not-found";
			status: "rejected";
	  };

export async function startBulkEdit(
	prisma: PrismaClient,
	input: unknown
): Promise<StartBulkEditOutcome> {
	const prepared = await prepareStart(prisma, input);
	if (prepared.status !== "ok") {
		return prepared.outcome;
	}
	const commandKey = bulkCommandKey(
		prepared.command.actorId,
		prepared.command.idempotencyKey
	);
	const fingerprint = payloadFingerprint({
		changes: prepared.command.changes,
		records: prepared.command.records,
		selectedWorkIds: prepared.command.selectedWorkIds,
	});
	const existing = await prisma.mutationStagingOperation.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { reason: "schema-or-import-refused", status: "rejected" };
		}
		return { job: viewFor(existing), status: "ok" };
	}
	const now = new Date();
	const jobId = crypto.randomUUID();
	const stored: StoredBulkJob = {
		actorId: prepared.command.actorId,
		changes: prepared.command.changes,
		kind: JOB_KIND,
		records: prepared.works.map((work, index) => {
			const record = prepared.command.records[index];
			return {
				actor: MUTATION_ACTOR.user,
				baseRevision: record?.baseRevision ?? work.revision,
				idempotencyKey: record?.idempotencyKey ?? "",
				key: work.key,
				result: "pending",
				title: work.title,
				undo: null,
				workId: work.id,
			};
		}),
	};
	const created = await prisma.mutationStagingOperation.create({
		data: {
			actorId: prepared.command.actorId,
			baseRevision: 0,
			commandKey,
			expiresAt: new Date(now.getTime() + STAGING_TTL_MS),
			id: jobId,
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			payloadJson: JSON.stringify(stored),
			status: STAGED,
			targetId: prepared.command.selectedWorkIds[0] ?? jobId,
			targetScope: JOB_KIND,
		},
	});
	return { job: viewFor(created), status: "ok" };
}

export async function readBulkEdit(
	prisma: PrismaClient,
	jobId: string
): Promise<StartBulkEditOutcome> {
	const row = await prisma.mutationStagingOperation.findUnique({
		where: { id: jobId },
	});
	if (!row) {
		return { reason: "operation-not-found", status: "rejected" };
	}
	return { job: viewFor(row), status: "ok" };
}

export async function processBulkEdit(
	prisma: PrismaClient,
	jobId: string
): Promise<StartBulkEditOutcome> {
	const row = await prisma.mutationStagingOperation.findUnique({
		where: { id: jobId },
	});
	if (!row) {
		return { reason: "operation-not-found", status: "rejected" };
	}
	if (row.status === CANCELLED) {
		return { job: viewFor(row), status: "ok" };
	}
	const job = parseStored(row.payloadJson);
	if (!job) {
		return { reason: "operation-not-found", status: "rejected" };
	}
	if (row.status === STAGED) {
		await prisma.mutationStagingOperation.update({
			data: { status: FINALIZING },
			where: { id: jobId },
		});
	}
	await applyPendingRecords(job, prisma, jobId, 0);
	const completed = job.records.every((record) => record.result !== "pending");
	const updated = await prisma.mutationStagingOperation.update({
		data: {
			payloadJson: JSON.stringify(job),
			status: completed ? COMMITTED : FINALIZING,
		},
		where: { id: jobId },
	});
	return { job: viewFor(updated), status: "ok" };
}

export async function cancelBulkEdit(
	prisma: PrismaClient,
	jobId: string
): Promise<CancelBulkEditOutcome> {
	const row = await prisma.mutationStagingOperation.findUnique({
		where: { id: jobId },
	});
	if (!row) {
		return { reason: "operation-not-found", status: "rejected" };
	}
	if (row.status !== STAGED) {
		return {
			status: "refused",
			ui: {
				cancelAvailable: false,
				label: MUTATION_COPY.finalizing,
			},
		};
	}
	const updated = await prisma.mutationStagingOperation.update({
		data: { status: CANCELLED },
		where: { id: jobId },
	});
	return { job: viewFor(updated), status: "cancelled" };
}

export async function undoBulkEdit(
	prisma: PrismaClient,
	input: unknown
): Promise<UndoBulkEditOutcome> {
	const parsed = undoBulkEditInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "operation-not-found", status: "rejected" };
	}
	const row = await prisma.mutationStagingOperation.findUnique({
		where: { id: parsed.data.jobId },
	});
	if (!row) {
		return { reason: "operation-not-found", status: "rejected" };
	}
	const job = parseStored(row.payloadJson);
	if (!job) {
		return { reason: "history-not-found", status: "rejected" };
	}
	const record = job.records.find(
		(item) =>
			item.workId === parsed.data.workId &&
			item.historyEntryId === parsed.data.historyEntryId
	);
	const undoFields = record?.undoFields;
	if (!(record && undoFields && undoFields.length > 0)) {
		return { reason: "history-not-found", status: "rejected" };
	}
	const work = await getWork(prisma, record.workId);
	if (!work) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const laterSameField = undoFields.some(
		(field) => fieldValue(work, field.id) !== field.next
	);
	if (laterSameField) {
		return {
			conflict: MUTATION_COPY.conflict,
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "conflict",
		};
	}
	const { actorId, baseRevision, idempotencyKey } = parsed.data;
	return await reverseFields(
		prisma,
		{
			actorId,
			baseRevision,
			idempotencyKey,
			workId: record.workId,
		},
		undoFields,
		0
	);
}

async function prepareStart(
	prisma: PrismaClient,
	input: unknown
): Promise<
	| {
			command: StartBulkEditInput;
			status: "ok";
			works: Array<{
				id: string;
				key: string;
				revision: number;
				title: string;
			}>;
	  }
	| { outcome: StartBulkEditOutcome; status: "rejected" }
> {
	if (!isRecord(input)) {
		return {
			outcome: { reason: "selection-required", status: "rejected" },
			status: "rejected",
		};
	}
	if (hasForbiddenChanges(input.changes)) {
		return {
			outcome: { reason: "schema-or-import-refused", status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = startBulkEditInputSchema.safeParse(input);
	if (!parsed.success) {
		return {
			outcome: { reason: "selection-required", status: "rejected" },
			status: "rejected",
		};
	}
	const { selectedWorkIds } = parsed.data;
	if (
		selectedWorkIds.length === 0 ||
		parsed.data.records.length !== selectedWorkIds.length ||
		parsed.data.records.some(
			(record, index) => record.workId !== selectedWorkIds[index]
		)
	) {
		return {
			outcome: { reason: "selection-required", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		parsed.data.changes.status === WORK_STATUS.closed &&
		parsed.data.changes.closureResult === undefined
	) {
		return {
			outcome: {
				closePreview: await invokeCloseResult(prisma, selectedWorkIds),
				reason: "close-step-required",
				status: "rejected",
			},
			status: "rejected",
		};
	}
	const rows = await prisma.work.findMany({
		where: { id: { in: selectedWorkIds } },
	});
	if (rows.length !== selectedWorkIds.length) {
		return {
			outcome: { reason: "target-not-found", status: "rejected" },
			status: "rejected",
		};
	}
	const byId = new Map(rows.map((row) => [row.id, row]));
	const works = selectedWorkIds.flatMap((workId) => {
		const row = byId.get(workId);
		return row
			? [
					{
						id: row.id,
						key: row.key,
						revision: row.revision,
						title: row.title,
					},
				]
			: [];
	});
	if (works.length !== selectedWorkIds.length) {
		return {
			outcome: { reason: "target-not-found", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok", works };
}

async function applyPendingRecords(
	job: StoredBulkJob,
	prisma: PrismaClient,
	jobId: string,
	index: number
): Promise<void> {
	const record = job.records[index];
	if (!record) {
		return;
	}
	if (record.result === "pending") {
		await applyOneRecord(prisma, job, record);
		await prisma.mutationStagingOperation.update({
			data: { payloadJson: JSON.stringify(job), status: FINALIZING },
			where: { id: jobId },
		});
	}
	await applyPendingRecords(job, prisma, jobId, index + 1);
}

async function reverseFields(
	prisma: PrismaClient,
	input: {
		actorId: string;
		baseRevision: number;
		idempotencyKey: string;
		workId: string;
	},
	fields: StoredUndoField[],
	index: number
): Promise<UndoBulkEditOutcome> {
	const field = fields[index];
	if (!field) {
		return {
			actor: MUTATION_ACTOR.user,
			status: "committed",
			undo: MUTATION_COPY.undo,
		};
	}
	const reversed = await reverseField(prisma, {
		actorId: input.actorId,
		baseRevision: input.baseRevision,
		field,
		idempotencyKey: `${input.idempotencyKey}:${field.id}`,
		workId: input.workId,
	});
	if (reversed.status !== "ok") {
		return reversed.outcome;
	}
	return await reverseFields(
		prisma,
		{ ...input, baseRevision: reversed.revision },
		fields,
		index + 1
	);
}

async function applyOneRecord(
	prisma: PrismaClient,
	job: StoredBulkJob,
	record: StoredBulkRecord
): Promise<void> {
	const live = await getWork(prisma, record.workId);
	if (!live) {
		failRecord(record);
		return;
	}
	if (live.revision !== record.baseRevision) {
		failRecord(record);
		return;
	}
	const undoFields: StoredUndoField[] = [];
	let baseRevision = live.revision;
	if (job.changes.title !== undefined && job.changes.title !== live.title) {
		const outcome = await updateWorkTitle(prisma, {
			actorId: job.actorId,
			baseRevision,
			idempotencyKey: `${record.idempotencyKey}:title`,
			origin: HUMAN_ORIGIN,
			title: job.changes.title,
			workId: record.workId,
		});
		if (outcome.status !== "committed" && outcome.status !== "replayed") {
			failRecord(record);
			return;
		}
		undoFields.push({
			id: "title",
			next: job.changes.title,
			previous: live.title,
		});
		baseRevision = outcome.work.revision;
	}
	if (
		job.changes.status === WORK_STATUS.closed &&
		job.changes.closureResult !== undefined
	) {
		const outcome = await closeWork(prisma, {
			actorId: job.actorId,
			baseRevision,
			idempotencyKey: `${record.idempotencyKey}:close`,
			origin: HUMAN_ORIGIN,
			result: job.changes.closureResult,
			workId: record.workId,
		});
		if (outcome.status !== "committed" && outcome.status !== "replayed") {
			failRecord(record);
			return;
		}
		undoFields.push({
			id: "status",
			next: WORK_STATUS.closed,
			previous: live.status,
		});
		undoFields.push({
			id: "closureResult",
			next: job.changes.closureResult,
			previous: live.closureResult,
		});
	} else if (
		job.changes.status !== undefined &&
		job.changes.status !== live.status
	) {
		const outcome = await changeWorkStatus(prisma, {
			actorId: job.actorId,
			baseRevision,
			idempotencyKey: `${record.idempotencyKey}:status`,
			origin: HUMAN_ORIGIN,
			status: job.changes.status,
			workId: record.workId,
		});
		if (outcome.status !== "committed" && outcome.status !== "replayed") {
			failRecord(record);
			return;
		}
		undoFields.push({
			id: "status",
			next: job.changes.status,
			previous: live.status,
		});
	}
	record.historyEntryId = crypto.randomUUID();
	record.result = "succeeded";
	record.undo = MUTATION_COPY.undo;
	record.undoFields = undoFields;
}

function failRecord(record: StoredBulkRecord): void {
	record.result = "failed";
	record.undo = null;
	record.conflict = MUTATION_COPY.conflict;
	record.currentValueLabel = MUTATION_COPY.currentValue;
	record.supportReference = supportReference();
}

async function reverseField(
	prisma: PrismaClient,
	input: {
		actorId: string;
		baseRevision: number;
		field: StoredUndoField;
		idempotencyKey: string;
		workId: string;
	}
): Promise<
	| { outcome: UndoBulkEditOutcome; status: "rejected" }
	| { revision: number; status: "ok" }
> {
	if (input.field.id === "title") {
		if (!input.field.previous) {
			return {
				outcome: { reason: "history-not-found", status: "rejected" },
				status: "rejected",
			};
		}
		const outcome = await updateWorkTitle(prisma, {
			actorId: input.actorId,
			baseRevision: input.baseRevision,
			idempotencyKey: input.idempotencyKey,
			origin: HUMAN_ORIGIN,
			title: input.field.previous,
			workId: input.workId,
		});
		if (outcome.status !== "committed" && outcome.status !== "replayed") {
			return {
				outcome: {
					conflict: MUTATION_COPY.conflict,
					currentValueLabel: MUTATION_COPY.currentValue,
					status: "conflict",
				},
				status: "rejected",
			};
		}
		return { revision: outcome.work.revision, status: "ok" };
	}
	if (input.field.id === "status" && input.field.previous) {
		const outcome = await changeWorkStatus(prisma, {
			actorId: input.actorId,
			baseRevision: input.baseRevision,
			idempotencyKey: input.idempotencyKey,
			origin: HUMAN_ORIGIN,
			status: input.field.previous,
			workId: input.workId,
		});
		if (outcome.status !== "committed" && outcome.status !== "replayed") {
			return {
				outcome: {
					conflict: MUTATION_COPY.conflict,
					currentValueLabel: MUTATION_COPY.currentValue,
					status: "conflict",
				},
				status: "rejected",
			};
		}
		return { revision: outcome.work.revision, status: "ok" };
	}
	return {
		outcome: { reason: "history-not-found", status: "rejected" },
		status: "rejected",
	};
}

function fieldValue(
	work: { closureResult: string | null; status: string; title: string },
	id: BulkFieldId
): string | null {
	if (id === "title") {
		return work.title;
	}
	if (id === "status") {
		return work.status;
	}
	return work.closureResult;
}

function viewFor(row: {
	id: string;
	payloadJson: string;
	status: string;
}): BulkEditJobView {
	const job = parseStored(row.payloadJson);
	const records = job ? job.records : [];
	const completed = records.filter(
		(record) => record.result !== "pending"
	).length;
	const cancelAvailable = row.status === STAGED;
	const label =
		row.status === FINALIZING || row.status === COMMITTED
			? MUTATION_COPY.finalizing
			: MUTATION_COPY.cancel;
	return {
		actor: MUTATION_ACTOR.user,
		copy: BULK_EDITING_COPY,
		jobId: row.id,
		progress: { completed, total: records.length },
		records,
		status:
			row.status === STAGED ||
			row.status === FINALIZING ||
			row.status === COMMITTED ||
			row.status === CANCELLED
				? row.status
				: STAGED,
		ui: {
			cancelAvailable,
			label,
		},
	};
}

function parseStored(payloadJson: string): StoredBulkJob | null {
	try {
		const value = JSON.parse(payloadJson) as StoredBulkJob;
		if (value.kind !== JOB_KIND || !Array.isArray(value.records)) {
			return null;
		}
		return value;
	} catch {
		return null;
	}
}

function bulkCommandKey(actorId: string, idempotencyKey: string): string {
	return `bulk-edit:${actorId}:${idempotencyKey}`;
}

function supportReference(): string {
	const bytes = new Uint8Array(4);
	crypto.getRandomValues(bytes);
	return `CANT-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
		.join("")
		.toUpperCase()}`;
}
