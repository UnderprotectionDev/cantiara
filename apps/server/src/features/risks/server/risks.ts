import type { Prisma, PrismaClient } from "@cantiara/db";
import { FOCUS_PERIOD_STATUS } from "../../focus-period/server/focus-period-model";
import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";

import {
	type CreateRiskCommand,
	createRiskCommandSchema,
	OPEN_RISK_SIGNAL_ID,
	OPEN_RISK_SIGNAL_SECTION,
	OPEN_RISK_SOURCE_EVENT,
	type OpenRiskSignalView,
	presentRiskStatus,
	type RelateRiskCommand,
	type RelateRiskOutcome,
	RISK_EVENT_KIND,
	RISK_RELATED_KIND,
	RISK_STATUS,
	RISKS_COUNTERPARTS,
	type RiskRelatedRecordView,
	type RiskStatus,
	type RiskView,
	type RiskWriteOutcome,
	relateRiskCommandSchema,
	type SetRiskStatusCommand,
	setRiskStatusCommandSchema,
} from "./risks-model";

type PrismaTransaction = Prisma.TransactionClient;

interface RiskRow {
	acceptanceRationale: string | null;
	description: string;
	id: string;
	impact: string;
	probability: string;
	projectId: string;
	response: string;
	revision: number;
	status: string;
	title: string;
}

interface RiskAttentionSignalRow {
	id: string;
	impact: string;
	probability: string;
	riskId: string;
	section: string;
	signalId: string;
	sourceEventId: string;
	sourceEventKind: string;
}

interface RiskRelatedRecordRow {
	id: string;
	inPublishPrep: boolean | null;
	releaseStatus: string | null;
	riskId: string;
	targetId: string;
	targetKind: string;
}

export async function createRisk(
	prisma: PrismaClient,
	command: unknown
): Promise<RiskWriteOutcome> {
	const parsed = createRiskCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		createInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function setRiskStatus(
	prisma: PrismaClient,
	command: unknown
): Promise<RiskWriteOutcome> {
	const parsed = setRiskStatusCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (
		parsed.data.payload.status === RISK_STATUS.accepted &&
		(parsed.data.payload.rationale ?? "").trim() === ""
	) {
		return { reason: "rationale-required", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		rationale: parsed.data.payload.rationale ?? null,
		riskId: parsed.data.payload.riskId,
		status: parsed.data.payload.status,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		setStatusInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function getRisk(
	prisma: PrismaClient,
	riskId: string
): Promise<RiskView | null> {
	const row = await prisma.risk.findUnique({
		where: { id: riskId },
	});
	if (!row) {
		return null;
	}
	return toView(row);
}

export async function listRisks(
	prisma: PrismaClient,
	projectId: string,
	query: { status?: RiskStatus } = {}
): Promise<RiskView[]> {
	const rows = await prisma.risk.findMany({
		orderBy: { createdAt: "asc" },
		where: {
			projectId,
			...(query.status ? { status: query.status } : {}),
		},
	});
	return rows.map(toView);
}

export async function listOpenRiskSignals(
	prisma: PrismaClient,
	riskId: string
): Promise<OpenRiskSignalView[]> {
	if (!hasSignalDelegate(prisma)) {
		return [];
	}
	const rows = await prisma.riskAttentionSignal.findMany({
		orderBy: { createdAt: "asc" },
		where: { riskId, signalId: OPEN_RISK_SIGNAL_ID },
	});
	return rows.flatMap((row) => {
		const view = toSignalView(row);
		return view ? [view] : [];
	});
}

export async function listRiskRelatedRecords(
	prisma: PrismaClient,
	riskId: string
): Promise<RiskRelatedRecordView[]> {
	if (!hasRelatedDelegate(prisma)) {
		return [];
	}
	const rows = await prisma.riskRelatedRecord.findMany({
		orderBy: { createdAt: "asc" },
		where: { riskId },
	});
	return rows.flatMap((row) => {
		const view = toRelatedView(row);
		return view ? [view] : [];
	});
}

export async function relateRisk(
	prisma: PrismaClient,
	command: unknown
): Promise<RelateRiskOutcome> {
	const parsed = relateRiskCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		relateInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export function risksCounterparts() {
	return RISKS_COUNTERPARTS;
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateRiskCommand,
	commandKey: string,
	fingerprint: string
): Promise<RiskWriteOutcome> {
	await lockProject(tx, command.payload.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const created = await tx.risk.create({
		data: {
			description: command.payload.description,
			id: crypto.randomUUID(),
			impact: command.payload.impact,
			probability: command.payload.probability,
			projectId: command.payload.projectId,
			response: command.payload.response,
			revision: 1,
			status: RISK_STATUS.open,
			title: command.payload.title,
		},
	});
	const createdEvent = await tx.riskEvent.create({
		data: {
			actorId: command.actorId,
			id: crypto.randomUUID(),
			kind: RISK_EVENT_KIND.create,
			nextStatus: RISK_STATUS.open,
			previousStatus: null,
			riskId: created.id,
		},
	});
	const view = toView(created);
	const emissions = await emitEnteredOpen(tx, view, createdEvent.id);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		resultValue: JSON.stringify(view),
		revision: view.revision,
		targetId: view.id,
	});
	return { emissions, risk: view, status: "committed" };
}

async function setStatusInTransaction(
	tx: PrismaTransaction,
	command: SetRiskStatusCommand,
	commandKey: string,
	fingerprint: string
): Promise<RiskWriteOutcome> {
	const current = await tx.risk.findUnique({
		where: { id: command.payload.riskId },
	});
	if (!current) {
		return { reason: "risk-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.risk.findUnique({
		where: { id: current.id },
	});
	if (!locked) {
		return { reason: "risk-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const rationale = command.payload.rationale?.trim() || null;
	const accepted = command.payload.status === RISK_STATUS.accepted;
	const updated = await tx.risk.update({
		data: {
			acceptanceRationale: accepted ? rationale : locked.acceptanceRationale,
			revision: locked.revision + 1,
			status: command.payload.status,
		},
		where: { id: locked.id },
	});
	const statusEvent = await tx.riskEvent.create({
		data: {
			actorId: command.actorId,
			id: crypto.randomUUID(),
			kind: RISK_EVENT_KIND.setStatus,
			nextStatus: command.payload.status,
			previousStatus: locked.status,
			rationale,
			riskId: updated.id,
		},
	});
	const view = toView(updated);
	const emissions =
		command.payload.status === RISK_STATUS.open &&
		locked.status !== RISK_STATUS.open
			? await emitEnteredOpen(tx, view, statusEvent.id)
			: [];
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		resultValue: JSON.stringify(view),
		revision: view.revision,
		targetId: view.id,
	});
	return { emissions, risk: view, status: "committed" };
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<RiskWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.risk.findUnique({
		where: { id: existing.targetId },
	});
	if (live) {
		return {
			emissions: await listSignalsInTransaction(tx, live.id),
			risk: toView(live),
			status: "replayed",
		};
	}
	return { conflict: MUTATION_COPY.conflict, status: "conflict" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		resultValue: string;
		revision: number;
		targetId: string;
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
			resultValue: input.resultValue,
			targetId: input.targetId,
		},
	});
}

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`risks:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

function toView(row: RiskRow): RiskView {
	return {
		acceptanceRationale: row.acceptanceRationale,
		description: row.description,
		id: row.id,
		impact: row.impact,
		probability: row.probability,
		projectId: row.projectId,
		recordKind: "Risk",
		response: row.response,
		revision: row.revision,
		status: presentRiskStatus(row.status),
		title: row.title,
	};
}

function toSignalView(row: RiskAttentionSignalRow): OpenRiskSignalView | null {
	if (row.signalId !== OPEN_RISK_SIGNAL_ID) {
		return null;
	}
	if (row.section !== OPEN_RISK_SIGNAL_SECTION) {
		return null;
	}
	if (
		row.sourceEventKind !== OPEN_RISK_SOURCE_EVENT.enteredOpen &&
		row.sourceEventKind !==
			OPEN_RISK_SOURCE_EVENT.relatedToPublishPrepRelease &&
		row.sourceEventKind !== OPEN_RISK_SOURCE_EVENT.relatedToActiveFocusPeriod
	) {
		return null;
	}
	return {
		followUpWork: RISKS_COUNTERPARTS.followUpWork,
		healthVerdict: RISKS_COUNTERPARTS.healthVerdict,
		impact: row.impact,
		probability: row.probability,
		riskId: row.riskId,
		section: OPEN_RISK_SIGNAL_SECTION,
		signalId: OPEN_RISK_SIGNAL_ID,
		sourceEventId: row.sourceEventId,
		sourceEventKind: row.sourceEventKind,
	};
}

function toRelatedView(
	row: RiskRelatedRecordRow
): RiskRelatedRecordView | null {
	if (
		row.targetKind !== RISK_RELATED_KIND.projectRelease &&
		row.targetKind !== RISK_RELATED_KIND.focusPeriod
	) {
		return null;
	}
	return {
		id: row.id,
		inPublishPrep: row.inPublishPrep,
		releaseStatus: row.releaseStatus,
		riskId: row.riskId,
		targetId: row.targetId,
		targetKind: row.targetKind,
	};
}

function hasSignalDelegate(
	db: PrismaClient | PrismaTransaction
): db is PrismaClient | PrismaTransaction {
	const delegate = (
		db as unknown as {
			riskAttentionSignal?: { findMany?: unknown; create?: unknown };
		}
	).riskAttentionSignal;
	return typeof delegate?.findMany === "function";
}

function hasRelatedDelegate(
	db: PrismaClient | PrismaTransaction
): db is PrismaClient | PrismaTransaction {
	const delegate = (
		db as unknown as {
			riskRelatedRecord?: { findMany?: unknown; create?: unknown };
		}
	).riskRelatedRecord;
	return typeof delegate?.findMany === "function";
}

async function listSignalsInTransaction(
	tx: PrismaTransaction,
	riskId: string
): Promise<OpenRiskSignalView[]> {
	if (!hasSignalDelegate(tx)) {
		return [];
	}
	const rows = await tx.riskAttentionSignal.findMany({
		orderBy: { createdAt: "asc" },
		where: { riskId, signalId: OPEN_RISK_SIGNAL_ID },
	});
	return rows.flatMap((row) => {
		const view = toSignalView(row);
		return view ? [view] : [];
	});
}

async function emitOpenRisk(
	tx: PrismaTransaction,
	input: {
		risk: RiskView;
		sourceEventId: string;
		sourceEventKind: OpenRiskSignalView["sourceEventKind"];
	}
): Promise<OpenRiskSignalView[]> {
	if (!hasSignalDelegate(tx)) {
		return [];
	}
	const existing = await tx.riskAttentionSignal.findUnique({
		where: {
			signalId_sourceEventId: {
				signalId: OPEN_RISK_SIGNAL_ID,
				sourceEventId: input.sourceEventId,
			},
		},
	});
	if (existing) {
		const view = toSignalView(existing);
		return view ? [view] : [];
	}
	const created = await tx.riskAttentionSignal.create({
		data: {
			id: crypto.randomUUID(),
			impact: input.risk.impact,
			probability: input.risk.probability,
			riskId: input.risk.id,
			section: OPEN_RISK_SIGNAL_SECTION,
			signalId: OPEN_RISK_SIGNAL_ID,
			sourceEventId: input.sourceEventId,
			sourceEventKind: input.sourceEventKind,
		},
	});
	const view = toSignalView(created);
	return view ? [view] : [];
}

async function emitEnteredOpen(
	tx: PrismaTransaction,
	risk: RiskView,
	sourceEventId: string
): Promise<OpenRiskSignalView[]> {
	return await emitOpenRisk(tx, {
		risk,
		sourceEventId,
		sourceEventKind: OPEN_RISK_SOURCE_EVENT.enteredOpen,
	});
}

async function replayRelateReceipt(
	tx: PrismaTransaction,
	riskId: string,
	commandKey: string,
	fingerprint: string
): Promise<RelateRiskOutcome | null> {
	const existingReceipt = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existingReceipt) {
		return null;
	}
	if (existingReceipt.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (!hasRelatedDelegate(tx)) {
		return { reason: "risk-not-found", status: "rejected" };
	}
	const related = await tx.riskRelatedRecord.findUnique({
		where: { id: existingReceipt.targetId },
	});
	const view = related ? toRelatedView(related) : null;
	if (!view) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return {
		emissions: await listSignalsInTransaction(tx, riskId),
		related: view,
		status: "replayed",
	};
}

async function commitExistingRelated(
	tx: PrismaTransaction,
	command: RelateRiskCommand,
	commandKey: string,
	fingerprint: string,
	existingRelated: RiskRelatedRecordRow
): Promise<RelateRiskOutcome> {
	const related = toRelatedView(existingRelated);
	if (!related) {
		return { reason: "invalid-command", status: "rejected" };
	}
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		resultValue: JSON.stringify(related),
		revision: 1,
		targetId: existingRelated.id,
	});
	return { emissions: [], related, status: "committed" };
}

async function resolveRelateLink(
	tx: PrismaTransaction,
	risk: RiskRow,
	payload: RelateRiskCommand["payload"]
): Promise<
	| {
			emitKind: OpenRiskSignalView["sourceEventKind"] | null;
			inPublishPrep: boolean | null;
			releaseStatus: string | null;
			status: "ok";
	  }
	| { reason: "focus-period-not-found"; status: "rejected" }
> {
	if (payload.kind === RISK_RELATED_KIND.projectRelease) {
		const { inPublishPrep, releaseStatus } = payload;
		const emitKind =
			risk.status === RISK_STATUS.open && inPublishPrep
				? OPEN_RISK_SOURCE_EVENT.relatedToPublishPrepRelease
				: null;
		return {
			emitKind,
			inPublishPrep,
			releaseStatus: releaseStatus ?? null,
			status: "ok",
		};
	}
	const period = await tx.focusPeriod.findUnique({
		where: { id: payload.targetId },
	});
	if (!period) {
		return { reason: "focus-period-not-found", status: "rejected" };
	}
	const emitKind =
		risk.status === RISK_STATUS.open &&
		period.status === FOCUS_PERIOD_STATUS.active
			? OPEN_RISK_SOURCE_EVENT.relatedToActiveFocusPeriod
			: null;
	return {
		emitKind,
		inPublishPrep: null,
		releaseStatus: null,
		status: "ok",
	};
}

async function relateInTransaction(
	tx: PrismaTransaction,
	command: RelateRiskCommand,
	commandKey: string,
	fingerprint: string
): Promise<RelateRiskOutcome> {
	const current = await tx.risk.findUnique({
		where: { id: command.payload.riskId },
	});
	if (!current) {
		return { reason: "risk-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayRelateReceipt(
		tx,
		current.id,
		commandKey,
		fingerprint
	);
	if (replayed) {
		return replayed;
	}
	if (!hasRelatedDelegate(tx)) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const existingRelated = await tx.riskRelatedRecord.findUnique({
		where: {
			riskId_targetKind_targetId: {
				riskId: current.id,
				targetId: command.payload.targetId,
				targetKind: command.payload.kind,
			},
		},
	});
	if (existingRelated) {
		return await commitExistingRelated(
			tx,
			command,
			commandKey,
			fingerprint,
			existingRelated
		);
	}
	const link = await resolveRelateLink(tx, current, command.payload);
	if (link.status === "rejected") {
		return { reason: link.reason, status: "rejected" };
	}
	const created = await tx.riskRelatedRecord.create({
		data: {
			id: crypto.randomUUID(),
			inPublishPrep: link.inPublishPrep,
			releaseStatus: link.releaseStatus,
			riskId: current.id,
			targetId: command.payload.targetId,
			targetKind: command.payload.kind,
		},
	});
	const related = toRelatedView(created);
	if (!related) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const emissions = link.emitKind
		? await emitOpenRisk(tx, {
				risk: toView(current),
				sourceEventId: created.id,
				sourceEventKind: link.emitKind,
			})
		: [];
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		resultValue: JSON.stringify(related),
		revision: 1,
		targetId: created.id,
	});
	return { emissions, related, status: "committed" };
}
