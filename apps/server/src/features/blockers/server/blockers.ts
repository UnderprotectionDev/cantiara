import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	createRelation,
	deleteRelation,
} from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	type AddActiveBlockingRelationCommand,
	addActiveBlockingRelationCommandSchema,
	BLOCKER_SOURCE_KINDS,
	BLOCKERS_COPY,
	type BlockerRelationState,
	type BlockerSourceKind,
	type BlockingRelationView,
	type MarkBlockerResolvedCommand,
	markBlockerResolvedCommandSchema,
	type ReactivateBlockingRelationCommand,
	type RemoveBlockingRelationCommand,
	reactivateBlockingRelationCommandSchema,
	removeBlockingRelationCommandSchema,
	type WorkBlockersView,
	type WorkBlockersWriteOutcome,
} from "./blockers-model";

type PrismaTransaction = Prisma.TransactionClient;

function isBlockerSourceKind(value: string): value is BlockerSourceKind {
	return (BLOCKER_SOURCE_KINDS as readonly string[]).includes(value);
}

function isBlockerRelationState(value: string): value is BlockerRelationState {
	return value === BLOCKERS_COPY.active || value === BLOCKERS_COPY.resolved;
}

function optionalNote(value: string | null | undefined): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function relationCopy() {
	return {
		active: BLOCKERS_COPY.active,
		markBlockerResolved: BLOCKERS_COPY.markBlockerResolved,
		removeRelation: BLOCKERS_COPY.removeRelation,
		resolved: BLOCKERS_COPY.resolved,
	};
}

function toView(
	row: {
		blockerState: string | null;
		fromId: string;
		fromKind: string;
		id: string;
		resolutionNote: string | null;
		resolvedAt: Date | null;
		toId: string;
	},
	sourceClosedSuggestion: BlockingRelationView["sourceCloseSuggestion"]
): BlockingRelationView | null {
	if (!(row.blockerState && isBlockerRelationState(row.blockerState))) {
		return null;
	}
	if (!isBlockerSourceKind(row.fromKind)) {
		return null;
	}
	return {
		blockedWorkId: row.toId,
		copy: relationCopy(),
		id: row.id,
		resolutionNote: optionalNote(row.resolutionNote),
		resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
		source: { id: row.fromId, kind: row.fromKind },
		sourceCloseSuggestion: sourceClosedSuggestion,
		state: row.blockerState,
		type: BLOCKERS_COPY.blocks,
		typeLabelFrom: BLOCKERS_COPY.blocks,
		typeLabelTo: BLOCKERS_COPY.blockedBy,
	};
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

async function findPair(
	prisma: PrismaClient,
	source: { id: string; kind: string },
	blockedWorkId: string
) {
	return await prisma.typedRelation.findFirst({
		where: {
			fromId: source.id,
			fromKind: source.kind,
			toId: blockedWorkId,
			toKind: "Work",
			type: RELATIONS_COPY.blocks,
		},
	});
}

export async function addActiveBlockingRelation(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkBlockersWriteOutcome> {
	const parsed = addActiveBlockingRelationCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await addParsed(prisma, parsed.data);
}

async function addParsed(
	prisma: PrismaClient,
	command: AddActiveBlockingRelationCommand
): Promise<WorkBlockersWriteOutcome> {
	const blocked = await getWork(prisma, command.blockedWorkId);
	if (!blocked) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (command.source.kind === "Work") {
		if (command.source.id === command.blockedWorkId) {
			return { reason: "invalid-command", status: "rejected" };
		}
		const sourceWork = await getWork(prisma, command.source.id);
		if (!sourceWork) {
			return { reason: "target-not-found", status: "rejected" };
		}
	}
	const existing = await findPair(
		prisma,
		command.source,
		command.blockedWorkId
	);
	if (existing) {
		if (existing.blockerState !== BLOCKERS_COPY.active) {
			return { reason: "already-exists", status: "rejected" };
		}
		const view = toView(existing, null);
		if (!view) {
			return { reason: "already-exists", status: "rejected" };
		}
		return { relation: view, status: "committed" };
	}
	const created = await createRelation(prisma, {
		actorId: command.actorId,
		blockerState: BLOCKERS_COPY.active,
		from: { id: command.source.id, kind: command.source.kind },
		idempotencyKey: command.idempotencyKey,
		origin: command.origin,
		previewAcknowledged: true,
		to: { id: command.blockedWorkId, kind: "Work" },
		type: RELATIONS_COPY.blocks,
		viewerWorkspaceId: command.viewerWorkspaceId,
	});
	if (created.status === "conflict") {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (created.status === "rejected") {
		return { reason: created.reason, status: "rejected" };
	}
	const row = await prisma.typedRelation.findUnique({
		where: { id: created.relation.id },
	});
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const view = toView(row, null);
	if (!view) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return { relation: view, status: created.status };
}

export async function listWorkBlockers(
	prisma: PrismaClient,
	workId: string
): Promise<WorkBlockersView> {
	const work = await getWork(prisma, workId);
	const rows = await prisma.typedRelation.findMany({
		orderBy: { establishedAt: "asc" },
		where: {
			toId: workId,
			toKind: "Work",
			type: RELATIONS_COPY.blocks,
		},
	});
	const workSourceIds = [
		...new Set(
			rows.filter((row) => row.fromKind === "Work").map((row) => row.fromId)
		),
	];
	const closedSources =
		workSourceIds.length === 0
			? []
			: await prisma.work.findMany({
					select: { id: true },
					where: {
						id: { in: workSourceIds },
						status: WORK_STATUS.closed,
					},
				});
	const closedSourceIds = new Set(closedSources.map((row) => row.id));
	const suggestion = {
		copy: { markBlockerResolved: BLOCKERS_COPY.markBlockerResolved },
		reason: BLOCKERS_COPY.sourceClosedSuggestion,
	} as const;
	const relations = rows.flatMap((row) => {
		const view = toView(
			row,
			row.blockerState === BLOCKERS_COPY.active &&
				row.fromKind === "Work" &&
				closedSourceIds.has(row.fromId)
				? suggestion
				: null
		);
		return view ? [view] : [];
	});
	return {
		copy: relationCopy(),
		hasActiveBlocker: relations.some(
			(relation) => relation.state === BLOCKERS_COPY.active
		),
		relations,
		workId,
		workStatus: work?.status ?? "Not Started",
	};
}

export async function removeBlockingRelation(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkBlockersWriteOutcome> {
	const parsed = removeBlockingRelationCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await removeParsed(prisma, parsed.data);
}

async function removeParsed(
	prisma: PrismaClient,
	command: RemoveBlockingRelationCommand
): Promise<WorkBlockersWriteOutcome> {
	const row = await prisma.typedRelation.findUnique({
		where: { id: command.relationId },
	});
	if (!row || row.type !== RELATIONS_COPY.blocks) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (row.blockerState !== BLOCKERS_COPY.active) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const view = toView(row, null);
	if (!view) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const deleted = await deleteRelation(prisma, {
		actorId: command.actorId,
		idempotencyKey: command.idempotencyKey,
		origin: command.origin,
		relationId: command.relationId,
		viewerWorkspaceId: command.viewerWorkspaceId,
	});
	if (deleted.status === "conflict") {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (deleted.status === "rejected") {
		return { reason: deleted.reason, status: "rejected" };
	}
	return { relation: view, status: deleted.status };
}

export async function markBlockerResolved(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkBlockersWriteOutcome> {
	const parsed = markBlockerResolvedCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await mutateLife(prisma, parsed.data, {
		note: optionalNote(parsed.data.resolutionNote),
		state: BLOCKERS_COPY.resolved,
	});
}

export async function reactivateBlockingRelation(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkBlockersWriteOutcome> {
	const parsed = reactivateBlockingRelationCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await mutateLife(prisma, parsed.data, {
		note: undefined,
		state: BLOCKERS_COPY.active,
	});
}

async function mutateLife(
	prisma: PrismaClient,
	command: MarkBlockerResolvedCommand | ReactivateBlockingRelationCommand,
	change: { note: string | null | undefined; state: BlockerRelationState }
): Promise<WorkBlockersWriteOutcome> {
	const fingerprint = payloadFingerprint({
		note: change.note ?? null,
		relationId: command.relationId,
		state: change.state,
	});
	const commandKey = commandKeyFor(command.actorId, command.idempotencyKey);
	return await prisma.$transaction((tx) =>
		mutateLifeInTransaction(tx, command, change, commandKey, fingerprint)
	);
}

async function mutateLifeInTransaction(
	tx: PrismaTransaction,
	command: MarkBlockerResolvedCommand | ReactivateBlockingRelationCommand,
	change: { note: string | null | undefined; state: BlockerRelationState },
	commandKey: string,
	fingerprint: string
): Promise<WorkBlockersWriteOutcome> {
	const existingReceipt = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existingReceipt) {
		if (existingReceipt.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const stored = parseStoredView(existingReceipt.resultValue);
		if (stored) {
			return { relation: stored, status: "replayed" };
		}
	}
	const row = await tx.typedRelation.findUnique({
		where: { id: command.relationId },
	});
	if (!row || row.type !== RELATIONS_COPY.blocks) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const resolvedAt =
		change.state === BLOCKERS_COPY.resolved ? new Date() : row.resolvedAt;
	const resolutionNote =
		change.state === BLOCKERS_COPY.resolved
			? (change.note ?? null)
			: row.resolutionNote;
	const updated = await tx.typedRelation.update({
		data: {
			blockerState: change.state,
			resolutionNote,
			resolvedAt,
			revision: row.revision + 1,
		},
		where: { id: row.id },
	});
	const view = toView(updated, null);
	if (!view) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: updated.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(view),
			targetId: updated.id,
		},
	});
	return { relation: view, status: "committed" };
}

function parseStoredView(value: string): BlockingRelationView | null {
	try {
		const parsed: unknown = JSON.parse(value);
		if (typeof parsed !== "object" || parsed === null) {
			return null;
		}
		return parsed as BlockingRelationView;
	} catch {
		return null;
	}
}
