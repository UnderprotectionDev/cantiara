import type { Prisma, PrismaClient } from "@cantiara/db";

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
	presentRiskStatus,
	RISK_EVENT_KIND,
	RISK_STATUS,
	type RiskStatus,
	type RiskView,
	type RiskWriteOutcome,
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
	await tx.riskEvent.create({
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
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { risk: view, status: "committed" };
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
	await tx.riskEvent.create({
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
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { risk: view, status: "committed" };
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
		return { risk: toView(live), status: "replayed" };
	}
	return { conflict: MUTATION_COPY.conflict, status: "conflict" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		view: RiskView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.view.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.view),
			targetId: input.view.id,
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
