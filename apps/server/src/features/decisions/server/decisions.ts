import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";

import {
	type CreateDecisionCommand,
	createDecisionCommandSchema,
	DECISION_EVENT_KIND,
	DECISION_LIFE,
	type DecisionView,
	type DecisionWriteOutcome,
	importedDecisionLife,
	ingestImportedDecisionCommandSchema,
	presentDecisionLife,
	setDecisionLifeCommandSchema,
	type WithdrawDecisionCommand,
	withdrawDecisionCommandSchema,
} from "./decisions-model";

type PrismaTransaction = Prisma.TransactionClient;

interface DecisionRow {
	decisionText: string;
	id: string;
	life: string;
	projectId: string;
	rationale: string;
	revision: number;
	title: string;
	withdrawnAt: Date | null;
	withdrawnRationale: string | null;
}

export async function createDecision(
	prisma: PrismaClient,
	command: unknown
): Promise<DecisionWriteOutcome> {
	const parsed = createDecisionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await writeCreate(prisma, parsed.data, DECISION_LIFE.valid);
}

export async function ingestImportedDecision(
	prisma: PrismaClient,
	command: unknown
): Promise<DecisionWriteOutcome> {
	const parsed = ingestImportedDecisionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await writeCreate(
		prisma,
		{
			actorId: parsed.data.actorId,
			idempotencyKey: parsed.data.idempotencyKey,
			origin: parsed.data.origin,
			payload: {
				decision: parsed.data.payload.decision,
				projectId: parsed.data.payload.projectId,
				rationale: parsed.data.payload.rationale,
				title: parsed.data.payload.title,
			},
		},
		importedDecisionLife(parsed.data.payload.life)
	);
}

export async function withdrawDecision(
	prisma: PrismaClient,
	command: unknown
): Promise<DecisionWriteOutcome> {
	const parsed = withdrawDecisionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		decisionId: parsed.data.payload.decisionId,
		rationale: parsed.data.payload.rationale ?? null,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		withdrawInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function setDecisionLife(
	prisma: PrismaClient,
	command: unknown
): Promise<DecisionWriteOutcome> {
	const parsed = setDecisionLifeCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const current = await prisma.decision.findUnique({
		where: { id: parsed.data.payload.decisionId },
	});
	if (!current) {
		return { reason: "decision-not-found", status: "rejected" };
	}
	if (parsed.data.payload.life === DECISION_LIFE.superseded) {
		return { reason: "superseded-requires-relation", status: "rejected" };
	}
	return { reason: "life-not-selectable", status: "rejected" };
}

export async function getDecision(
	prisma: PrismaClient,
	decisionId: string
): Promise<DecisionView | null> {
	const row = await prisma.decision.findUnique({
		where: { id: decisionId },
	});
	return row ? toView(row) : null;
}

export async function listDecisions(
	prisma: PrismaClient,
	projectId: string
): Promise<DecisionView[]> {
	const rows = await prisma.decision.findMany({
		orderBy: { createdAt: "asc" },
		where: { projectId },
	});
	return rows.map(toView);
}

async function writeCreate(
	prisma: PrismaClient,
	command: CreateDecisionCommand,
	life: ReturnType<typeof presentDecisionLife>
): Promise<DecisionWriteOutcome> {
	const fingerprint = payloadFingerprint({
		...command.payload,
		life,
	});
	const commandKey = commandKeyFor(command.actorId, command.idempotencyKey);
	return await prisma.$transaction((tx) =>
		createInTransaction(tx, command, commandKey, fingerprint, life)
	);
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateDecisionCommand,
	commandKey: string,
	fingerprint: string,
	life: ReturnType<typeof presentDecisionLife>
): Promise<DecisionWriteOutcome> {
	await lockProject(tx, command.payload.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const withdrawn = life === DECISION_LIFE.withdrawn;
	const withdrawnAt = withdrawn ? new Date() : null;
	const created = await tx.decision.create({
		data: {
			decisionText: command.payload.decision,
			id: crypto.randomUUID(),
			life,
			projectId: command.payload.projectId,
			rationale: command.payload.rationale,
			revision: 1,
			title: command.payload.title,
			withdrawnAt,
			withdrawnRationale: withdrawn ? command.payload.rationale : null,
		},
	});
	await tx.decisionEvent.create({
		data: {
			actorId: command.actorId,
			decisionId: created.id,
			id: crypto.randomUUID(),
			kind: DECISION_EVENT_KIND.create,
			nextLife: life,
			previousLife: null,
			rationale: command.payload.rationale,
		},
	});
	const view = toView(created);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { decision: view, status: "committed" };
}

async function withdrawInTransaction(
	tx: PrismaTransaction,
	command: WithdrawDecisionCommand,
	commandKey: string,
	fingerprint: string
): Promise<DecisionWriteOutcome> {
	const current = await tx.decision.findUnique({
		where: { id: command.payload.decisionId },
	});
	if (!current) {
		return { reason: "decision-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.decision.findUnique({
		where: { id: current.id },
	});
	if (!locked) {
		return { reason: "decision-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const withdrawnAt = new Date();
	const rationale = command.payload.rationale ?? null;
	const updated = await tx.decision.update({
		data: {
			life: DECISION_LIFE.withdrawn,
			revision: locked.revision + 1,
			withdrawnAt,
			withdrawnRationale: rationale,
		},
		where: { id: locked.id },
	});
	await tx.decisionEvent.create({
		data: {
			actorId: command.actorId,
			decisionId: updated.id,
			id: crypto.randomUUID(),
			kind: DECISION_EVENT_KIND.withdraw,
			nextLife: DECISION_LIFE.withdrawn,
			occurredAt: withdrawnAt,
			previousLife: locked.life,
			rationale,
		},
	});
	const view = toView(updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { decision: view, status: "committed" };
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<DecisionWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.decision.findUnique({
		where: { id: existing.targetId },
	});
	if (live) {
		return { decision: toView(live), status: "replayed" };
	}
	return { conflict: MUTATION_COPY.conflict, status: "conflict" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		view: DecisionView;
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
	const [lockA, lockB] = advisoryKeys(`decisions:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

function toView(row: DecisionRow): DecisionView {
	return {
		decision: row.decisionText,
		id: row.id,
		life: presentDecisionLife(row.life),
		projectId: row.projectId,
		rationale: row.rationale,
		recordKind: "Decision",
		revision: row.revision,
		title: row.title,
		withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
		withdrawnRationale: row.withdrawnRationale,
	};
}
