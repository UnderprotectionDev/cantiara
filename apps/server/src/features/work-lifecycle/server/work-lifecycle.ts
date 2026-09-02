import type { Prisma, PrismaClient } from "@cantiara/db";
import { z } from "zod";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	isRecord,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { markProjectHasWork } from "../../project-shell/server/project-shell";
import { createRelation } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	type ArchiveWorkCommand,
	applyPlanningMembershipCommandSchema,
	applyScopeTreeDragCommandSchema,
	archiveWorkCommandSchema,
	type BindPrimarySpecCommand,
	bindPrimarySpecCommandSchema,
	type ChangeWorkStatusCommand,
	type ChangeWorkTypeCommand,
	type ClosePreview,
	type CloseWorkCommand,
	type CreateWorkCommand,
	changeWorkStatusCommandSchema,
	changeWorkTypeCommandSchema,
	chooseMergeFields,
	classifyRecreateRelations,
	closePreviewCopy,
	closeWorkCommandSchema,
	createWorkCommandSchema,
	DEFAULT_WORK_TYPE,
	type DetachIncludedWorkCommand,
	defaultSelectedFields,
	detachFeatureAttachmentsCommandSchema,
	detachIncludedWorkCommandSchema,
	type FeatureProgress,
	type IncludeWorkCommand,
	includeWorkCommandSchema,
	isClosureResult,
	isFeatureHealthStatus,
	isNonTerminalWorkStatus,
	isPortableRelationKind,
	isPortableWorkField,
	isWorkStatus,
	isWorkType,
	type LightChecklistItem,
	lightChecklistItemSchema,
	type MergeWorkCommand,
	mergeWorkCommandSchema,
	optionalText,
	type PlanningMembershipOutcome,
	type PreviewCloseInput,
	portableFieldPreviews,
	previewCloseInputSchema,
	previewRecreateInputSchema,
	previewWorkMergeInputSchema,
	type RecordFeatureHealthCommand,
	type RecreatePreview,
	type RecreateWorkCommand,
	type RelateWorkCommand,
	type ReopenWorkCommand,
	recordFeatureHealthCommandSchema,
	recreatePreviewCopy,
	recreateWorkCommandSchema,
	relateWorkCommandSchema,
	reopenWorkCommandSchema,
	type ScopeTree,
	type ScopeTreeDragOutcome,
	type ScopeTreeWorkNode,
	scopeCopy,
	scopeTreeCopy,
	type TypeChangeImpact,
	typeChangeImpact,
	type UnarchiveWorkCommand,
	type UndoWorkMergeCommand,
	type UpdateWorkPlanningDatesCommand,
	type UpdateWorkTitleCommand,
	unarchiveWorkCommandSchema,
	undoWorkMergeCommandSchema,
	updateWorkPlanningDatesCommandSchema,
	updateWorkTitleCommandSchema,
	WORK_LIFECYCLE_COPY,
	WORK_MERGE_FIELDS,
	WORK_STATUS,
	type WorkCreateSource,
	type WorkLifecycleEventView,
	type WorkLifecycleOutcome,
	type WorkLifecycleRejectionReason,
	type WorkMergeField,
	type WorkMergeOutcome,
	type WorkMergePreview,
	type WorkOrigin,
	type WorkRelationView,
	type WorkScope,
	type WorkType,
	type WorkView,
	workKey,
	workMergeConflicts,
	workMergePreviewCopy,
	workRelationSchema,
	workViewSchema,
} from "./work-lifecycle-model";

type PrismaTransaction = Prisma.TransactionClient;

interface WorkRow {
	archived: boolean;
	closureResult: string | null;
	description: string | null;
	id: string;
	includedInFeatureId: string | null;
	key: string;
	lightChecklist: Prisma.JsonValue;
	number: number;
	originWork: WorkOrigin | null;
	originWorkId: string | null;
	plannedStart?: string | null;
	portableRelations: Prisma.JsonValue;
	primarySpecId: string | null;
	primarySpecTitle: string | null;
	projectId: string;
	reappearDate?: string | null;
	retiredIntoId: string | null;
	revision: number;
	status: string;
	targetDate?: string | null;
	title: string;
	type: string;
}

interface RewrittenWorkRelation {
	id: string;
	kind: string;
	originalFromId: string;
	originalToId: string;
	rewrittenFromId: string;
	rewrittenToId: string;
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

export async function createWorkInTransaction(
	tx: PrismaTransaction,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	await Promise.resolve();
	const parsed = parseCreateCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return createInTransaction(tx, parsed.command, commandKey, fingerprint);
}

export async function closeWorkInTransaction(
	tx: PrismaTransaction,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	await Promise.resolve();
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
	return closeInTransaction(tx, parsed.command, commandKey, fingerprint);
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

export async function updateWorkPlanningDates(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parsePlanningDatesCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		plannedStart: parsed.command.plannedStart,
		reappearDate: parsed.command.reappearDate,
		targetDate: parsed.command.targetDate,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		updatePlanningDatesInTransaction(
			tx,
			parsed.command,
			commandKey,
			fingerprint
		)
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

export async function archiveWork(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parseArchiveCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({ archived: true });
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		setArchivedInTransaction(tx, parsed.command, commandKey, fingerprint, true)
	);
}

export async function unarchiveWork(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parseUnarchiveCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({ archived: false });
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		setArchivedInTransaction(tx, parsed.command, commandKey, fingerprint, false)
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

export async function previewRecreate(
	prisma: PrismaClient,
	input: unknown
): Promise<RecreatePreview | { reason: "target-not-found" }> {
	const parsed = previewRecreateInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "target-not-found" };
	}
	const work = await loadWork(prisma, parsed.data.workId);
	if (!work) {
		return { reason: "target-not-found" };
	}
	const target = await prisma.project.findUnique({
		select: { id: true, name: true },
		where: { id: parsed.data.targetProjectId },
	});
	if (!target) {
		return { reason: "target-not-found" };
	}
	if (!(isWorkType(work.type) && isWorkStatus(work.status))) {
		return { reason: "target-not-found" };
	}
	const closureResult =
		work.closureResult && isClosureResult(work.closureResult)
			? work.closureResult
			: null;
	return {
		copy: recreatePreviewCopy(),
		portableFields: portableFieldPreviews({
			description: work.description,
			lightChecklist: asChecklist(work.lightChecklist),
			title: work.title,
			type: work.type,
		}),
		relations: classifyRecreateRelations(parsed.data.relations ?? []),
		source: {
			closureResult: work.status === WORK_STATUS.closed ? closureResult : null,
			id: work.id,
			key: work.key,
			status: work.status,
			type: work.type,
		},
		targetProject: {
			id: target.id,
			name: target.name,
		},
	};
}

export async function recreateWork(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkLifecycleOutcome> {
	const parsed = parseRecreateCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		relations: parsed.command.payload.relations ?? [],
		selectedFields: parsed.command.payload.selectedFields ?? null,
		selectedRelationIds: parsed.command.payload.selectedRelationIds ?? [],
		targetProjectId: parsed.command.payload.targetProjectId,
		workId: parsed.command.payload.workId,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		recreateInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
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

export async function previewWorkMerge(
	prisma: PrismaClient,
	input: unknown
): Promise<
	| WorkMergePreview
	| { reason: "target-not-found" | "merge-same-work" | "work-not-portable" }
> {
	const parsed = previewWorkMergeInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "target-not-found" };
	}
	if (parsed.data.survivorId === parsed.data.duplicateId) {
		return { reason: "merge-same-work" };
	}
	const survivorRow = await loadWork(prisma, parsed.data.survivorId);
	const duplicateRow = await loadWork(prisma, parsed.data.duplicateId);
	if (!(survivorRow && duplicateRow)) {
		return { reason: "target-not-found" };
	}
	if (survivorRow.retiredIntoId || duplicateRow.retiredIntoId) {
		return { reason: "target-not-found" };
	}
	if (survivorRow.projectId !== duplicateRow.projectId) {
		return { reason: "work-not-portable" };
	}
	return await buildMergePreview(prisma, survivorRow, duplicateRow);
}

export async function mergeWork(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkMergeOutcome> {
	const parsed = parseMergeCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		duplicateId: parsed.command.duplicateId,
		fieldChoices: parsed.command.fieldChoices ?? {},
		previewAcknowledged: parsed.command.previewAcknowledged ?? false,
		survivorId: parsed.command.survivorId,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		mergeInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function undoWorkMerge(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkMergeOutcome> {
	const parsed = parseUndoMergeCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		mergeEventId: parsed.command.mergeEventId,
		undo: true,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		undoMergeInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function listWorkRelations(
	prisma: PrismaClient,
	workId: string
): Promise<Array<{ fromId: string; kind: string; toId: string }>> {
	const rows = await prisma.workRelation.findMany({
		orderBy: { createdAt: "asc" },
		where: { OR: [{ fromId: workId }, { toId: workId }] },
	});
	return rows.map((row) => ({
		fromId: row.fromId,
		kind: row.kind,
		toId: row.toId,
	}));
}

export async function getWorkByKey(
	prisma: PrismaClient,
	projectId: string,
	key: string
): Promise<WorkView | null> {
	const row = await prisma.work.findFirst({
		where: { key, projectId },
	});
	if (!row) {
		return null;
	}
	return await getWork(prisma, row.id);
}

export async function getWork(
	prisma: PrismaClient,
	workId: string
): Promise<WorkView | null> {
	const row = await loadWork(prisma, workId);
	if (!row) {
		return null;
	}
	if (row.retiredIntoId) {
		const survivor = await loadWork(prisma, row.retiredIntoId);
		if (!survivor) {
			return null;
		}
		return toView(survivor, {
			latestMergeEventId: await loadLatestMergeEventId(prisma, survivor.id),
			origin: survivor.originWork ?? {
				id: row.id,
				key: row.key,
				projectId: row.projectId,
			},
			retiredIdentities: await loadRetiredIdentities(prisma, survivor.id),
		});
	}
	return toView(row, {
		latestMergeEventId: await loadLatestMergeEventId(prisma, row.id),
		origin: row.originWork,
		retiredIdentities: await loadRetiredIdentities(prisma, row.id),
	});
}

export async function listWork(
	prisma: PrismaClient,
	projectId: string,
	filter: { archived?: boolean } = {}
): Promise<WorkView[]> {
	const archived = filter.archived === true;
	const rows = await prisma.work.findMany({
		orderBy: { number: "asc" },
		where: { archived, projectId, retiredIntoId: null },
	});
	const withOrigin = await withOrigins(prisma, rows);
	const survivorIds = withOrigin.map((row) => row.id);
	const identities = await prisma.work.findMany({
		select: { id: true, key: true, projectId: true, retiredIntoId: true },
		where: { retiredIntoId: { in: survivorIds } },
	});
	const events = await prisma.workMergeEvent.findMany({
		orderBy: { createdAt: "desc" },
		where: { survivorId: { in: survivorIds } },
	});
	const eventBySurvivor = new Map<string, string>();
	for (const event of events) {
		if (!eventBySurvivor.has(event.survivorId)) {
			eventBySurvivor.set(event.survivorId, event.id);
		}
	}
	const bySurvivor = new Map<string, WorkOrigin[]>();
	for (const identity of identities) {
		if (!identity.retiredIntoId) {
			continue;
		}
		const current = bySurvivor.get(identity.retiredIntoId) ?? [];
		current.push({
			id: identity.id,
			key: identity.key,
			projectId: identity.projectId,
		});
		bySurvivor.set(identity.retiredIntoId, current);
	}
	return withOrigin.map((row) =>
		toView(row, {
			latestMergeEventId: eventBySurvivor.get(row.id) ?? null,
			origin: row.originWork,
			retiredIdentities: bySurvivor.get(row.id) ?? [],
		})
	);
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
	const fromWork = await loadWork(prisma, parsed.command.fromWorkId);
	if (!fromWork) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const project = await prisma.project.findUnique({
		where: { id: fromWork.projectId },
	});
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const linked = await createRelation(prisma, {
		actorId: parsed.command.actorId,
		from: { id: parsed.command.fromWorkId, kind: "Work" },
		idempotencyKey: `${parsed.command.idempotencyKey}:relation`,
		origin: "human",
		previewAcknowledged: true,
		to: { id: parsed.command.toWorkId, kind: "Work" },
		type: RELATIONS_COPY.related,
		viewerWorkspaceId: project.workspaceId,
	});
	if (linked.status === "conflict") {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (linked.status === "rejected") {
		return { reason: "target-not-found", status: "rejected" };
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

function relatedOtherId(
	edge:
		| { fromId: string; fromKind?: string; toId: string }
		| { fromWorkId: string; toWorkId: string },
	workId: string
): string {
	if ("fromId" in edge) {
		return edge.fromId === workId ? edge.toId : edge.fromId;
	}
	return edge.fromWorkId === workId ? edge.toWorkId : edge.fromWorkId;
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
	let relatedEdges:
		| Array<{ fromId: string; fromKind?: string; toId: string }>
		| Array<{ fromWorkId: string; toWorkId: string }> = [];
	if (typeof prisma.typedRelation?.findMany === "function") {
		relatedEdges = await prisma.typedRelation.findMany({
			where: {
				OR: [
					{ fromId: workId, fromKind: "Work" },
					{ toId: workId, toKind: "Work" },
				],
				type: WORK_LIFECYCLE_COPY.related,
			},
		});
	} else if (typeof prisma.workRelatedEdge?.findMany === "function") {
		relatedEdges = await prisma.workRelatedEdge.findMany({
			where: {
				OR: [{ fromWorkId: workId }, { toWorkId: workId }],
			},
		});
	}
	const relatedIds = [
		...new Set(relatedEdges.map((edge) => relatedOtherId(edge, workId))),
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

function asTreeWorkNode(row: {
	id: string;
	key: string;
	status: string;
	title: string;
	type: string;
}): ScopeTreeWorkNode | null {
	if (!(isWorkType(row.type) && isWorkStatus(row.status))) {
		return null;
	}
	return {
		id: row.id,
		key: row.key,
		status: row.status,
		title: row.title,
		type: row.type,
	};
}

export async function getScopeTree(
	prisma: PrismaClient,
	projectId: string
): Promise<ScopeTree | null> {
	const project = await prisma.project.findUnique({
		select: { id: true, name: true },
		where: { id: projectId },
	});
	if (!project) {
		return null;
	}
	const rows = await prisma.work.findMany({
		orderBy: { number: "asc" },
		where: { projectId, retiredIntoId: null },
	});
	const features = rows.filter((row) => row.type === "Feature");
	return {
		copy: scopeTreeCopy(),
		features: features.flatMap((feature) => {
			if (!isWorkStatus(feature.status)) {
				return [];
			}
			const includedWork = rows.flatMap((row) => {
				if (row.includedInFeatureId !== feature.id) {
					return [];
				}
				const node = asTreeWorkNode(row);
				return node ? [node] : [];
			});
			return [
				{
					id: feature.id,
					includedWork,
					key: feature.key,
					progress: {
						closedCount: includedWork.filter(
							(row) => row.status === WORK_STATUS.closed
						).length,
						featureStatus: feature.status,
						includedCount: includedWork.length,
					},
					status: feature.status,
					title: feature.title,
					type: "Feature" as const,
				},
			];
		}),
		project: { id: project.id, name: project.name },
	};
}

export function applyScopeTreeDrag(
	_prisma: PrismaClient,
	command: unknown
): ScopeTreeDragOutcome {
	applyScopeTreeDragCommandSchema.safeParse(command);
	return { reason: "scope-tree-read-only", status: "rejected" };
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

function parsePlanningDatesCommand(
	command: unknown
):
	| { command: UpdateWorkPlanningDatesCommand; status: "ok" }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
	return parseKeyedCommand(command, updateWorkPlanningDatesCommandSchema);
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

function parseMergeCommand(
	command: unknown
):
	| { command: MergeWorkCommand; status: "ok" }
	| { outcome: WorkMergeOutcome; status: "rejected" } {
	return parseKeyedCommand(command, mergeWorkCommandSchema);
}

function parseUndoMergeCommand(
	command: unknown
):
	| { command: UndoWorkMergeCommand; status: "ok" }
	| { outcome: WorkMergeOutcome; status: "rejected" } {
	return parseKeyedCommand(command, undoWorkMergeCommandSchema);
}

function parseRecreateCommand(
	command: unknown
):
	| { command: RecreateWorkCommand; status: "ok" }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
	return parseKeyedCommand(command, recreateWorkCommandSchema);
}

function parseArchiveCommand(
	command: unknown
):
	| { command: ArchiveWorkCommand; status: "ok" }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
	return parseKeyedCommand(command, archiveWorkCommandSchema);
}

function parseUnarchiveCommand(
	command: unknown
):
	| { command: UnarchiveWorkCommand; status: "ok" }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
	return parseKeyedCommand(command, unarchiveWorkCommandSchema);
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
	| {
			outcome: { reason: WorkLifecycleRejectionReason; status: "rejected" };
			status: "rejected";
	  } {
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
	if (!current || current.retiredIntoId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await loadWork(tx, current.id);
	if (!locked || locked.retiredIntoId) {
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
	const work = await viewFor(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		work,
	});
	return { status: "committed", work };
}

function asPlanningDate(value: string | null | undefined): string | null {
	if (value === null || value === undefined || value === "") {
		return null;
	}
	return value;
}

async function updatePlanningDatesInTransaction(
	tx: PrismaTransaction,
	command: UpdateWorkPlanningDatesCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const current = await tx.work.findUnique({ where: { id: command.workId } });
	if (!current || current.retiredIntoId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await loadWork(tx, current.id);
	if (!locked || locked.retiredIntoId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return {
			current: toView(locked),
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	await tx.work.update({
		data: {
			plannedStart: asPlanningDate(command.plannedStart),
			reappearDate: asPlanningDate(command.reappearDate),
			revision: locked.revision + 1,
			targetDate: asPlanningDate(command.targetDate),
		},
		where: { id: locked.id },
	});
	const updated = await loadWork(tx, locked.id);
	if (!updated) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const work = await viewFor(tx, updated);
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
	if (!current || current.retiredIntoId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await loadWork(tx, current.id);
	if (!(locked && isWorkType(locked.type)) || locked.retiredIntoId) {
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
	const work = await viewFor(tx, updated);
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

async function recreateInTransaction(
	tx: PrismaTransaction,
	command: RecreateWorkCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkLifecycleOutcome> {
	const source = await loadWork(tx, command.payload.workId);
	if (!source) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const target = await tx.project.findUnique({
		select: { id: true, shortCode: true },
		where: { id: command.payload.targetProjectId },
	});
	if (!target) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (target.id === source.projectId) {
		return { reason: "work-not-portable", status: "rejected" };
	}
	await lockProject(tx, target.id);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const selectedFields = resolveSelectedFields(command.payload.selectedFields);
	if (selectedFields.status !== "ok") {
		return selectedFields.outcome;
	}
	const portableRelations = resolvePortableRelations(
		command.payload.relations ?? [],
		command.payload.selectedRelationIds ?? []
	);
	if (portableRelations.status !== "ok") {
		return portableRelations.outcome;
	}
	if (!isWorkType(source.type)) {
		return { reason: "unknown-work-type", status: "rejected" };
	}
	const title = selectedFields.value.includes("title")
		? optionalText(source.title)
		: null;
	if (!title) {
		return { reason: "missing-title", status: "rejected" };
	}
	const type = selectedFields.value.includes("type")
		? source.type
		: DEFAULT_WORK_TYPE;
	const description = selectedFields.value.includes("description")
		? source.description
		: null;
	const lightChecklist = selectedFields.value.includes("lightChecklist")
		? asChecklist(source.lightChecklist).map((item) => ({
				completed: item.completed,
				id: crypto.randomUUID(),
				title: item.title,
			}))
		: [];
	const number = await allocateNumber(tx, target.id);
	const workId = crypto.randomUUID();
	await tx.work.create({
		data: {
			description,
			id: workId,
			key: workKey(target.shortCode, number),
			lightChecklist,
			number,
			originWorkId: source.id,
			portableRelations: portableRelations.value,
			projectId: target.id,
			revision: 1,
			status: WORK_STATUS.notStarted,
			title,
			type,
		},
	});
	await markProjectHasWork(tx, target.id);
	return await finishWrite(
		tx,
		workId,
		command.actorId,
		commandKey,
		fingerprint
	);
}

async function setArchivedInTransaction(
	tx: PrismaTransaction,
	command: ArchiveWorkCommand,
	commandKey: string,
	fingerprint: string,
	archived: boolean
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
	if (prepared.row.archived === archived) {
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
			archived,
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

function resolveSelectedFields(
	selectedFields: string[] | undefined
):
	| { status: "ok"; value: string[] }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
	const fields = selectedFields ?? defaultSelectedFields();
	if (fields.some((field) => !isPortableWorkField(field))) {
		return {
			outcome: { reason: "work-not-portable", status: "rejected" },
			status: "rejected",
		};
	}
	return { status: "ok", value: fields };
}

function resolvePortableRelations(
	relations: ReadonlyArray<{ id: string; kind: string; title: string }>,
	selectedRelationIds: readonly string[]
):
	| { status: "ok"; value: WorkRelationView[] }
	| { outcome: WorkLifecycleOutcome; status: "rejected" } {
	const byId = new Map(relations.map((relation) => [relation.id, relation]));
	const copied: WorkRelationView[] = [];
	for (const id of selectedRelationIds) {
		const relation = byId.get(id);
		if (!(relation && isPortableRelationKind(relation.kind))) {
			return {
				outcome: { reason: "work-not-portable", status: "rejected" },
				status: "rejected",
			};
		}
		copied.push({
			id: crypto.randomUUID(),
			kind: relation.kind,
			title: relation.title,
		});
	}
	return { status: "ok", value: copied };
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
	if (!current || current.retiredIntoId) {
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
	const work = await viewFor(tx, updated);
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
		return { status: "replayed", work: await viewFor(tx, live) };
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
	const row = await db.work.findUnique({
		where: { id: workId },
	});
	if (!row) {
		return null;
	}
	const [viewRow] = await withOrigins(db, [row]);
	return viewRow ?? null;
}

async function withOrigins(
	db: PrismaClient | PrismaTransaction,
	rows: readonly Omit<WorkRow, "originWork">[]
): Promise<WorkRow[]> {
	const originIds = [
		...new Set(
			rows
				.map((row) => row.originWorkId)
				.filter((id): id is string => typeof id === "string" && id.length > 0)
		),
	];
	const origins =
		originIds.length === 0
			? []
			: await db.work.findMany({
					select: { id: true, key: true, projectId: true },
					where: { id: { in: originIds } },
				});
	const originById = new Map(
		origins.map((origin) => [origin.id, origin satisfies WorkOrigin])
	);
	return rows.map((row) => ({
		...row,
		originWork: row.originWorkId
			? (originById.get(row.originWorkId) ?? null)
			: null,
	}));
}

function toView(
	row: WorkRow,
	identities: {
		latestMergeEventId: string | null;
		origin: WorkOrigin | null;
		retiredIdentities: WorkOrigin[];
	} = {
		latestMergeEventId: null,
		origin: null,
		retiredIdentities: [],
	}
): WorkView {
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
		archived: row.archived,
		closureResult: row.status === WORK_STATUS.closed ? closureResult : null,
		description: row.description,
		id: row.id,
		key: row.key,
		latestMergeEventId: identities.latestMergeEventId,
		lightChecklist: asChecklist(row.lightChecklist),
		number: row.number,
		origin: identities.origin ?? row.originWork ?? null,
		plannedStart: row.plannedStart ?? null,
		projectId: row.projectId,
		reappearDate: row.reappearDate ?? null,
		relations: asRelations(row.portableRelations),
		retiredIdentities: identities.retiredIdentities,
		revision: row.revision,
		status: row.status,
		targetDate: row.targetDate ?? null,
		title: row.title,
		type: row.type,
	};
}

async function viewFor(
	db: PrismaClient | PrismaTransaction,
	row: WorkRow,
	origin: WorkOrigin | null = null
): Promise<WorkView> {
	return toView(row, {
		latestMergeEventId: await loadLatestMergeEventId(db, row.id),
		origin,
		retiredIdentities: await loadRetiredIdentities(db, row.id),
	});
}

async function loadLatestMergeEventId(
	db: PrismaClient | PrismaTransaction,
	survivorId: string
): Promise<string | null> {
	const event = await db.workMergeEvent.findFirst({
		orderBy: { createdAt: "desc" },
		select: { id: true },
		where: { survivorId },
	});
	return event?.id ?? null;
}

async function loadRetiredIdentities(
	db: PrismaClient | PrismaTransaction,
	survivorId: string
): Promise<WorkOrigin[]> {
	const rows = await db.work.findMany({
		orderBy: { number: "asc" },
		select: { id: true, key: true, projectId: true },
		where: { retiredIntoId: survivorId },
	});
	return rows.map((row) => ({
		id: row.id,
		key: row.key,
		projectId: row.projectId,
	}));
}

async function buildMergePreview(
	db: PrismaClient | PrismaTransaction,
	survivorRow: WorkRow,
	duplicateRow: WorkRow
): Promise<WorkMergePreview> {
	const survivor = await viewFor(db, survivorRow);
	const duplicate = await viewFor(db, duplicateRow);
	const relations = await db.workRelation.findMany({
		orderBy: { createdAt: "asc" },
		where: {
			OR: [{ fromId: duplicateRow.id }, { toId: duplicateRow.id }],
		},
	});
	return {
		copy: workMergePreviewCopy(),
		duplicate,
		fieldConflicts: workMergeConflicts(survivor, duplicate),
		relationsToRewrite: relations.flatMap((relation) => {
			const rewrite = rewriteRelation(
				relation,
				survivorRow.id,
				duplicateRow.id
			);
			if (!rewrite || rewrite.drop) {
				return [];
			}
			return [
				{
					fromId: relation.fromId,
					kind: "Related" as const,
					rewrittenFromId: rewrite.fromId,
					rewrittenToId: rewrite.toId,
					toId: relation.toId,
				},
			];
		}),
		survivor,
	};
}

function rewriteRelation(
	relation: { fromId: string; toId: string },
	survivorId: string,
	duplicateId: string
): { drop: boolean; fromId: string; toId: string } | null {
	const fromId = relation.fromId === duplicateId ? survivorId : relation.fromId;
	const toId = relation.toId === duplicateId ? survivorId : relation.toId;
	if (fromId === toId) {
		return { drop: true, fromId, toId };
	}
	if (fromId === relation.fromId && toId === relation.toId) {
		return null;
	}
	return { drop: false, fromId, toId };
}

async function mergeInTransaction(
	tx: PrismaTransaction,
	command: MergeWorkCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkMergeOutcome> {
	if (command.survivorId === command.duplicateId) {
		return { reason: "merge-same-work", status: "rejected" };
	}
	const survivorRow = await tx.work.findUnique({
		where: { id: command.survivorId },
	});
	const duplicateRow = await tx.work.findUnique({
		where: { id: command.duplicateId },
	});
	if (
		!(survivorRow && duplicateRow) ||
		survivorRow.retiredIntoId ||
		duplicateRow.retiredIntoId
	) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, survivorRow.projectId);
	const replayed = await replayMergeOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const survivor = await loadWork(tx, survivorRow.id);
	const duplicate = await loadWork(tx, duplicateRow.id);
	if (!(survivor && duplicate)) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (survivor.projectId !== duplicate.projectId) {
		return { reason: "work-not-portable", status: "rejected" };
	}
	if (
		survivor.revision !== command.survivorBaseRevision ||
		duplicate.revision !== command.duplicateBaseRevision
	) {
		return {
			current: await viewFor(tx, survivor),
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	if (command.previewAcknowledged !== true) {
		return { reason: "merge-preview-required", status: "rejected" };
	}
	const survivorView = await viewFor(tx, survivor);
	const duplicateView = await viewFor(tx, duplicate);
	const chosen = chooseMergeFields(
		survivorView,
		duplicateView,
		command.fieldChoices
	);
	if (chosen.status !== "ok") {
		return { reason: "merge-conflicts-unresolved", status: "rejected" };
	}
	const nextFields = applyAttributedFields(survivor, chosen.attributed);
	if (nextFields.status === WORK_STATUS.closed && !nextFields.closureResult) {
		return { reason: "unknown-closure-result", status: "rejected" };
	}
	const moved = await rewriteDuplicateRelations(tx, survivor.id, duplicate.id);
	await tx.work.update({
		data: {
			closureResult: nextFields.closureResult,
			revision: survivor.revision + 1,
			status: nextFields.status,
			title: nextFields.title,
			type: nextFields.type,
		},
		where: { id: survivor.id },
	});
	await tx.work.update({
		data: { retiredIntoId: survivor.id },
		where: { id: duplicate.id },
	});
	const mergeEventId = crypto.randomUUID();
	const postMerge = await loadWork(tx, survivor.id);
	if (!postMerge) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await tx.workMergeEvent.create({
		data: {
			attributedFields: JSON.stringify(chosen.attributed),
			id: mergeEventId,
			movedRelations: JSON.stringify(moved),
			postMergeSurvivor: JSON.stringify(fieldSnapshot(postMerge)),
			previousSurvivor: JSON.stringify(fieldSnapshot(survivor)),
			retiredId: duplicate.id,
			retiredSnapshot: JSON.stringify(duplicate),
			survivorId: survivor.id,
		},
	});
	const work = await viewFor(tx, postMerge);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		work,
	});
	return {
		mergeEventId,
		status: "committed",
		undo: MUTATION_COPY.undo,
		work,
	};
}

function applyAttributedFields(
	survivor: WorkRow,
	attributed: Partial<Record<WorkMergeField, string>>
): {
	closureResult: string | null;
	status: string;
	title: string;
	type: string;
} {
	const nextFields = {
		closureResult: survivor.closureResult,
		status: survivor.status,
		title: survivor.title,
		type: survivor.type,
	};
	for (const field of WORK_MERGE_FIELDS) {
		const value = attributed[field];
		if (value === undefined) {
			continue;
		}
		if (field === "closureResult") {
			nextFields.closureResult = value.length === 0 ? null : value;
			continue;
		}
		nextFields[field] = value;
	}
	return nextFields;
}

async function rewriteDuplicateRelations(
	tx: PrismaTransaction,
	survivorId: string,
	duplicateId: string
): Promise<RewrittenWorkRelation[]> {
	const relations = await tx.workRelation.findMany({
		where: {
			OR: [{ fromId: duplicateId }, { toId: duplicateId }],
		},
	});
	const survivorRelations = await tx.workRelation.findMany({
		where: {
			OR: [{ fromId: survivorId }, { toId: survivorId }],
		},
	});
	const existingKeys = new Set(
		survivorRelations.map((row) => `${row.kind}:${row.fromId}:${row.toId}`)
	);
	const deleteIds: string[] = [];
	const updates: Array<{ fromId: string; id: string; toId: string }> = [];
	const moved: RewrittenWorkRelation[] = [];
	for (const relation of relations) {
		const rewrite = rewriteRelation(relation, survivorId, duplicateId);
		if (!rewrite) {
			continue;
		}
		moved.push({
			id: relation.id,
			kind: relation.kind,
			originalFromId: relation.fromId,
			originalToId: relation.toId,
			rewrittenFromId: rewrite.fromId,
			rewrittenToId: rewrite.toId,
		});
		if (rewrite.drop) {
			deleteIds.push(relation.id);
			continue;
		}
		const key = `${relation.kind}:${rewrite.fromId}:${rewrite.toId}`;
		if (existingKeys.has(key)) {
			deleteIds.push(relation.id);
			continue;
		}
		existingKeys.add(key);
		updates.push({
			fromId: rewrite.fromId,
			id: relation.id,
			toId: rewrite.toId,
		});
	}
	if (deleteIds.length > 0) {
		await tx.workRelation.deleteMany({ where: { id: { in: deleteIds } } });
	}
	await Promise.all(
		updates.map((update) =>
			tx.workRelation.update({
				data: { fromId: update.fromId, toId: update.toId },
				where: { id: update.id },
			})
		)
	);
	return moved;
}

function fieldSnapshot(row: WorkRow): Record<WorkMergeField, string | null> {
	return {
		closureResult: row.closureResult,
		status: row.status,
		title: row.title,
		type: row.type,
	};
}

async function replayMergeOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<WorkMergeOutcome | null> {
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
	if (!live) {
		const stored = storedWork(existing.resultValue);
		if (!stored) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return {
			mergeEventId: "",
			status: "replayed",
			undo: MUTATION_COPY.undo,
			work: stored,
		};
	}
	const event = await tx.workMergeEvent.findFirst({
		orderBy: { createdAt: "desc" },
		where: { survivorId: live.id },
	});
	return {
		mergeEventId: event?.id ?? "",
		status: "replayed",
		undo: MUTATION_COPY.undo,
		work: await viewFor(tx, live),
	};
}

async function undoMergeInTransaction(
	tx: PrismaTransaction,
	command: UndoWorkMergeCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkMergeOutcome> {
	const survivorRow = await tx.work.findUnique({
		where: { id: command.survivorId },
	});
	if (!survivorRow || survivorRow.retiredIntoId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, survivorRow.projectId);
	const replayed = await replayMergeOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const survivor = await loadWork(tx, survivorRow.id);
	if (!survivor) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (survivor.revision !== command.baseRevision) {
		return {
			current: await viewFor(tx, survivor),
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	const event = await tx.workMergeEvent.findUnique({
		where: { id: command.mergeEventId },
	});
	if (!event || event.survivorId !== survivor.id) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const attributed = parseAttributed(event.attributedFields);
	const postMerge = parseFieldSnapshot(event.postMergeSurvivor);
	const previous = parseFieldSnapshot(event.previousSurvivor);
	if (hasLaterAttributedWrite(survivor, attributed, postMerge)) {
		return {
			conflict: MUTATION_COPY.conflict,
			current: await viewFor(tx, survivor),
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "conflict",
		};
	}
	const retiredSnapshot = parseRetiredSnapshot(event.retiredSnapshot);
	if (!retiredSnapshot) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const restore: Record<string, string | null> = {};
	for (const field of Object.keys(attributed) as WorkMergeField[]) {
		restore[field] = previous[field] ?? null;
	}
	await tx.work.update({
		data: {
			closureResult:
				"closureResult" in restore
					? restore.closureResult
					: survivor.closureResult,
			revision: survivor.revision + 1,
			status:
				typeof restore.status === "string" ? restore.status : survivor.status,
			title: typeof restore.title === "string" ? restore.title : survivor.title,
			type: typeof restore.type === "string" ? restore.type : survivor.type,
		},
		where: { id: survivor.id },
	});
	await tx.work.update({
		data: {
			closureResult: retiredSnapshot.closureResult,
			retiredIntoId: null,
			status: retiredSnapshot.status,
			title: retiredSnapshot.title,
			type: retiredSnapshot.type,
		},
		where: { id: event.retiredId },
	});
	await restoreMovedRelations(tx, parseMovedRelations(event.movedRelations));
	await tx.workMergeEvent.delete({ where: { id: event.id } });
	const restored = await loadWork(tx, survivor.id);
	if (!restored) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const work = await viewFor(tx, restored);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		work,
	});
	return {
		mergeEventId: event.id,
		status: "committed",
		undo: MUTATION_COPY.undo,
		work,
	};
}

function hasLaterAttributedWrite(
	survivor: WorkRow,
	attributed: Partial<Record<WorkMergeField, string>>,
	postMerge: Partial<Record<WorkMergeField, string | null>>
): boolean {
	return (Object.keys(attributed) as WorkMergeField[]).some(
		(field) => mergeLiveValue(survivor, field) !== (postMerge[field] ?? "")
	);
}

async function restoreMovedRelations(
	tx: PrismaTransaction,
	moved: RewrittenWorkRelation[]
): Promise<void> {
	if (moved.length === 0) {
		return;
	}
	const existing = await tx.workRelation.findMany({
		where: { id: { in: moved.map((relation) => relation.id) } },
	});
	const existingIds = new Set(existing.map((row) => row.id));
	await Promise.all(
		moved.map((relation) => {
			if (existingIds.has(relation.id)) {
				return tx.workRelation.update({
					data: {
						fromId: relation.originalFromId,
						toId: relation.originalToId,
					},
					where: { id: relation.id },
				});
			}
			return tx.workRelation.create({
				data: {
					fromId: relation.originalFromId,
					id: relation.id,
					kind: relation.kind,
					toId: relation.originalToId,
				},
			});
		})
	);
}

function mergeLiveValue(row: WorkRow, field: WorkMergeField): string {
	if (field === "closureResult") {
		return row.closureResult ?? "";
	}
	return row[field];
}

function parseAttributed(
	text: string
): Partial<Record<WorkMergeField, string>> {
	try {
		const parsed: unknown = JSON.parse(text);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		const record = parsed as Record<string, unknown>;
		const attributed: Partial<Record<WorkMergeField, string>> = {};
		for (const field of WORK_MERGE_FIELDS) {
			if (typeof record[field] === "string") {
				attributed[field] = record[field];
			}
		}
		return attributed;
	} catch {
		return {};
	}
}

function parseFieldSnapshot(
	text: string
): Partial<Record<WorkMergeField, string | null>> {
	try {
		const parsed: unknown = JSON.parse(text);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		return parsed as Partial<Record<WorkMergeField, string | null>>;
	} catch {
		return {};
	}
}

function parseRetiredSnapshot(text: string): WorkRow | null {
	try {
		const parsed: unknown = JSON.parse(text);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return null;
		}
		const record = parsed as Record<string, unknown>;
		if (typeof record.id !== "string" || typeof record.key !== "string") {
			return null;
		}
		return {
			archived: record.archived === true,
			closureResult:
				typeof record.closureResult === "string" ? record.closureResult : null,
			description:
				typeof record.description === "string" ? record.description : null,
			id: record.id,
			includedInFeatureId:
				typeof record.includedInFeatureId === "string"
					? record.includedInFeatureId
					: null,
			key: record.key,
			lightChecklist: Array.isArray(record.lightChecklist)
				? record.lightChecklist
				: [],
			number: typeof record.number === "number" ? record.number : 0,
			originWork: null,
			originWorkId:
				typeof record.originWorkId === "string" ? record.originWorkId : null,
			portableRelations: Array.isArray(record.portableRelations)
				? record.portableRelations
				: [],
			primarySpecId:
				typeof record.primarySpecId === "string" ? record.primarySpecId : null,
			primarySpecTitle:
				typeof record.primarySpecTitle === "string"
					? record.primarySpecTitle
					: null,
			projectId: String(record.projectId),
			retiredIntoId:
				typeof record.retiredIntoId === "string" ? record.retiredIntoId : null,
			revision: typeof record.revision === "number" ? record.revision : 1,
			status: String(record.status),
			title: String(record.title),
			type: String(record.type),
		};
	} catch {
		return null;
	}
}

function parseMovedRelations(text: string): RewrittenWorkRelation[] {
	try {
		const parsed: unknown = JSON.parse(text);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter((row): row is RewrittenWorkRelation =>
			Boolean(
				row &&
					typeof row === "object" &&
					typeof (row as RewrittenWorkRelation).id === "string"
			)
		);
	} catch {
		return [];
	}
}

function asChecklist(value: Prisma.JsonValue): LightChecklistItem[] {
	const parsed = z.array(lightChecklistItemSchema).safeParse(value);
	return parsed.success ? parsed.data : [];
}

function asRelations(value: Prisma.JsonValue): WorkRelationView[] {
	const parsed = z.array(workRelationSchema).safeParse(value);
	return parsed.success ? parsed.data : [];
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
