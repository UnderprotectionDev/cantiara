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
	applyPlanningMembershipCommandSchema,
	type BindPrimarySpecCommand,
	bindPrimarySpecCommandSchema,
	type ChangeWorkStatusCommand,
	type ChangeWorkTypeCommand,
	type ClosePreview,
	type CloseWorkCommand,
	type CreateWorkCommand,
	changeWorkStatusCommandSchema,
	changeWorkTypeCommandSchema,
	closePreviewCopy,
	closeWorkCommandSchema,
	createWorkCommandSchema,
	DEFAULT_WORK_TYPE,
	type DetachIncludedWorkCommand,
	detachFeatureAttachmentsCommandSchema,
	detachIncludedWorkCommandSchema,
	type FeatureProgress,
	type IncludeWorkCommand,
	includeWorkCommandSchema,
	isClosureResult,
	isFeatureHealthStatus,
	isNonTerminalWorkStatus,
	isWorkStatus,
	isWorkType,
	optionalText,
	type PlanningMembershipOutcome,
	type PreviewCloseInput,
	previewCloseInputSchema,
	type RecordFeatureHealthCommand,
	type RelateWorkCommand,
	type ReopenWorkCommand,
	recordFeatureHealthCommandSchema,
	relateWorkCommandSchema,
	reopenWorkCommandSchema,
	scopeCopy,
	type TypeChangeImpact,
	typeChangeImpact,
	type UpdateWorkTitleCommand,
	updateWorkTitleCommandSchema,
	WORK_LIFECYCLE_COPY,
	WORK_STATUS,
	type WorkCreateSource,
	type WorkLifecycleEventView,
	type WorkLifecycleOutcome,
	type WorkScope,
	type WorkType,
	type WorkView,
	workKey,
	workViewSchema,
} from "./work-lifecycle-model";

type PrismaTransaction = Prisma.TransactionClient;

interface WorkRow {
	closureResult: string | null;
	id: string;
	includedInFeatureId: string | null;
	key: string;
	number: number;
	primarySpecId: string | null;
	primarySpecTitle: string | null;
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

export async function changeWorkStatus(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parseStatusCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	if (parsed.command.origin !== HUMAN_ORIGIN) {
		return { reason: "silent-result-forbidden", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({ status: parsed.command.status });
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		changeStatusInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function closeWork(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parseCloseCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	if (parsed.command.origin !== HUMAN_ORIGIN) {
		return { reason: "silent-result-forbidden", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		reason: parsed.command.reason ?? null,
		result: parsed.command.result ?? null,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		closeInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function reopenWork(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parseReopenCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	if (parsed.command.origin !== HUMAN_ORIGIN) {
		return { reason: "silent-result-forbidden", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		reopenConfirmed: parsed.command.reopenConfirmed ?? false,
		status: parsed.command.status,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		reopenInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function previewClose(
	prisma: PrismaClient,
	input: unknown
): Promise<ClosePreview | { reason: "target-not-found" }> {
	const parsed = previewCloseInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "target-not-found" };
	}
	const work = await prisma.work.findUnique({
		where: { id: parsed.data.workId },
	});
	if (!work) {
		return { reason: "target-not-found" };
	}
	return buildClosePreview(work.projectId, work.id, parsed.data);
}

export async function applyPlanningMembership(
	prisma: PrismaClient,
	command: unknown
): Promise<PlanningMembershipOutcome> {
	const parsed = applyPlanningMembershipCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (parsed.data.desiredStatus === WORK_STATUS.closed) {
		return { reason: "close-step-required", status: "rejected" };
	}
	const work = await getWork(prisma, parsed.data.workId);
	if (!work) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return {
		membership: { surface: parsed.data.surface },
		status: "committed",
		work,
	};
}

export async function listWorkLifecycleHistory(
	prisma: PrismaClient,
	workId: string
): Promise<WorkLifecycleEventView[]> {
	const rows = await prisma.workLifecycleEvent.findMany({
		orderBy: { createdAt: "asc" },
		where: { workId },
	});
	return rows.map((row) => ({
		closureResult:
			row.closureResult && isClosureResult(row.closureResult)
				? row.closureResult
				: null,
		id: row.id,
		kind: asEventKind(row.kind),
		reason: row.reason,
		status: isWorkStatus(row.status) ? row.status : WORK_STATUS.notStarted,
	}));
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
	return typeChangeImpact(
		work.type,
		type,
		await loadTypeChangeAttachments(prisma, work.id)
	);
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

export async function includeWork(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parseKeyedCommand(command, includeWorkCommandSchema);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		featureId: parsed.command.featureId,
		workId: parsed.command.workId,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		includeInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function detachIncludedWork(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parseKeyedCommand(command, detachIncludedWorkCommandSchema);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({ workId: parsed.command.workId });
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		detachIncludedInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function relateWork(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parseKeyedCommand(command, relateWorkCommandSchema);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		fromWorkId: parsed.command.fromWorkId,
		kind: WORK_LIFECYCLE_COPY.related,
		toWorkId: parsed.command.toWorkId,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		relateInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function recordFeatureHealth(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parseKeyedCommand(command, recordFeatureHealthCommandSchema);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		reason: parsed.command.reason ?? null,
		status: parsed.command.status,
		workId: parsed.command.workId,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		recordHealthInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function detachFeatureHealthHistory(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	return await mutateFeatureAttachment(
		prisma,
		command,
		{ kind: "health" },
		async (tx, row) => {
			await tx.featureHealthUpdate.deleteMany({
				where: { featureId: row.id },
			});
		}
	);
}

export async function bindPrimarySpec(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parseKeyedCommand(command, bindPrimarySpecCommandSchema);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		primarySpec: parsed.command.primarySpec,
		workId: parsed.command.workId,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		bindPrimarySpecInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function detachPrimarySpec(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	return await mutateFeatureAttachment(
		prisma,
		command,
		{ kind: "primary-spec" },
		async (tx, row) => {
			await tx.work.update({
				data: {
					primarySpecId: null,
					primarySpecTitle: null,
					revision: row.revision + 1,
				},
				where: { id: row.id },
			});
		}
	);
}

export async function getWorkScope(
	prisma: PrismaClient,
	workId: string
): Promise<WorkScope | null> {
	const work = await prisma.work.findUnique({ where: { id: workId } });
	if (!work) {
		return null;
	}
	const includedWork = await prisma.work.findMany({
		orderBy: { number: "asc" },
		where: { includedInFeatureId: workId },
	});
	const includedIn =
		work.includedInFeatureId === null || work.includedInFeatureId === undefined
			? null
			: await prisma.work.findUnique({
					where: { id: work.includedInFeatureId },
				});
	const healthHistory =
		typeof prisma.featureHealthUpdate?.findMany === "function"
			? await prisma.featureHealthUpdate.findMany({
					orderBy: { createdAt: "asc" },
					where: { featureId: workId },
				})
			: [];
	const relatedEdges =
		typeof prisma.workRelatedEdge?.findMany === "function"
			? await prisma.workRelatedEdge.findMany({
					where: {
						OR: [{ fromWorkId: workId }, { toWorkId: workId }],
					},
				})
			: [];
	const relatedIds = [
		...new Set(
			relatedEdges.map((edge) =>
				edge.fromWorkId === workId ? edge.toWorkId : edge.fromWorkId
			)
		),
	];
	const relatedRows =
		relatedIds.length === 0
			? []
			: await prisma.work.findMany({
					orderBy: { number: "asc" },
					where: { id: { in: relatedIds } },
				});
	return {
		copy: scopeCopy(),
		healthHistory: healthHistory.flatMap((entry) =>
			isFeatureHealthStatus(entry.status)
				? [
						{
							id: entry.id,
							reason: entry.reason,
							status: entry.status,
						},
					]
				: []
		),
		includedIn: includedIn
			? { id: includedIn.id, key: includedIn.key, title: includedIn.title }
			: null,
		includedWork: includedWork.map((row) => ({
			id: row.id,
			key: row.key,
			title: row.title,
		})),
		primarySpec:
			work.primarySpecId && work.primarySpecTitle
				? { id: work.primarySpecId, title: work.primarySpecTitle }
				: null,
		relatedWork: relatedRows.map((row) => ({
			id: row.id,
			key: row.key,
			title: row.title,
		})),
	};
}

export async function summarizeFeatureProgress(
	prisma: PrismaClient,
	featureId: string
): Promise<FeatureProgress | { reason: "target-not-found" }> {
	const feature = await prisma.work.findUnique({ where: { id: featureId } });
	if (!(feature && isWorkType(feature.type) && isWorkStatus(feature.status))) {
		return { reason: "target-not-found" };
	}
	const includedWork = await prisma.work.findMany({
		where: { includedInFeatureId: featureId },
	});
	return {
		closedCount: includedWork.filter((row) => row.status === WORK_STATUS.closed)
			.length,
		copy: { includedWork: WORK_LIFECYCLE_COPY.includedWork },
		featureStatus: feature.status,
		includedCount: includedWork.length,
	};
}

async function includeInTransaction(
	tx: PrismaTransaction,
	command: IncludeWorkCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const prepared = await prepareWorkWrite(
		tx,
		command.workId,
		commandKey,
		fingerprint
	);
	if (prepared.status !== "ok") {
		return prepared.outcome;
	}
	if (prepared.row.revision !== command.baseRevision) {
		return stale(prepared.row);
	}
	if (command.workId === command.featureId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const feature = await loadWork(tx, command.featureId);
	if (!feature) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (feature.type !== "Feature") {
		return { reason: "not-a-feature", status: "rejected" };
	}
	if (feature.projectId !== prepared.row.projectId) {
		return { reason: "work-not-portable", status: "rejected" };
	}
	if (feature.includedInFeatureId || prepared.row.type === "Feature") {
		return { reason: "nested-inclusion-refused", status: "rejected" };
	}
	if (prepared.row.includedInFeatureId) {
		return { reason: "already-included", status: "rejected" };
	}
	await tx.work.update({
		data: {
			includedInFeatureId: feature.id,
			revision: prepared.row.revision + 1,
		},
		where: { id: prepared.row.id },
	});
	return await finishWrite(
		tx,
		prepared.row.id,
		command.actorId,
		commandKey,
		fingerprint
	);
}

async function detachIncludedInTransaction(
	tx: PrismaTransaction,
	command: DetachIncludedWorkCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const prepared = await prepareWorkWrite(
		tx,
		command.workId,
		commandKey,
		fingerprint
	);
	if (prepared.status !== "ok") {
		return prepared.outcome;
	}
	if (prepared.row.revision !== command.baseRevision) {
		return stale(prepared.row);
	}
	await tx.work.update({
		data: {
			includedInFeatureId: null,
			revision: prepared.row.revision + 1,
		},
		where: { id: prepared.row.id },
	});
	return await finishWrite(
		tx,
		prepared.row.id,
		command.actorId,
		commandKey,
		fingerprint
	);
}

async function relateInTransaction(
	tx: PrismaTransaction,
	command: RelateWorkCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const prepared = await prepareWorkWrite(
		tx,
		command.fromWorkId,
		commandKey,
		fingerprint
	);
	if (prepared.status !== "ok") {
		return prepared.outcome;
	}
	if (prepared.row.revision !== command.baseRevision) {
		return stale(prepared.row);
	}
	const target = await loadWork(tx, command.toWorkId);
	if (!target) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (target.projectId !== prepared.row.projectId) {
		return { reason: "work-not-portable", status: "rejected" };
	}
	await tx.workRelatedEdge.upsert({
		create: {
			fromWorkId: command.fromWorkId,
			id: crypto.randomUUID(),
			kind: WORK_LIFECYCLE_COPY.related,
			toWorkId: command.toWorkId,
		},
		update: {},
		where: {
			fromWorkId_toWorkId_kind: {
				fromWorkId: command.fromWorkId,
				kind: WORK_LIFECYCLE_COPY.related,
				toWorkId: command.toWorkId,
			},
		},
	});
	await tx.work.update({
		data: { revision: prepared.row.revision + 1 },
		where: { id: prepared.row.id },
	});
	return await finishWrite(
		tx,
		prepared.row.id,
		command.actorId,
		commandKey,
		fingerprint
	);
}

async function recordHealthInTransaction(
	tx: PrismaTransaction,
	command: RecordFeatureHealthCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const prepared = await prepareWorkWrite(
		tx,
		command.workId,
		commandKey,
		fingerprint
	);
	if (prepared.status !== "ok") {
		return prepared.outcome;
	}
	if (prepared.row.revision !== command.baseRevision) {
		return stale(prepared.row);
	}
	if (prepared.row.type !== "Feature") {
		return { reason: "feature-health-not-allowed", status: "rejected" };
	}
	if (!isFeatureHealthStatus(command.status)) {
		return { reason: "unknown-feature-health", status: "rejected" };
	}
	await tx.featureHealthUpdate.create({
		data: {
			featureId: prepared.row.id,
			id: crypto.randomUUID(),
			reason: optionalText(command.reason),
			status: command.status,
		},
	});
	await tx.work.update({
		data: { revision: prepared.row.revision + 1 },
		where: { id: prepared.row.id },
	});
	return await finishWrite(
		tx,
		prepared.row.id,
		command.actorId,
		commandKey,
		fingerprint
	);
}

async function bindPrimarySpecInTransaction(
	tx: PrismaTransaction,
	command: BindPrimarySpecCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const prepared = await prepareWorkWrite(
		tx,
		command.workId,
		commandKey,
		fingerprint
	);
	if (prepared.status !== "ok") {
		return prepared.outcome;
	}
	if (prepared.row.revision !== command.baseRevision) {
		return stale(prepared.row);
	}
	if (prepared.row.type !== "Feature") {
		return { reason: "not-a-feature", status: "rejected" };
	}
	await tx.work.update({
		data: {
			primarySpecId: command.primarySpec.id,
			primarySpecTitle: command.primarySpec.title,
			revision: prepared.row.revision + 1,
		},
		where: { id: prepared.row.id },
	});
	return await finishWrite(
		tx,
		prepared.row.id,
		command.actorId,
		commandKey,
		fingerprint
	);
}

async function mutateFeatureAttachment(
	prisma: PrismaClient,
	command: unknown,
	fingerprintPayload: { kind: string },
	write: (tx: PrismaTransaction, row: WorkRow) => Promise<void>
): Promise<WorkLifecycleOutcome> {
	const parsed = parseKeyedCommand(
		command,
		detachFeatureAttachmentsCommandSchema
	);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		kind: fingerprintPayload.kind,
		workId: parsed.command.workId,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction(async (tx) => {
		const prepared = await prepareWorkWrite(
			tx,
			parsed.command.workId,
			commandKey,
			fingerprint
		);
		if (prepared.status !== "ok") {
			return prepared.outcome;
		}
		if (prepared.row.revision !== parsed.command.baseRevision) {
			return stale(prepared.row);
		}
		if (prepared.row.type !== "Feature") {
			return { reason: "not-a-feature", status: "rejected" };
		}
		await write(tx, prepared.row);
		if (fingerprintPayload.kind === "health") {
			await tx.work.update({
				data: { revision: prepared.row.revision + 1 },
				where: { id: prepared.row.id },
			});
		}
		return await finishWrite(
			tx,
			prepared.row.id,
			parsed.command.actorId,
			commandKey,
			fingerprint
		);
	});
}

function stale(row: WorkRow): WorkLifecycleOutcome {
	return {
		current: toView(row),
		currentValueLabel: MUTATION_COPY.currentValue,
		status: "stale",
	};
}

async function loadTypeChangeAttachments(
	db: PrismaClient | PrismaTransaction,
	workId: string
): Promise<{
	healthHistory: TypeChangeImpact["healthHistory"];
	includedWork: TypeChangeImpact["includedWork"];
	primarySpec: TypeChangeImpact["primarySpec"];
}> {
	const includedWork = await db.work.findMany({
		orderBy: { number: "asc" },
		where: { includedInFeatureId: workId },
	});
	const healthHistory =
		typeof db.featureHealthUpdate?.findMany === "function"
			? await db.featureHealthUpdate.findMany({
					orderBy: { createdAt: "asc" },
					where: { featureId: workId },
				})
			: [];
	const work = await db.work.findUnique({
		select: { primarySpecId: true, primarySpecTitle: true },
		where: { id: workId },
	});
	return {
		healthHistory: healthHistory.map((entry) => ({ id: entry.id })),
		includedWork: includedWork.map((row) => ({
			id: row.id,
			key: row.key,
			title: row.title,
		})),
		primarySpec:
			work?.primarySpecId && work.primarySpecTitle
				? { id: work.primarySpecId, title: work.primarySpecTitle }
				: null,
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

function parseStatusCommand(
	command: unknown
):
	| { command: ChangeWorkStatusCommand; status: "ok" }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
	return parseKeyedCommand(command, changeWorkStatusCommandSchema);
}

function parseCloseCommand(
	command: unknown
):
	| { command: CloseWorkCommand; status: "ok" }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
	return parseKeyedCommand(command, closeWorkCommandSchema);
}

function parseReopenCommand(
	command: unknown
):
	| { command: ReopenWorkCommand; status: "ok" }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
	return parseKeyedCommand(command, reopenWorkCommandSchema);
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
	const impact = typeChangeImpact(
		locked.type,
		command.type,
		await loadTypeChangeAttachments(tx, locked.id)
	);
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

async function changeStatusInTransaction(
	tx: PrismaTransaction,
	command: ChangeWorkStatusCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const prepared = await prepareWorkWrite(
		tx,
		command.workId,
		commandKey,
		fingerprint
	);
	if (prepared.status !== "ok") {
		return prepared.outcome;
	}
	if (prepared.row.revision !== command.baseRevision) {
		return {
			current: toView(prepared.row),
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	if (command.status === WORK_STATUS.closed) {
		return { reason: "close-step-required", status: "rejected" };
	}
	if (!isNonTerminalWorkStatus(command.status)) {
		return { reason: "unknown-work-status", status: "rejected" };
	}
	if (prepared.row.status === WORK_STATUS.closed) {
		return { reason: "reopen-required", status: "rejected" };
	}
	if (command.status === prepared.row.status) {
		const work = toView(prepared.row);
		await writeReceipt(tx, {
			actorId: command.actorId,
			commandKey,
			fingerprint,
			work,
		});
		return { status: "committed", work };
	}
	await tx.work.update({
		data: {
			revision: prepared.row.revision + 1,
			status: command.status,
		},
		where: { id: prepared.row.id },
	});
	await appendEvent(tx, {
		closureResult: null,
		kind: "status",
		reason: null,
		status: command.status,
		workId: prepared.row.id,
	});
	return await finishWrite(
		tx,
		prepared.row.id,
		command.actorId,
		commandKey,
		fingerprint
	);
}

async function closeInTransaction(
	tx: PrismaTransaction,
	command: CloseWorkCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const prepared = await prepareWorkWrite(
		tx,
		command.workId,
		commandKey,
		fingerprint
	);
	if (prepared.status !== "ok") {
		return prepared.outcome;
	}
	if (prepared.row.revision !== command.baseRevision) {
		return {
			current: toView(prepared.row),
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	if (!(command.result && isClosureResult(command.result))) {
		return { reason: "unknown-closure-result", status: "rejected" };
	}
	const reason = optionalText(command.reason);
	await tx.work.update({
		data: {
			closureReason: reason,
			closureResult: command.result,
			revision: prepared.row.revision + 1,
			status: WORK_STATUS.closed,
		},
		where: { id: prepared.row.id },
	});
	await appendEvent(tx, {
		closureResult: command.result,
		kind: "closed",
		reason,
		status: WORK_STATUS.closed,
		workId: prepared.row.id,
	});
	return await finishWrite(
		tx,
		prepared.row.id,
		command.actorId,
		commandKey,
		fingerprint
	);
}

async function reopenInTransaction(
	tx: PrismaTransaction,
	command: ReopenWorkCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const prepared = await prepareWorkWrite(
		tx,
		command.workId,
		commandKey,
		fingerprint
	);
	if (prepared.status !== "ok") {
		return prepared.outcome;
	}
	if (prepared.row.revision !== command.baseRevision) {
		return {
			current: toView(prepared.row),
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	if (prepared.row.status !== WORK_STATUS.closed) {
		return { reason: "unknown-work-status", status: "rejected" };
	}
	if (command.reopenConfirmed !== true) {
		return { reason: "reopen-confirm-required", status: "rejected" };
	}
	if (!isNonTerminalWorkStatus(command.status)) {
		return { reason: "unknown-work-status", status: "rejected" };
	}
	await tx.work.update({
		data: {
			closureReason: null,
			closureResult: null,
			revision: prepared.row.revision + 1,
			status: command.status,
		},
		where: { id: prepared.row.id },
	});
	await appendEvent(tx, {
		closureResult: null,
		kind: "reopened",
		reason: null,
		status: command.status,
		workId: prepared.row.id,
	});
	return await finishWrite(
		tx,
		prepared.row.id,
		command.actorId,
		commandKey,
		fingerprint
	);
}

function buildClosePreview(
	projectId: string,
	workId: string,
	input: PreviewCloseInput
): ClosePreview {
	const notes = optionalText(input.notes);
	return {
		blocking: false,
		copy: closePreviewCopy(),
		findings: {
			activeBlockers: input.activeBlockers ?? [],
			incompleteChecklistItems: input.incompleteChecklistItems ?? [],
		},
		keepLastingContext:
			notes === null
				? null
				: {
						decision: {
							action: "create-decision",
							body: notes,
							linkedWorkId: workId,
						},
						personalWiki: {
							action: "create-personal-wiki-document",
							body: notes,
							originProjectId: projectId,
							originWorkId: workId,
						},
					},
	};
}

async function prepareWorkWrite(
	tx: PrismaTransaction,
	workId: string,
	commandKey: string,
	fingerprint: string
): Promise<
	| { outcome: WorkLifecycleOutcome; status: "done" }
	| { row: WorkRow; status: "ok" }
> {
	const current = await tx.work.findUnique({ where: { id: workId } });
	if (!current) {
		return {
			outcome: { reason: "target-not-found", status: "rejected" },
			status: "done",
		};
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return { outcome: replayed, status: "done" };
	}
	const locked = await loadWork(tx, current.id);
	if (!locked) {
		return {
			outcome: { reason: "target-not-found", status: "rejected" },
			status: "done",
		};
	}
	return { row: locked, status: "ok" };
}

async function finishWrite(
	tx: PrismaTransaction,
	workId: string,
	actorId: string,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const updated = await loadWork(tx, workId);
	if (!updated) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const work = toView(updated);
	await writeReceipt(tx, {
		actorId,
		commandKey,
		fingerprint,
		work,
	});
	return { status: "committed", work };
}

async function appendEvent(
	tx: PrismaTransaction,
	input: {
		closureResult: string | null;
		kind: WorkLifecycleEventView["kind"];
		reason: string | null;
		status: string;
		workId: string;
	}
): Promise<void> {
	await tx.workLifecycleEvent.create({
		data: {
			closureResult: input.closureResult,
			id: crypto.randomUUID(),
			kind: input.kind,
			reason: input.reason,
			status: input.status,
			workId: input.workId,
		},
	});
}

function asEventKind(value: string): WorkLifecycleEventView["kind"] {
	if (value === "closed" || value === "reopened" || value === "status") {
		return value;
	}
	return "status";
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
	if (!isWorkStatus(row.status)) {
		throw new Error("unknown-work-status");
	}
	const closureResult =
		row.closureResult && isClosureResult(row.closureResult)
			? row.closureResult
			: null;
	if (row.status === WORK_STATUS.closed && closureResult === null) {
		throw new Error("unknown-closure-result");
	}
	return {
		closureResult: row.status === WORK_STATUS.closed ? closureResult : null,
		id: row.id,
		key: row.key,
		number: row.number,
		projectId: row.projectId,
		revision: row.revision,
		status: row.status,
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
