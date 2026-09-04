import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";

import {
	type CreateOpenQuestionCommand,
	createOpenQuestionCommandSchema,
	OPEN_QUESTION_EVENT_KIND,
	OPEN_QUESTION_LIFE,
	type OpenQuestionLife,
	type OpenQuestionView,
	type OpenQuestionWriteOutcome,
	RELATIONS_KIND_QUESTION,
	type SetOpenQuestionLifeCommand,
	setOpenQuestionLifeCommandSchema,
	UNCERTAINTY_COPY,
} from "./uncertainty-records-model";

type PrismaTransaction = Prisma.TransactionClient;

interface OpenQuestionRow {
	answer: string;
	context: string;
	id: string;
	life: string;
	projectId: string;
	question: string;
	rationale: string;
	revision: number;
	title: string;
}

export async function createOpenQuestion(
	prisma: PrismaClient,
	command: unknown
): Promise<OpenQuestionWriteOutcome> {
	const parsed = createOpenQuestionCommandSchema.safeParse(command);
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

export async function setOpenQuestionLife(
	prisma: PrismaClient,
	command: unknown
): Promise<OpenQuestionWriteOutcome> {
	const parsed = setOpenQuestionLifeCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		answer: parsed.data.payload.answer ?? null,
		evidence: parsed.data.payload.evidence ?? null,
		life: parsed.data.payload.life,
		openQuestionId: parsed.data.payload.openQuestionId,
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

export async function getOpenQuestion(
	prisma: PrismaClient,
	openQuestionId: string
): Promise<OpenQuestionView | null> {
	const row = await prisma.openQuestion.findUnique({
		where: { id: openQuestionId },
	});
	if (!row) {
		return null;
	}
	const [view] = await hydrateOpenQuestionViews(prisma, [row]);
	return view ?? null;
}

export async function listOpenQuestions(
	prisma: PrismaClient,
	projectId: string,
	filter: { life?: OpenQuestionLife } = {}
): Promise<OpenQuestionView[]> {
	const rows = await prisma.openQuestion.findMany({
		orderBy: { createdAt: "asc" },
		where: {
			projectId,
			...(filter.life ? { life: filter.life } : {}),
		},
	});
	return await hydrateOpenQuestionViews(prisma, rows);
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateOpenQuestionCommand,
	commandKey: string,
	fingerprint: string
): Promise<OpenQuestionWriteOutcome> {
	await lockProject(tx, command.payload.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const created = await tx.openQuestion.create({
		data: {
			answer: "",
			context: command.payload.context,
			id: crypto.randomUUID(),
			life: OPEN_QUESTION_LIFE.open,
			projectId: command.payload.projectId,
			question: command.payload.question,
			rationale: "",
			revision: 1,
			title: command.payload.title,
		},
	});
	await tx.openQuestionEvent.create({
		data: {
			actorId: command.actorId,
			id: crypto.randomUUID(),
			kind: OPEN_QUESTION_EVENT_KIND.create,
			nextLife: OPEN_QUESTION_LIFE.open,
			openQuestionId: created.id,
			previousLife: null,
			rationale: null,
		},
	});
	const [view] = await hydrateOpenQuestionViews(tx, [created]);
	if (!view) {
		return { reason: "open-question-not-found", status: "rejected" };
	}
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { openQuestion: view, status: "committed" };
}

async function setLifeInTransaction(
	tx: PrismaTransaction,
	command: SetOpenQuestionLifeCommand,
	commandKey: string,
	fingerprint: string
): Promise<OpenQuestionWriteOutcome> {
	const current = await tx.openQuestion.findUnique({
		where: { id: command.payload.openQuestionId },
	});
	if (!current) {
		return { reason: "open-question-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.openQuestion.findUnique({
		where: { id: current.id },
	});
	if (!locked) {
		return { reason: "open-question-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (command.payload.evidence) {
		await tx.typedRelation.create({
			data: {
				fromId: command.payload.evidence.sourceId,
				fromKind: command.payload.evidence.sourceKind,
				id: crypto.randomUUID(),
				revision: 1,
				toId: locked.id,
				toKind: RELATIONS_KIND_QUESTION,
				type: RELATIONS_COPY.evidence,
			},
		});
	}
	const nextAnswer =
		command.payload.answer === undefined
			? locked.answer
			: command.payload.answer;
	const nextRationale =
		command.payload.rationale === undefined
			? locked.rationale
			: command.payload.rationale;
	const updated = await tx.openQuestion.update({
		data: {
			answer: nextAnswer,
			life: command.payload.life,
			rationale: nextRationale,
			revision: locked.revision + 1,
		},
		where: { id: locked.id },
	});
	await tx.openQuestionEvent.create({
		data: {
			actorId: command.actorId,
			id: crypto.randomUUID(),
			kind: OPEN_QUESTION_EVENT_KIND.setLife,
			nextLife: command.payload.life,
			openQuestionId: updated.id,
			previousLife: locked.life,
			rationale: command.payload.rationale ?? null,
		},
	});
	const [view] = await hydrateOpenQuestionViews(tx, [updated]);
	if (!view) {
		return { reason: "open-question-not-found", status: "rejected" };
	}
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { openQuestion: view, status: "committed" };
}

async function hydrateOpenQuestionViews(
	db: PrismaClient | PrismaTransaction,
	rows: OpenQuestionRow[]
): Promise<OpenQuestionView[]> {
	if (rows.length === 0) {
		return [];
	}
	const ids = rows.map((row) => row.id);
	const evidenceRows = await db.typedRelation.findMany({
		orderBy: { establishedAt: "asc" },
		where: {
			toId: { in: ids },
			toKind: RELATIONS_KIND_QUESTION,
			type: RELATIONS_COPY.evidence,
		},
	});
	const evidenceByQuestion = new Map<string, OpenQuestionView["evidence"]>();
	for (const row of evidenceRows) {
		const current = evidenceByQuestion.get(row.toId) ?? [];
		current.push({
			id: row.id,
			sourceId: row.fromId,
			sourceKind: row.fromKind,
			type: UNCERTAINTY_COPY.evidence,
		});
		evidenceByQuestion.set(row.toId, current);
	}
	return rows.map((row) => {
		const evidence = evidenceByQuestion.get(row.id) ?? [];
		const life = presentOpenQuestionLife(row.life);
		return {
			answer: row.answer,
			autoConverted: {
				decision: false,
				risk: false,
				work: false,
			},
			context: row.context,
			evidence,
			evidenceMissing:
				life === OPEN_QUESTION_LIFE.answered && evidence.length === 0,
			id: row.id,
			life,
			projectId: row.projectId,
			question: row.question,
			rationale: row.rationale,
			recordKind: UNCERTAINTY_COPY.openQuestion,
			revision: row.revision,
			title: row.title,
		};
	});
}

function presentOpenQuestionLife(stored: string): OpenQuestionLife {
	if (stored === OPEN_QUESTION_LIFE.answered) {
		return OPEN_QUESTION_LIFE.answered;
	}
	if (stored === OPEN_QUESTION_LIFE.noLongerApplicable) {
		return OPEN_QUESTION_LIFE.noLongerApplicable;
	}
	return OPEN_QUESTION_LIFE.open;
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<OpenQuestionWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.openQuestion.findUnique({
		where: { id: existing.targetId },
	});
	if (live) {
		const [view] = await hydrateOpenQuestionViews(tx, [live]);
		if (view) {
			return { openQuestion: view, status: "replayed" };
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
		view: OpenQuestionView;
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
