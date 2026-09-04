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
	type CreateDecisionCommand,
	createDecisionCommandSchema,
	DECISION_EVENT_KIND,
	DECISION_LIFE,
	type DecisionLife,
	type DecisionView,
	type DecisionWriteOutcome,
	importedDecisionLife,
	ingestImportedDecisionCommandSchema,
	type PreviewRemoveSupersessionOutcome,
	type PreviewSupersessionOutcome,
	presentDecisionLife,
	previewRemoveSupersessionInputSchema,
	previewSupersessionInputSchema,
	type RemoveSupersessionCommand,
	type RemoveSupersessionWriteOutcome,
	removeSupersessionCommandSchema,
	type SupersedeDecisionsCommand,
	type SupersedeWriteOutcome,
	setDecisionLifeCommandSchema,
	supersedeDecisionsCommandSchema,
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
	return row ? await withSupersessionLinks(prisma, toView(row)) : null;
}

export async function listDecisions(
	prisma: PrismaClient,
	projectId: string
): Promise<DecisionView[]> {
	const rows = await prisma.decision.findMany({
		orderBy: { createdAt: "asc" },
		where: { projectId },
	});
	return await Promise.all(
		rows.map((row) => withSupersessionLinks(prisma, toView(row)))
	);
}

export async function previewSupersession(
	prisma: PrismaClient,
	input: unknown
): Promise<PreviewSupersessionOutcome> {
	const parsed = previewSupersessionInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await loadSupersessionPreview(prisma, parsed.data.payload);
}

export async function supersedeDecisions(
	prisma: PrismaClient,
	command: unknown
): Promise<SupersedeWriteOutcome> {
	const parsed = supersedeDecisionsCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		successorId: parsed.data.payload.successorId,
		supersededIds: [...parsed.data.payload.supersededIds].sort(),
		transitionRationale: parsed.data.payload.transitionRationale ?? null,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		supersedeInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function previewRemoveSupersession(
	prisma: PrismaClient,
	input: unknown
): Promise<PreviewRemoveSupersessionOutcome> {
	const parsed = previewRemoveSupersessionInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await loadRemovePreview(prisma, parsed.data.payload);
}

export async function removeSupersession(
	prisma: PrismaClient,
	command: unknown
): Promise<RemoveSupersessionWriteOutcome> {
	const parsed = removeSupersessionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.payload.confirm !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		remove: true,
		successorId: parsed.data.payload.successorId,
		supersededId: parsed.data.payload.supersededId,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		removeInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
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

async function supersedeInTransaction(
	tx: PrismaTransaction,
	command: SupersedeDecisionsCommand,
	commandKey: string,
	fingerprint: string
): Promise<SupersedeWriteOutcome> {
	const successor = await tx.decision.findUnique({
		where: { id: command.payload.successorId },
	});
	if (!successor) {
		return { reason: "decision-not-found", status: "rejected" };
	}
	await lockProject(tx, successor.projectId);
	const replayed = await replaySupersede(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const preview = await loadSupersessionPreview(tx, command.payload);
	if (preview.status !== "ok") {
		return preview;
	}
	const lockedSuccessor = await tx.decision.findUnique({
		where: { id: successor.id },
	});
	if (!lockedSuccessor) {
		return { reason: "decision-not-found", status: "rejected" };
	}
	if (lockedSuccessor.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const expected = new Map(
		(command.payload.supersededRevisions ?? []).map((item) => [
			item.id,
			item.revision,
		])
	);
	const occurredAt = new Date();
	const rationale = command.payload.transitionRationale ?? null;
	const supersededIds = uniqueIds(command.payload.supersededIds);
	const lockedOlds = await tx.decision.findMany({
		where: { id: { in: supersededIds } },
	});
	if (lockedOlds.length !== supersededIds.length) {
		return { reason: "decision-not-found", status: "rejected" };
	}
	const lockedById = new Map(lockedOlds.map((row) => [row.id, row]));
	const supersededViews: DecisionView[] = [];
	const relations: Array<{ fromId: string; id: string; toId: string }> = [];
	for (const oldId of supersededIds) {
		const locked = lockedById.get(oldId);
		if (!locked) {
			return { reason: "decision-not-found", status: "rejected" };
		}
		const expectedRevision = expected.get(oldId);
		if (
			expectedRevision !== undefined &&
			locked.revision !== expectedRevision
		) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		// biome-ignore lint/performance/noAwaitInLoops: each old Decision must write life and relation before the next in one commit.
		const updated = await tx.decision.update({
			data: {
				life: DECISION_LIFE.superseded,
				revision: locked.revision + 1,
			},
			where: { id: locked.id },
		});
		await tx.decisionEvent.create({
			data: {
				actorId: command.actorId,
				decisionId: updated.id,
				id: crypto.randomUUID(),
				kind: DECISION_EVENT_KIND.supersede,
				nextLife: DECISION_LIFE.superseded,
				occurredAt,
				previousLife: locked.life,
				rationale,
			},
		});
		const relation = await tx.typedRelation.create({
			data: {
				fromId: lockedSuccessor.id,
				fromKind: "Decision",
				id: crypto.randomUUID(),
				revision: 1,
				toId: updated.id,
				toKind: "Decision",
				type: RELATIONS_COPY.supersedes,
			},
		});
		relations.push({
			fromId: relation.fromId,
			id: relation.id,
			toId: relation.toId,
		});
		supersededViews.push(toView(updated));
	}
	const nextSuccessor = await tx.decision.update({
		data: { revision: lockedSuccessor.revision + 1 },
		where: { id: lockedSuccessor.id },
	});
	await tx.decisionEvent.create({
		data: {
			actorId: command.actorId,
			decisionId: nextSuccessor.id,
			id: crypto.randomUUID(),
			kind: DECISION_EVENT_KIND.supersede,
			nextLife: DECISION_LIFE.valid,
			occurredAt,
			previousLife: lockedSuccessor.life,
			rationale,
		},
	});
	const successorView = toView(nextSuccessor);
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: successorView.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify({
				kind: "supersede",
				relationIds: relations.map((relation) => relation.id),
				successorId: successorView.id,
				supersededIds: supersededViews.map((view) => view.id),
				transitionRationale: rationale,
			}),
			targetId: successorView.id,
		},
	});
	return {
		relations,
		status: "committed",
		successor: successorView,
		superseded: supersededViews,
		transitionRationale: rationale,
	};
}

async function removeInTransaction(
	tx: PrismaTransaction,
	command: RemoveSupersessionCommand,
	commandKey: string,
	fingerprint: string
): Promise<RemoveSupersessionWriteOutcome> {
	const successor = await tx.decision.findUnique({
		where: { id: command.payload.successorId },
	});
	const superseded = await tx.decision.findUnique({
		where: { id: command.payload.supersededId },
	});
	if (!(successor && superseded)) {
		return { reason: "decision-not-found", status: "rejected" };
	}
	await lockProject(tx, successor.projectId);
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const liveSuccessor = await tx.decision.findUnique({
			where: { id: successor.id },
		});
		const liveSuperseded = await tx.decision.findUnique({
			where: { id: superseded.id },
		});
		if (liveSuccessor && liveSuperseded) {
			return {
				status: "replayed",
				successor: toView(liveSuccessor),
				superseded: toView(liveSuperseded),
			};
		}
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (successor.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const relation = await tx.typedRelation.findFirst({
		where: {
			fromId: successor.id,
			fromKind: "Decision",
			toId: superseded.id,
			toKind: "Decision",
			type: RELATIONS_COPY.supersedes,
		},
	});
	if (!relation) {
		return { reason: "decision-not-found", status: "rejected" };
	}
	await tx.typedRelation.delete({ where: { id: relation.id } });
	const remaining = await tx.typedRelation.count({
		where: {
			toId: superseded.id,
			toKind: "Decision",
			type: RELATIONS_COPY.supersedes,
		},
	});
	const restoreValid = remaining === 0;
	const occurredAt = new Date();
	const nextOld = await tx.decision.update({
		data: {
			life: restoreValid ? DECISION_LIFE.valid : superseded.life,
			revision: superseded.revision + 1,
		},
		where: { id: superseded.id },
	});
	const nextSuccessor = await tx.decision.update({
		data: { revision: successor.revision + 1 },
		where: { id: successor.id },
	});
	await tx.decisionEvent.create({
		data: {
			actorId: command.actorId,
			decisionId: nextOld.id,
			id: crypto.randomUUID(),
			kind: DECISION_EVENT_KIND.removeSupersede,
			nextLife: nextOld.life,
			occurredAt,
			previousLife: superseded.life,
			rationale: null,
		},
	});
	await tx.decisionEvent.create({
		data: {
			actorId: command.actorId,
			decisionId: nextSuccessor.id,
			id: crypto.randomUUID(),
			kind: DECISION_EVENT_KIND.removeSupersede,
			nextLife: nextSuccessor.life,
			occurredAt,
			previousLife: successor.life,
			rationale: null,
		},
	});
	const successorView = toView(nextSuccessor);
	const supersededView = toView(nextOld);
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: successorView.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify({
				kind: "remove-supersede",
				successorId: successorView.id,
				supersededId: supersededView.id,
			}),
			targetId: successorView.id,
		},
	});
	return {
		status: "committed",
		successor: successorView,
		superseded: supersededView,
	};
}

async function loadSupersessionPreview(
	db: PrismaClient | PrismaTransaction,
	payload: {
		successorId: string;
		supersededIds: string[];
		transitionRationale?: string;
	}
): Promise<PreviewSupersessionOutcome> {
	const supersededIds = uniqueIds(payload.supersededIds);
	if (supersededIds.length === 0) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (supersededIds.includes(payload.successorId)) {
		return { reason: "self-link", status: "rejected" };
	}
	const successor = await db.decision.findUnique({
		where: { id: payload.successorId },
	});
	if (!successor) {
		return { reason: "decision-not-found", status: "rejected" };
	}
	if (presentDecisionLife(successor.life) !== DECISION_LIFE.valid) {
		return { reason: "successor-not-valid", status: "rejected" };
	}
	const olds = await db.decision.findMany({
		where: { id: { in: supersededIds } },
	});
	if (olds.length !== supersededIds.length) {
		return { reason: "decision-not-found", status: "rejected" };
	}
	const oldById = new Map(olds.map((row) => [row.id, row]));
	const forks = await db.typedRelation.findMany({
		where: {
			toId: { in: supersededIds },
			toKind: "Decision",
			type: RELATIONS_COPY.supersedes,
		},
	});
	if (forks.length > 0) {
		return { reason: "conflicting-fork", status: "rejected" };
	}
	const supersededRows: DecisionRow[] = [];
	for (const oldId of supersededIds) {
		const old = oldById.get(oldId);
		if (!old) {
			return { reason: "decision-not-found", status: "rejected" };
		}
		if (old.projectId !== successor.projectId) {
			return { reason: "decision-not-found", status: "rejected" };
		}
		if (presentDecisionLife(old.life) !== DECISION_LIFE.valid) {
			return { reason: "superseded-not-valid", status: "rejected" };
		}
		supersededRows.push(old);
	}
	const cycle = await wouldCreateCycle(db, successor.id, supersededIds);
	if (cycle) {
		return { reason: "cycle", status: "rejected" };
	}
	const successorSide = await toPreviewSide(db, successor, DECISION_LIFE.valid);
	const supersededSides = await Promise.all(
		supersededRows.map((row) =>
			toPreviewSide(db, row, DECISION_LIFE.superseded)
		)
	);
	return {
		preview: {
			livesChanging: supersededSides.map((side) => ({
				from: side.life,
				id: side.id,
				title: side.title,
				to: side.nextLife,
			})),
			successor: successorSide,
			superseded: supersededSides,
			transitionRationale: payload.transitionRationale ?? null,
		},
		status: "ok",
	};
}

async function loadRemovePreview(
	db: PrismaClient | PrismaTransaction,
	payload: { successorId: string; supersededId: string }
): Promise<PreviewRemoveSupersessionOutcome> {
	const successor = await db.decision.findUnique({
		where: { id: payload.successorId },
	});
	const superseded = await db.decision.findUnique({
		where: { id: payload.supersededId },
	});
	if (!(successor && superseded)) {
		return { reason: "decision-not-found", status: "rejected" };
	}
	const relation = await db.typedRelation.findFirst({
		where: {
			fromId: successor.id,
			fromKind: "Decision",
			toId: superseded.id,
			toKind: "Decision",
			type: RELATIONS_COPY.supersedes,
		},
	});
	if (!relation) {
		return { reason: "decision-not-found", status: "rejected" };
	}
	const remaining = await db.typedRelation.count({
		where: {
			id: { not: relation.id },
			toId: superseded.id,
			toKind: "Decision",
			type: RELATIONS_COPY.supersedes,
		},
	});
	const wouldRestoreValid = remaining === 0;
	return {
		preview: {
			successor: {
				id: successor.id,
				life: presentDecisionLife(successor.life),
				nextLife: presentDecisionLife(successor.life),
				title: successor.title,
			},
			superseded: {
				id: superseded.id,
				life: presentDecisionLife(superseded.life),
				nextLife: wouldRestoreValid
					? DECISION_LIFE.valid
					: presentDecisionLife(superseded.life),
				title: superseded.title,
			},
			wouldRestoreValid,
		},
		status: "ok",
	};
}

async function wouldCreateCycle(
	db: PrismaClient | PrismaTransaction,
	successorId: string,
	supersededIds: string[]
): Promise<boolean> {
	const edges = await db.typedRelation.findMany({
		where: {
			fromKind: "Decision",
			toKind: "Decision",
			type: RELATIONS_COPY.supersedes,
		},
	});
	const outgoing = new Map<string, string[]>();
	for (const edge of edges) {
		const next = outgoing.get(edge.fromId) ?? [];
		next.push(edge.toId);
		outgoing.set(edge.fromId, next);
	}
	for (const oldId of supersededIds) {
		const next = outgoing.get(successorId) ?? [];
		next.push(oldId);
		outgoing.set(successorId, next);
	}
	const visited = new Set<string>();
	const frontier = [...supersededIds];
	while (frontier.length > 0) {
		const id = frontier.pop();
		if (!id || visited.has(id)) {
			continue;
		}
		if (id === successorId) {
			return true;
		}
		visited.add(id);
		for (const nextId of outgoing.get(id) ?? []) {
			frontier.push(nextId);
		}
	}
	return false;
}

async function toPreviewSide(
	db: PrismaClient | PrismaTransaction,
	row: DecisionRow,
	nextLife: DecisionLife
) {
	return {
		decision: row.decisionText,
		evidenceSummary: await evidenceSummaryFor(db, row.id),
		id: row.id,
		life: presentDecisionLife(row.life),
		nextLife,
		rationale: row.rationale,
		revision: row.revision,
		title: row.title,
	};
}

async function evidenceSummaryFor(
	db: PrismaClient | PrismaTransaction,
	decisionId: string
): Promise<string[]> {
	const rows = await db.typedRelation.findMany({
		orderBy: { establishedAt: "asc" },
		where: {
			toId: decisionId,
			toKind: "Decision",
			type: RELATIONS_COPY.evidence,
		},
	});
	const workIds = rows
		.filter((row) => row.fromKind === "Work")
		.map((row) => row.fromId);
	const captureIds = rows
		.filter((row) => row.fromKind === "Capture")
		.map((row) => row.fromId);
	const works =
		workIds.length > 0
			? await db.work.findMany({ where: { id: { in: workIds } } })
			: [];
	const captures =
		captureIds.length > 0
			? await db.captureInboxItem.findMany({
					where: { id: { in: captureIds } },
				})
			: [];
	const workTitle = new Map(works.map((work) => [work.id, work.title]));
	const captureTitle = new Map(
		captures.map((capture) => [
			capture.id,
			capture.body.length > 0 ? capture.body : capture.id,
		])
	);
	return rows.map((row) => {
		if (row.fromKind === "Work") {
			return workTitle.get(row.fromId) ?? row.fromId;
		}
		if (row.fromKind === "Capture") {
			return captureTitle.get(row.fromId) ?? row.fromId;
		}
		return row.fromId;
	});
}

async function replaySupersede(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<SupersedeWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	let parsed: {
		relationIds?: string[];
		successorId?: string;
		supersededIds?: string[];
		transitionRationale?: string | null;
	};
	try {
		parsed = JSON.parse(existing.resultValue) as typeof parsed;
	} catch {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (!(parsed.successorId && parsed.supersededIds)) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const successor = await tx.decision.findUnique({
		where: { id: parsed.successorId },
	});
	if (!successor) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const supersededRows = await tx.decision.findMany({
		where: { id: { in: parsed.supersededIds } },
	});
	if (supersededRows.length !== parsed.supersededIds.length) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const supersededById = new Map(
		supersededRows.map((row) => [row.id, toView(row)])
	);
	const superseded: DecisionView[] = [];
	for (const id of parsed.supersededIds) {
		const view = supersededById.get(id);
		if (!view) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		superseded.push(view);
	}
	const relations = await tx.typedRelation.findMany({
		where: {
			fromId: successor.id,
			fromKind: "Decision",
			toKind: "Decision",
			type: RELATIONS_COPY.supersedes,
		},
	});
	return {
		relations: relations.map((relation) => ({
			fromId: relation.fromId,
			id: relation.id,
			toId: relation.toId,
		})),
		status: "replayed",
		successor: toView(successor),
		superseded,
		transitionRationale: parsed.transitionRationale ?? null,
	};
}

function uniqueIds(ids: string[]): string[] {
	return [...new Set(ids)];
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
		supersededBy: null,
		supersedes: [],
		title: row.title,
		withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
		withdrawnRationale: row.withdrawnRationale,
	};
}

async function withSupersessionLinks(
	db: PrismaClient | PrismaTransaction,
	view: DecisionView
): Promise<DecisionView> {
	const outgoing = await db.typedRelation.findMany({
		orderBy: { establishedAt: "asc" },
		where: {
			fromId: view.id,
			fromKind: "Decision",
			toKind: "Decision",
			type: RELATIONS_COPY.supersedes,
		},
	});
	const incoming = await db.typedRelation.findFirst({
		where: {
			toId: view.id,
			toKind: "Decision",
			type: RELATIONS_COPY.supersedes,
		},
	});
	const olds = await db.decision.findMany({
		where: { id: { in: outgoing.map((edge) => edge.toId) } },
	});
	const oldById = new Map(olds.map((old) => [old.id, old]));
	const supersedes: Array<{ id: string; title: string }> = outgoing.flatMap(
		(edge) => {
			const old = oldById.get(edge.toId);
			return old ? [{ id: old.id, title: old.title }] : [];
		}
	);
	let supersededBy: DecisionView["supersededBy"] = null;
	if (incoming) {
		const successor = await db.decision.findUnique({
			where: { id: incoming.fromId },
		});
		if (successor) {
			supersededBy = { id: successor.id, title: successor.title };
		}
	}
	return { ...view, supersededBy, supersedes };
}
