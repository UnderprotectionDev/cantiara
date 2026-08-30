import type { Prisma, PrismaClient } from "@cantiara/db";
import { z } from "zod";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { markProjectHasWork } from "../../project-shell/server/project-shell";
import { createRelationInTransaction } from "../../relations/server/relations";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	DEFAULT_WORK_TYPE,
	workKey,
} from "../../work-lifecycle/server/work-lifecycle-model";
import {
	type ConfirmReconcileCommand,
	type ConfirmReconcileOutcome,
	confirmReconcileCommandSchema,
	EXTERNAL_HANDOFFS_COPY,
	type ExternalExecutionHandoffView,
	externalExecutionHandoffViewSchema,
	type GithubContext,
	githubContextSchema,
	HANDOFF_STATUS,
	HANDOFF_STATUSES,
	type HandoffStatus,
	type HandoffWriteOutcome,
	type PreviewReconcileOutcome,
	type ReconcileDecision,
	type ReconcilePreview,
	type RecordReturnCommand,
	type RejectReconcileCommand,
	type ReturnRecord,
	reconcileDecisionSchema,
	recordReturnCommandSchema,
	rejectReconcileCommandSchema,
	returnRecordSchema,
	type SelectedVersion,
	type StartHandoffCommand,
	type StartHandoffOutcome,
	selectedVersionSchema,
	startHandoffCommandSchema,
} from "./external-handoffs-model";

type PrismaTransaction = Prisma.TransactionClient;

interface HandoffRow {
	constraints: string;
	executorVisibleName: string;
	expectedOutput: string;
	goingPackageMarkdown: string;
	goingPackageProducedAt: Date;
	id: string;
	permittedGithubContext: Prisma.JsonValue;
	purpose: string;
	reconcileDecision: Prisma.JsonValue | null;
	returnRecord: Prisma.JsonValue | null;
	revision: number;
	selectedVersionManifest: Prisma.JsonValue;
	status: string;
	workId: string;
}

class ConfirmRollback extends Error {
	reason: string;

	constructor(reason: string) {
		super(reason);
		this.reason = reason;
	}
}

export async function startHandoff(
	prisma: PrismaClient,
	command: unknown
): Promise<StartHandoffOutcome> {
	const parsed = startHandoffCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		startInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function recordReturn(
	prisma: PrismaClient,
	command: unknown
): Promise<HandoffWriteOutcome> {
	const parsed = recordReturnCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		recordReturnInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function previewReconcile(
	prisma: PrismaClient,
	handoffId: string
): Promise<PreviewReconcileOutcome> {
	const row = await prisma.externalExecutionHandoff.findUnique({
		where: { id: handoffId },
	});
	if (!row || row.status !== HANDOFF_STATUS.resultReturned) {
		return { reason: "handoff-not-ready", status: "rejected" };
	}
	const returnRecord = parseReturnRecord(row.returnRecord);
	if (!returnRecord) {
		return { reason: "handoff-not-ready", status: "rejected" };
	}
	return { preview: toPreview(returnRecord), status: "ok" };
}

export async function confirmReconcile(
	prisma: PrismaClient,
	command: unknown
): Promise<ConfirmReconcileOutcome> {
	const parsed = confirmReconcileCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.payload.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	try {
		return await prisma.$transaction((tx) =>
			confirmInTransaction(tx, parsed.data, commandKey, fingerprint)
		);
	} catch (error) {
		if (error instanceof ConfirmRollback) {
			return { reason: error.reason, status: "rejected" };
		}
		throw error;
	}
}

export async function rejectReconcile(
	prisma: PrismaClient,
	command: unknown
): Promise<HandoffWriteOutcome> {
	const parsed = rejectReconcileCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		rejectInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function listHandoffsForWork(
	prisma: PrismaClient,
	workId: string
): Promise<ExternalExecutionHandoffView[]> {
	const work = await getWork(prisma, workId);
	if (!work) {
		return [];
	}
	const rows = await prisma.externalExecutionHandoff.findMany({
		orderBy: { createdAt: "asc" },
		where: { workId },
	});
	return rows.flatMap((row) => {
		const view = toView(row, work.key);
		return view ? [view] : [];
	});
}

async function startInTransaction(
	tx: PrismaTransaction,
	command: StartHandoffCommand,
	commandKey: string,
	fingerprint: string
): Promise<StartHandoffOutcome> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const replayed = storedView(existing.resultValue);
		if (!replayed) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return { handoff: replayed, status: "replayed" };
	}
	const work = await tx.work.findUnique({
		where: { id: command.payload.workId },
	});
	if (!work || work.retiredIntoId) {
		return { reason: "work-not-found", status: "rejected" };
	}
	const selectedVersions = await resolveSelectedVersions(
		tx,
		work.projectId,
		command.payload.selectedVersions
	);
	const permittedGithubContext = (command.payload.permittedGithubContext ?? [])
		.map((item) => item.identifier.trim())
		.filter((identifier) => identifier.length > 0)
		.map((identifier) => ({ identifier }));
	const producedAt = new Date();
	const id = crypto.randomUUID();
	const markdown = renderGoingPackage({
		constraints: command.payload.constraints,
		executorVisibleName: command.payload.executorVisibleName,
		expectedOutput: command.payload.expectedOutput,
		handoffId: id,
		permittedGithubContext,
		producedAt,
		purpose: command.payload.purpose,
		selectedVersions,
		workKey: work.key,
	});
	const created = await tx.externalExecutionHandoff.create({
		data: {
			constraints: command.payload.constraints,
			executorVisibleName: command.payload.executorVisibleName,
			expectedOutput: command.payload.expectedOutput,
			goingPackageMarkdown: markdown,
			goingPackageProducedAt: producedAt,
			id,
			permittedGithubContext,
			purpose: command.payload.purpose,
			revision: 1,
			selectedVersionManifest: selectedVersions,
			status: HANDOFF_STATUS.open,
			workId: work.id,
		},
	});
	const view = toView(created, work.key);
	if (!view) {
		return { reason: "invalid-handoff", status: "rejected" };
	}
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		revision: created.revision,
		targetId: created.id,
		view,
	});
	return { handoff: view, status: "committed" };
}

async function recordReturnInTransaction(
	tx: PrismaTransaction,
	command: RecordReturnCommand,
	commandKey: string,
	fingerprint: string
): Promise<HandoffWriteOutcome> {
	const replayed = await replayHandoff(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const loaded = await loadOwnedHandoff(tx, command.payload.handoffId);
	if (!loaded) {
		return { reason: "handoff-not-found", status: "rejected" };
	}
	if (
		loaded.row.status !== HANDOFF_STATUS.open &&
		loaded.row.status !== HANDOFF_STATUS.resultReturned
	) {
		return { reason: "handoff-not-open", status: "rejected" };
	}
	const returnRecord = toReturnRecord(command);
	const updated = await tx.externalExecutionHandoff.update({
		data: {
			returnRecord,
			revision: loaded.row.revision + 1,
			status: HANDOFF_STATUS.resultReturned,
		},
		where: { id: loaded.row.id },
	});
	const view = toView(updated, loaded.work.key);
	if (!view) {
		return { reason: "invalid-handoff", status: "rejected" };
	}
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		revision: updated.revision,
		targetId: updated.id,
		view,
	});
	return { handoff: view, status: "committed" };
}

async function confirmInTransaction(
	tx: PrismaTransaction,
	command: ConfirmReconcileCommand,
	commandKey: string,
	fingerprint: string
): Promise<ConfirmReconcileOutcome> {
	const replayed = await replayHandoff(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const loaded = await loadOwnedHandoff(tx, command.payload.handoffId);
	if (!loaded) {
		throw new ConfirmRollback("handoff-not-found");
	}
	if (loaded.row.status !== HANDOFF_STATUS.resultReturned) {
		throw new ConfirmRollback("handoff-not-ready");
	}
	const returnRecord = parseReturnRecord(loaded.row.returnRecord);
	if (!returnRecord) {
		throw new ConfirmRollback("handoff-not-ready");
	}
	const selectedRelations = pickProposed(
		returnRecord.proposedRelations,
		command.payload.selectedRelationIds
	);
	const selectedFollowUps = pickProposed(
		returnRecord.proposedFollowUpWork,
		command.payload.selectedFollowUpWorkIds
	);
	if (!(selectedRelations && selectedFollowUps)) {
		throw new ConfirmRollback("unknown-preview-item");
	}
	const project = await tx.project.findUnique({
		where: { id: loaded.work.projectId },
	});
	if (!project) {
		throw new ConfirmRollback("work-not-found");
	}
	const writtenFollowUpWorkIds = await writeChosenFollowUps(
		tx,
		command,
		loaded.work.id,
		project,
		selectedFollowUps
	);
	const writtenRelationIds = await writeChosenRelations(
		tx,
		command,
		loaded.work.id,
		project,
		selectedRelations
	);
	const decision: ReconcileDecision = {
		confirmedAt: new Date().toISOString(),
		kind: EXTERNAL_HANDOFFS_COPY.reconcile,
		selectedFollowUpWorkIds: command.payload.selectedFollowUpWorkIds,
		selectedRelationIds: command.payload.selectedRelationIds,
		writtenFollowUpWorkIds,
		writtenRelationIds,
	};
	const updated = await tx.externalExecutionHandoff.update({
		data: {
			reconcileDecision: decision,
			revision: loaded.row.revision + 1,
			status: HANDOFF_STATUS.reconciled,
		},
		where: { id: loaded.row.id },
	});
	const view = toView(updated, loaded.work.key);
	if (!view) {
		throw new ConfirmRollback("invalid-handoff");
	}
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		revision: updated.revision,
		targetId: updated.id,
		view,
	});
	return { handoff: view, status: "committed" };
}

async function writeChosenFollowUps(
	tx: PrismaTransaction,
	command: ConfirmReconcileCommand,
	fromWorkId: string,
	project: { id: string; shortCode: string; workspaceId: string },
	selectedFollowUps: Array<{ id: string; title: string }>
): Promise<string[]> {
	const writtenFollowUpWorkIds: string[] = [];
	for (const followUp of selectedFollowUps) {
		// biome-ignore lint/performance/noAwaitInLoops: follow-up Work keys must allocate sequentially.
		const createdId = await createFollowUpWork(tx, project, followUp.title);
		writtenFollowUpWorkIds.push(createdId);
		const related = await createRelationInTransaction(tx, {
			actorId: command.actorId,
			from: { id: fromWorkId, kind: "Work" },
			idempotencyKey: `${command.idempotencyKey}:follow-up:${followUp.id}`,
			origin: HUMAN_ORIGIN,
			previewAcknowledged: true,
			to: { id: createdId, kind: "Work" },
			type: EXTERNAL_HANDOFFS_COPY.related,
			viewerWorkspaceId: project.workspaceId,
		});
		if (related.status !== "committed" && related.status !== "replayed") {
			throw new ConfirmRollback("relation-write-failed");
		}
	}
	return writtenFollowUpWorkIds;
}

async function writeChosenRelations(
	tx: PrismaTransaction,
	command: ConfirmReconcileCommand,
	fromWorkId: string,
	project: { id: string; workspaceId: string },
	selectedRelations: Array<{ id: string; toId: string }>
): Promise<string[]> {
	const targetIds = selectedRelations.map((relation) => relation.toId);
	const targets =
		targetIds.length === 0
			? []
			: await tx.work.findMany({
					where: {
						id: { in: targetIds },
						projectId: project.id,
						retiredIntoId: null,
					},
				});
	const liveIds = new Set(targets.map((row) => row.id));
	if (liveIds.size !== new Set(targetIds).size) {
		throw new ConfirmRollback("unknown-preview-item");
	}
	const writtenRelationIds: string[] = [];
	for (const relation of selectedRelations) {
		// biome-ignore lint/performance/noAwaitInLoops: relation writes share one transaction and stay sequential.
		const created = await createRelationInTransaction(tx, {
			actorId: command.actorId,
			from: { id: fromWorkId, kind: "Work" },
			idempotencyKey: `${command.idempotencyKey}:relation:${relation.id}`,
			origin: HUMAN_ORIGIN,
			previewAcknowledged: true,
			to: { id: relation.toId, kind: "Work" },
			type: EXTERNAL_HANDOFFS_COPY.related,
			viewerWorkspaceId: project.workspaceId,
		});
		if (created.status !== "committed" && created.status !== "replayed") {
			throw new ConfirmRollback("relation-write-failed");
		}
		writtenRelationIds.push(created.relation.id);
	}
	return writtenRelationIds;
}

async function rejectInTransaction(
	tx: PrismaTransaction,
	command: RejectReconcileCommand,
	commandKey: string,
	fingerprint: string
): Promise<HandoffWriteOutcome> {
	const replayed = await replayHandoff(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const loaded = await loadOwnedHandoff(tx, command.payload.handoffId);
	if (!loaded) {
		return { reason: "handoff-not-found", status: "rejected" };
	}
	if (loaded.row.status !== HANDOFF_STATUS.resultReturned) {
		return { reason: "handoff-not-ready", status: "rejected" };
	}
	const view = toView(loaded.row, loaded.work.key);
	if (!view) {
		return { reason: "invalid-handoff", status: "rejected" };
	}
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		revision: loaded.row.revision,
		targetId: loaded.row.id,
		view,
	});
	return { handoff: view, status: "committed" };
}

function toReturnRecord(command: RecordReturnCommand): ReturnRecord {
	return {
		changedAssumptions: command.payload.changedAssumptions,
		executorSummary: command.payload.executorSummary,
		openQuestions: command.payload.openQuestions,
		permittedExternalLinks: (command.payload.permittedExternalLinks ?? [])
			.map((item) => item.identifier.trim())
			.filter((identifier) => identifier.length > 0)
			.map((identifier) => ({ identifier })),
		producedEvidence: command.payload.producedEvidence,
		proposedFollowUpWork: command.payload.proposedFollowUpWork ?? [],
		proposedRelations: command.payload.proposedRelations ?? [],
	};
}

function toPreview(returnRecord: ReturnRecord): ReconcilePreview {
	return {
		copy: {
			confirm: EXTERNAL_HANDOFFS_COPY.confirm,
			followUpWork: EXTERNAL_HANDOFFS_COPY.followUpWork,
			reconcile: EXTERNAL_HANDOFFS_COPY.reconcile,
			reject: EXTERNAL_HANDOFFS_COPY.reject,
			related: EXTERNAL_HANDOFFS_COPY.related,
		},
		followUpWork: returnRecord.proposedFollowUpWork,
		gitMerge: false,
		importWizard: false,
		relations: returnRecord.proposedRelations,
	};
}

function pickProposed<T extends { id: string }>(
	items: T[],
	selectedIds: string[]
): T[] | null {
	const byId = new Map(items.map((item) => [item.id, item]));
	const picked: T[] = [];
	for (const id of selectedIds) {
		const item = byId.get(id);
		if (!item) {
			return null;
		}
		picked.push(item);
	}
	return picked;
}

async function createFollowUpWork(
	tx: PrismaTransaction,
	project: { id: string; shortCode: string },
	title: string
): Promise<string> {
	const number = await allocateFollowUpNumber(tx, project.id);
	const id = crypto.randomUUID();
	await tx.work.create({
		data: {
			id,
			key: workKey(project.shortCode, number),
			number,
			projectId: project.id,
			revision: 1,
			status: "Not Started",
			title,
			type: DEFAULT_WORK_TYPE,
		},
	});
	await markProjectHasWork(tx, project.id);
	return id;
}

async function allocateFollowUpNumber(
	tx: PrismaTransaction,
	projectId: string
): Promise<number> {
	const [lockA, lockB] = advisoryKeys(`project-shell:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
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

async function loadOwnedHandoff(
	tx: PrismaTransaction,
	handoffId: string
): Promise<{
	row: HandoffRow;
	work: { id: string; key: string; projectId: string };
} | null> {
	const row = await tx.externalExecutionHandoff.findUnique({
		where: { id: handoffId },
	});
	if (!row) {
		return null;
	}
	const work = await tx.work.findUnique({
		where: { id: row.workId },
	});
	if (!work || work.retiredIntoId) {
		return null;
	}
	return { row, work };
}

async function replayHandoff(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<HandoffWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const replayed = storedView(existing.resultValue);
	if (!replayed) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { handoff: replayed, status: "replayed" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		revision: number;
		targetId: string;
		view: ExternalExecutionHandoffView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.view),
			targetId: input.targetId,
		},
	});
}

function sanitizeSelectedVersions(
	versions: SelectedVersion[]
): SelectedVersion[] {
	return versions.map((version) => {
		const fields = (version.fields ?? []).filter(
			(field) => !(field.inaccessible || field.secret)
		);
		return {
			...(version.body ? { body: version.body } : {}),
			...(fields.length > 0 ? { fields } : {}),
			kind: version.kind,
			recordId: version.recordId,
			title: version.title,
			versionId: version.versionId,
		};
	});
}

async function resolveSelectedVersions(
	tx: PrismaTransaction,
	projectId: string,
	versions: SelectedVersion[]
): Promise<SelectedVersion[]> {
	const sanitized = sanitizeSelectedVersions(versions);
	const workIds = sanitized
		.filter((version) => version.kind === "Work")
		.map((version) => version.recordId);
	const liveWorks =
		workIds.length === 0
			? []
			: await tx.work.findMany({
					where: {
						id: { in: workIds },
						projectId,
					},
				});
	const liveById = new Map(
		liveWorks.filter((row) => !row.retiredIntoId).map((row) => [row.id, row])
	);
	return sanitized.flatMap((version) => {
		if (version.kind !== "Work") {
			return [version];
		}
		const live = liveById.get(version.recordId);
		if (!live) {
			return [];
		}
		const body = live.description ?? version.body;
		return [
			{
				...(body ? { body } : {}),
				...(version.fields && version.fields.length > 0
					? { fields: version.fields }
					: {}),
				kind: version.kind,
				recordId: live.id,
				title: live.title,
				versionId: String(live.revision),
			},
		];
	});
}

function renderGoingPackage(input: {
	constraints: string;
	executorVisibleName: string;
	expectedOutput: string;
	handoffId: string;
	permittedGithubContext: GithubContext[];
	producedAt: Date;
	purpose: string;
	selectedVersions: SelectedVersion[];
	workKey: string;
}): string {
	const selected = input.selectedVersions.map((version) => {
		const fieldLines = (version.fields ?? []).map(
			(field) => `${field.name}: ${field.value}`
		);
		const body = [version.body, ...fieldLines].filter(Boolean).join("\n");
		return [`### ${version.kind} ${version.title} (${version.versionId})`, body]
			.filter((part) => part.length > 0)
			.join("\n");
	});
	const github = input.permittedGithubContext.map(
		(item) => `- ${item.identifier}`
	);
	return [
		`# ${EXTERNAL_HANDOFFS_COPY.externalExecutionHandoff}`,
		"",
		`Work: ${input.workKey}`,
		`${EXTERNAL_HANDOFFS_COPY.handoff}: ${input.handoffId}`,
		`${EXTERNAL_HANDOFFS_COPY.producedAt}: ${input.producedAt.toISOString()}`,
		EXTERNAL_HANDOFFS_COPY.sourceOfTruth,
		"",
		`## ${EXTERNAL_HANDOFFS_COPY.purpose}`,
		input.purpose,
		"",
		`## ${EXTERNAL_HANDOFFS_COPY.expectedOutput}`,
		input.expectedOutput,
		"",
		`## ${EXTERNAL_HANDOFFS_COPY.executor}`,
		input.executorVisibleName,
		"",
		`## ${EXTERNAL_HANDOFFS_COPY.constraints}`,
		input.constraints,
		"",
		`## ${EXTERNAL_HANDOFFS_COPY.selectedVersions}`,
		...selected,
		"",
		`## ${EXTERNAL_HANDOFFS_COPY.github}`,
		...github,
	].join("\n");
}

function toView(
	row: HandoffRow,
	workKeyValue: string
): ExternalExecutionHandoffView | null {
	if (!isHandoffStatus(row.status)) {
		return null;
	}
	const selectedVersions = parseSelectedVersions(row.selectedVersionManifest);
	const permittedGithubContext = parseGithubContext(row.permittedGithubContext);
	if (!(selectedVersions && permittedGithubContext)) {
		return null;
	}
	const returnRecord =
		row.returnRecord === null ? null : parseReturnRecord(row.returnRecord);
	if (row.returnRecord !== null && returnRecord === null) {
		return null;
	}
	const reconcileDecision =
		row.reconcileDecision === null
			? null
			: parseReconcileDecision(row.reconcileDecision);
	if (row.reconcileDecision !== null && reconcileDecision === null) {
		return null;
	}
	return {
		constraints: row.constraints,
		copy: {
			confirm: EXTERNAL_HANDOFFS_COPY.confirm,
			externalExecutionHandoff: EXTERNAL_HANDOFFS_COPY.externalExecutionHandoff,
			followUpWork: EXTERNAL_HANDOFFS_COPY.followUpWork,
			open: EXTERNAL_HANDOFFS_COPY.open,
			reconcile: EXTERNAL_HANDOFFS_COPY.reconcile,
			reconciled: EXTERNAL_HANDOFFS_COPY.reconciled,
			recordReturn: EXTERNAL_HANDOFFS_COPY.recordReturn,
			reject: EXTERNAL_HANDOFFS_COPY.reject,
			resultReturned: EXTERNAL_HANDOFFS_COPY.resultReturned,
			sourceOfTruth: EXTERNAL_HANDOFFS_COPY.sourceOfTruth,
			startHandoff: EXTERNAL_HANDOFFS_COPY.startHandoff,
		},
		executorVisibleName: row.executorVisibleName,
		expectedOutput: row.expectedOutput,
		goingPackage: {
			liveSync: false,
			markdown: row.goingPackageMarkdown,
			producedAt: row.goingPackageProducedAt.toISOString(),
			publishArtifact: false,
			repositoryCopy: false,
		},
		id: row.id,
		identity: {
			independentLifecycle: false,
			independentMainRecord: false,
			ownedByWorkId: row.workId,
			searchableApartFromWork: false,
			shareableApartFromWork: false,
		},
		permittedGithubContext,
		purpose: row.purpose,
		reconcileDecision,
		returnRecord,
		runner: {
			ci: false,
			externalAgent: false,
			ide: false,
			repository: false,
			telemetry: false,
			terminal: false,
		},
		selectedVersions,
		status: row.status,
		workId: row.workId,
		workKey: workKeyValue,
	};
}

function isHandoffStatus(value: string): value is HandoffStatus {
	return (HANDOFF_STATUSES as readonly string[]).includes(value);
}

function parseSelectedVersions(
	value: Prisma.JsonValue
): SelectedVersion[] | null {
	const parsed = z.array(selectedVersionSchema).safeParse(value);
	return parsed.success ? parsed.data : null;
}

function parseGithubContext(value: Prisma.JsonValue): GithubContext[] | null {
	const parsed = z.array(githubContextSchema).safeParse(value);
	return parsed.success ? parsed.data : null;
}

function parseReturnRecord(
	value: Prisma.JsonValue | null
): ReturnRecord | null {
	const parsed = returnRecordSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

function parseReconcileDecision(
	value: Prisma.JsonValue | null
): ReconcileDecision | null {
	const parsed = reconcileDecisionSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

function storedView(value: string): ExternalExecutionHandoffView | null {
	try {
		return externalExecutionHandoffViewSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
