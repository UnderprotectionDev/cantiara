import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	parseRecordKind,
	RELATIONS_COPY,
	validateRelationEnds,
} from "../../relations/server/relations-catalog";

import {
	ASSUMPTION_EVENT_KIND,
	ASSUMPTION_LIFE,
	type AssumptionLife,
	type AssumptionView,
	type AssumptionWriteOutcome,
	type CreateAssumptionCommand,
	createAssumptionCommandSchema,
	isAssumptionOutcomeLife,
	type SetAssumptionLifeCommand,
	setAssumptionLifeCommandSchema,
	UNCERTAINTY_COPY,
} from "./uncertainty-records-model";

type PrismaTransaction = Prisma.TransactionClient;

interface AssumptionRow {
	id: string;
	life: string;
	outcomeRationale: string | null;
	projectId: string;
	rationale: string;
	revision: number;
	statement: string;
}

interface EvidenceRow {
	fromId: string;
	fromKind: string;
	id: string;
}

export function listRefutedAssumptionReview(): {
	present: false;
	rows: [];
} {
	return { present: false, rows: [] };
}

export async function createAssumption(
	prisma: PrismaClient,
	command: unknown
): Promise<AssumptionWriteOutcome> {
	const parsed = createAssumptionCommandSchema.safeParse(command);
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

export async function setAssumptionLife(
	prisma: PrismaClient,
	command: unknown
): Promise<AssumptionWriteOutcome> {
	const parsed = setAssumptionLifeCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (
		parsed.data.payload.evidence &&
		!isAssumptionOutcomeLife(parsed.data.payload.life)
	) {
		return { reason: "evidence-not-accepted", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		assumptionId: parsed.data.payload.assumptionId,
		evidence: parsed.data.payload.evidence ?? null,
		life: parsed.data.payload.life,
		rationale: parsed.data.payload.rationale ?? null,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		setLifeInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function getAssumption(
	prisma: PrismaClient,
	assumptionId: string
): Promise<AssumptionView | null> {
	const row = await prisma.assumption.findUnique({
		where: { id: assumptionId },
	});
	if (!row) {
		return null;
	}
	const [view] = await hydrateAssumptionViews(prisma, [row]);
	return view ?? null;
}

export async function listAssumptions(
	prisma: PrismaClient,
	projectId: string,
	filter: { life?: AssumptionLife } = {}
): Promise<AssumptionView[]> {
	const rows = await prisma.assumption.findMany({
		orderBy: { createdAt: "asc" },
		where: {
			projectId,
			...(filter.life ? { life: filter.life } : {}),
		},
	});
	return await hydrateAssumptionViews(prisma, rows);
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateAssumptionCommand,
	commandKey: string,
	fingerprint: string
): Promise<AssumptionWriteOutcome> {
	await lockProject(tx, command.payload.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const created = await tx.assumption.create({
		data: {
			id: crypto.randomUUID(),
			life: ASSUMPTION_LIFE.open,
			outcomeRationale: null,
			projectId: command.payload.projectId,
			rationale: command.payload.rationale,
			revision: 1,
			statement: command.payload.statement,
		},
	});
	await tx.assumptionEvent.create({
		data: {
			actorId: command.actorId,
			assumptionId: created.id,
			id: crypto.randomUUID(),
			kind: ASSUMPTION_EVENT_KIND.create,
			nextLife: ASSUMPTION_LIFE.open,
			previousLife: null,
			rationale: command.payload.rationale,
		},
	});
	const [view] = await hydrateAssumptionViews(tx, [created]);
	if (!view) {
		return { reason: "assumption-not-found", status: "rejected" };
	}
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { assumption: view, status: "committed" };
}

async function setLifeInTransaction(
	tx: PrismaTransaction,
	command: SetAssumptionLifeCommand,
	commandKey: string,
	fingerprint: string
): Promise<AssumptionWriteOutcome> {
	const current = await tx.assumption.findUnique({
		where: { id: command.payload.assumptionId },
	});
	if (!current) {
		return { reason: "assumption-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.assumption.findUnique({
		where: { id: current.id },
	});
	if (!locked) {
		return { reason: "assumption-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (command.payload.evidence) {
		const attached = await attachEvidence(tx, {
			assumptionId: locked.id,
			fromId: command.payload.evidence.fromId,
			fromKind: command.payload.evidence.fromKind,
		});
		if (attached.status === "rejected") {
			return attached;
		}
	}
	const outcomeRationale = isAssumptionOutcomeLife(command.payload.life)
		? (command.payload.rationale ?? locked.outcomeRationale)
		: locked.outcomeRationale;
	const updated = await tx.assumption.update({
		data: {
			life: command.payload.life,
			outcomeRationale,
			revision: locked.revision + 1,
		},
		where: { id: locked.id },
	});
	await tx.assumptionEvent.create({
		data: {
			actorId: command.actorId,
			assumptionId: updated.id,
			id: crypto.randomUUID(),
			kind: ASSUMPTION_EVENT_KIND.setLife,
			nextLife: command.payload.life,
			previousLife: locked.life,
			rationale: command.payload.rationale ?? null,
		},
	});
	const [view] = await hydrateAssumptionViews(tx, [updated]);
	if (!view) {
		return { reason: "assumption-not-found", status: "rejected" };
	}
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { assumption: view, status: "committed" };
}

async function attachEvidence(
	tx: PrismaTransaction,
	input: { assumptionId: string; fromId: string; fromKind: string }
): Promise<{ status: "ok" } | AssumptionWriteOutcome> {
	const fromKind = parseRecordKind(input.fromKind);
	if (!fromKind) {
		return { reason: "invalid-evidence", status: "rejected" };
	}
	const ends = validateRelationEnds({
		from: { id: input.fromId, kind: fromKind },
		to: { id: input.assumptionId, kind: "Assumption" },
		type: RELATIONS_COPY.evidence,
	});
	if (ends.status === "rejected") {
		return { reason: "invalid-evidence", status: "rejected" };
	}
	await tx.typedRelation.create({
		data: {
			fromId: input.fromId,
			fromKind,
			id: crypto.randomUUID(),
			revision: 1,
			toId: input.assumptionId,
			toKind: "Assumption",
			type: RELATIONS_COPY.evidence,
		},
	});
	return { status: "ok" };
}

async function hydrateAssumptionViews(
	db: PrismaClient | PrismaTransaction,
	rows: AssumptionRow[]
): Promise<AssumptionView[]> {
	if (rows.length === 0) {
		return [];
	}
	const evidence = await db.typedRelation.findMany({
		orderBy: { establishedAt: "asc" },
		where: {
			toId: { in: rows.map((row) => row.id) },
			toKind: "Assumption",
			type: RELATIONS_COPY.evidence,
		},
	});
	const byAssumption = new Map<string, EvidenceRow[]>();
	for (const row of evidence) {
		const list = byAssumption.get(row.toId) ?? [];
		list.push({
			fromId: row.fromId,
			fromKind: row.fromKind,
			id: row.id,
		});
		byAssumption.set(row.toId, list);
	}
	return rows.map((row) => toView(row, byAssumption.get(row.id) ?? []));
}

function toView(row: AssumptionRow, evidence: EvidenceRow[]): AssumptionView {
	const life = presentAssumptionLife(row.life);
	const evidenceMissing =
		isAssumptionOutcomeLife(life) && evidence.length === 0;
	return {
		evidence,
		evidenceMissing,
		id: row.id,
		life,
		outcomeRationale: row.outcomeRationale,
		projectId: row.projectId,
		rationale: row.rationale,
		recordKind: UNCERTAINTY_COPY.assumption,
		revision: row.revision,
		statement: row.statement,
	};
}

function presentAssumptionLife(stored: string): AssumptionLife {
	if (stored === ASSUMPTION_LIFE.confirmed) {
		return ASSUMPTION_LIFE.confirmed;
	}
	if (stored === ASSUMPTION_LIFE.refuted) {
		return ASSUMPTION_LIFE.refuted;
	}
	if (stored === ASSUMPTION_LIFE.noLongerApplicable) {
		return ASSUMPTION_LIFE.noLongerApplicable;
	}
	return ASSUMPTION_LIFE.open;
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<AssumptionWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.assumption.findUnique({
		where: { id: existing.targetId },
	});
	if (live) {
		const [view] = await hydrateAssumptionViews(tx, [live]);
		if (view) {
			return { assumption: view, status: "replayed" };
		}
	}
	return { conflict: MUTATION_COPY.conflict, status: "conflict" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		view: AssumptionView;
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
	const [lockA, lockB] = advisoryKeys(
		`uncertainty-records:project:${projectId}`
	);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
