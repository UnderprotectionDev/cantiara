import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	isRecord,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { markProjectHasWork } from "../../project-shell/server/project-shell";
import {
	type ChangeWorkTypeCommand,
	type CreateWorkCommand,
	changeWorkTypeCommandSchema,
	createWorkCommandSchema,
	DEFAULT_WORK_TYPE,
	isWorkType,
	optionalText,
	type TypeChangeImpact,
	typeChangeImpact,
	type UpdateWorkTitleCommand,
	updateWorkTitleCommandSchema,
	WORK_STATUS,
	type WorkCreateSource,
	type WorkLifecycleOutcome,
	type WorkType,
	type WorkView,
	workKey,
	workViewSchema,
} from "./work-lifecycle-model";

type PrismaTransaction = Prisma.TransactionClient;

interface WorkRow {
	id: string;
	key: string;
	number: number;
	projectId: string;
	revision: number;
	status: string;
	title: string;
	type: string;
}

export async function createWork(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
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

export async function finalizeDraft(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	return await createWork(prisma, withSource(command, "draft-finalize"));
}

export async function convertCaptureToWork(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	return await createWork(prisma, withSource(command, "capture-convert"));
}

export async function updateWorkTitle(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parseTitleCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({ title: parsed.command.title });
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		updateTitleInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function changeWorkType(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parseTypeCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		previewAcknowledged: parsed.command.previewAcknowledged ?? false,
		type: parsed.command.type,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		changeTypeInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function previewWorkTypeChange(
	prisma: PrismaClient,
	workId: string,
	type: string
): Promise<
	TypeChangeImpact | { reason: "target-not-found" | "unknown-work-type" }
> {
	if (!isWorkType(type)) {
		return { reason: "unknown-work-type" };
	}
	const work = await prisma.work.findUnique({ where: { id: workId } });
	if (!(work && isWorkType(work.type))) {
		return { reason: "target-not-found" };
	}
	return typeChangeImpact(work.type, type);
}

export async function getWork(
	prisma: PrismaClient,
	workId: string
): Promise<WorkView | null> {
	const row = await prisma.work.findUnique({ where: { id: workId } });
	return row ? toView(row) : null;
}

export async function listWork(
	prisma: PrismaClient,
	projectId: string
): Promise<WorkView[]> {
	const rows = await prisma.work.findMany({
		orderBy: { number: "asc" },
		where: { projectId },
	});
	return rows.map(toView);
}

export async function permanentlyDeleteWork(
	prisma: PrismaClient,
	workId: string
): Promise<void> {
	await prisma.work.deleteMany({ where: { id: workId } });
}

function withSource(command: unknown, source: WorkCreateSource): unknown {
	if (!(isRecord(command) && isRecord(command.payload))) {
		return command;
	}
	return {
		...command,
		payload: {
			...command.payload,
			source,
		},
	};
}

function parseCreateCommand(
	command: unknown
):
	| { command: CreateWorkCommand; status: "ok" }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
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
	const parsed = createWorkCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

function parseTitleCommand(
	command: unknown
):
	| { command: UpdateWorkTitleCommand; status: "ok" }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
	return parseKeyedCommand(command, updateWorkTitleCommandSchema);
}

function parseTypeCommand(
	command: unknown
):
	| { command: ChangeWorkTypeCommand; status: "ok" }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
	return parseKeyedCommand(command, changeWorkTypeCommandSchema);
}

function parseKeyedCommand<T>(
	command: unknown,
	schema: {
		safeParse: (
			value: unknown
		) => { data: T; success: true } | { success: false };
	}
):
	| { command: T; status: "ok" }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
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
	const parsed = schema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateWorkCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const project = await tx.project.findUnique({
		select: { id: true, shortCode: true },
		where: { id: command.payload.projectId },
	});
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, project.id);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const lockedProject = await tx.project.findUnique({
		select: { id: true, shortCode: true },
		where: { id: project.id },
	});
	if (!lockedProject) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const title = optionalText(command.payload.title);
	if (!title) {
		return { reason: "missing-title", status: "rejected" };
	}
	const type = resolveType(command.payload.type);
	if (type.status !== "ok") {
		return type.outcome;
	}
	const number = await allocateNumber(tx, lockedProject.id);
	const workId = crypto.randomUUID();
	await tx.work.create({
		data: {
			id: workId,
			key: workKey(lockedProject.shortCode, number),
			number,
			projectId: lockedProject.id,
			revision: 1,
			status: WORK_STATUS.notStarted,
			title,
			type: type.value,
		},
	});
	await markProjectHasWork(tx, lockedProject.id);
	const row = await loadWork(tx, workId);
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const work = toView(row);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		work,
	});
	return { status: "committed", work };
}

async function updateTitleInTransaction(
	tx: PrismaTransaction,
	command: UpdateWorkTitleCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const current = await tx.work.findUnique({ where: { id: command.workId } });
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await loadWork(tx, current.id);
	if (!locked) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return {
			current: toView(locked),
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	const title = optionalText(command.title);
	if (!title) {
		return { reason: "missing-title", status: "rejected" };
	}
	await tx.work.update({
		data: {
			revision: locked.revision + 1,
			title,
		},
		where: { id: locked.id },
	});
	const updated = await loadWork(tx, locked.id);
	if (!updated) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const work = toView(updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		work,
	});
	return { status: "committed", work };
}

async function changeTypeInTransaction(
	tx: PrismaTransaction,
	command: ChangeWorkTypeCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const current = await tx.work.findUnique({ where: { id: command.workId } });
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await loadWork(tx, current.id);
	if (!(locked && isWorkType(locked.type))) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return {
			current: toView(locked),
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	if (!isWorkType(command.type)) {
		return { reason: "unknown-work-type", status: "rejected" };
	}
	if (command.type === locked.type) {
		const work = toView(locked);
		await writeReceipt(tx, {
			actorId: command.actorId,
			commandKey,
			fingerprint,
			work,
		});
		return { status: "committed", work };
	}
	const impact = typeChangeImpact(locked.type, command.type);
	if (impact.requiresPreview && command.previewAcknowledged !== true) {
		return { reason: "feature-impact-preview-required", status: "rejected" };
	}
	if (impact.blocked) {
		return { reason: "feature-exit-blocked", status: "rejected" };
	}
	await tx.work.update({
		data: {
			revision: locked.revision + 1,
			type: command.type,
		},
		where: { id: locked.id },
	});
	const updated = await loadWork(tx, locked.id);
	if (!updated) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const work = toView(updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		work,
	});
	return { status: "committed", work };
}

function resolveType(
	value: string | undefined
):
	| { status: "ok"; value: WorkType }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
	if (value === undefined || value.trim().length === 0) {
		return { status: "ok", value: DEFAULT_WORK_TYPE };
	}
	if (!isWorkType(value)) {
		return {
			outcome: { reason: "unknown-work-type", status: "rejected" },
			status: "rejected",
		};
	}
	return { status: "ok", value };
}

async function allocateNumber(
	tx: PrismaTransaction,
	projectId: string
): Promise<number> {
	const existing = await tx.projectWorkKeyCounter.findUnique({
		where: { projectId },
	});
	if (!existing) {
		await tx.projectWorkKeyCounter.create({
			data: { nextNumber: 2, projectId },
		});
		return 1;
	}
	const number = existing.nextNumber;
	await tx.projectWorkKeyCounter.update({
		data: { nextNumber: number + 1 },
		where: { projectId },
	});
	return number;
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await loadWork(tx, existing.targetId);
	if (live) {
		return { status: "replayed", work: toView(live) };
	}
	const stored = storedWork(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { status: "replayed", work: stored };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		work: WorkView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.work.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.work),
			targetId: input.work.id,
		},
	});
}

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`project-shell:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

async function loadWork(
	db: PrismaClient | PrismaTransaction,
	workId: string
): Promise<WorkRow | null> {
	return await db.work.findUnique({ where: { id: workId } });
}

function toView(row: WorkRow): WorkView {
	if (!isWorkType(row.type)) {
		throw new Error("unknown-work-type");
	}
	if (row.status !== WORK_STATUS.notStarted) {
		throw new Error("unknown-work-status");
	}
	return {
		id: row.id,
		key: row.key,
		number: row.number,
		projectId: row.projectId,
		revision: row.revision,
		status: WORK_STATUS.notStarted,
		title: row.title,
		type: row.type,
	};
}

function storedWork(text: string): WorkView | null {
	try {
		const parsed: unknown = JSON.parse(text);
		const result = workViewSchema.safeParse(parsed);
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}
