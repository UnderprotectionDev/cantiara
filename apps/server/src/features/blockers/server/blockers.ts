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
	type DependenciesProjection,
	type MarkBlockerResolvedCommand,
	markBlockerResolvedCommandSchema,
	type ReactivateBlockingRelationCommand,
	type RemoveBlockingRelationCommand,
	reactivateBlockingRelationCommandSchema,
	removeBlockingRelationCommandSchema,
	WORK_BLOCKED_SIGNAL_ID,
	WORK_BLOCKED_SIGNAL_SECTION,
	type WorkBlockedSignalView,
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
		establishedAt: Date;
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
		establishedAt: row.establishedAt.toISOString(),
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

function asWorkBlockedSignal(
	view: BlockingRelationView,
	relationTime = view.establishedAt
): WorkBlockedSignalView | null {
	if (view.state !== BLOCKERS_COPY.active) {
		return null;
	}
	return {
		blockedWorkId: view.blockedWorkId,
		relationId: view.id,
		relationTime,
		section: WORK_BLOCKED_SIGNAL_SECTION,
		signalId: WORK_BLOCKED_SIGNAL_ID,
		source: view.source,
	};
}

function writeSuccess(
	relation: BlockingRelationView,
	status: "committed" | "replayed",
	emit: boolean,
	relationTime = relation.establishedAt
): WorkBlockersWriteOutcome {
	const signal = asWorkBlockedSignal(relation, relationTime);
	return {
		emissions: emit && signal ? [signal] : [],
		relation,
		status,
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
		return writeSuccess(view, "committed", false);
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
	return writeSuccess(view, created.status, created.status === "committed");
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
		signals: relations.flatMap((relation) => {
			const signal = asWorkBlockedSignal(relation);
			return signal ? [signal] : [];
		}),
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
	return writeSuccess(view, deleted.status, false);
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
			return writeSuccess(stored, "replayed", false);
		}
	}
	const row = await tx.typedRelation.findUnique({
		where: { id: command.relationId },
	});
	if (!row || row.type !== RELATIONS_COPY.blocks) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const previousState = row.blockerState;
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
	const emit =
		change.state === BLOCKERS_COPY.active &&
		previousState === BLOCKERS_COPY.resolved;
	return writeSuccess(
		view,
		"committed",
		emit,
		emit ? updated.updatedAt.toISOString() : view.establishedAt
	);
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

function nodeKey(kind: string, id: string): string {
	return `${kind}:${id}`;
}

function stronglyConnectedWorkIds(
	workIds: readonly string[],
	edges: readonly { fromId: string; toId: string }[]
): string[][] {
	const nodes = [...new Set(workIds)];
	const outgoing = new Map<string, string[]>();
	for (const id of nodes) {
		outgoing.set(id, []);
	}
	for (const edge of edges) {
		outgoing.get(edge.fromId)?.push(edge.toId);
	}
	let index = 0;
	const indices = new Map<string, number>();
	const lowlink = new Map<string, number>();
	const stack: string[] = [];
	const onStack = new Set<string>();
	const components: string[][] = [];

	function strongconnect(id: string) {
		indices.set(id, index);
		lowlink.set(id, index);
		index += 1;
		stack.push(id);
		onStack.add(id);
		for (const next of outgoing.get(id) ?? []) {
			if (!indices.has(next)) {
				strongconnect(next);
				lowlink.set(id, Math.min(lowlink.get(id) ?? 0, lowlink.get(next) ?? 0));
			} else if (onStack.has(next)) {
				lowlink.set(id, Math.min(lowlink.get(id) ?? 0, indices.get(next) ?? 0));
			}
		}
		if (lowlink.get(id) === indices.get(id)) {
			const component: string[] = [];
			let current = "";
			do {
				current = stack.pop() ?? "";
				onStack.delete(current);
				component.push(current);
			} while (current !== id);
			components.push(component);
		}
	}

	for (const id of nodes) {
		if (!indices.has(id)) {
			strongconnect(id);
		}
	}
	return components;
}

export async function projectDependencies(
	prisma: PrismaClient | Prisma.TransactionClient,
	workIds: readonly string[]
): Promise<DependenciesProjection> {
	const scope = new Set(workIds);
	const rows =
		scope.size === 0
			? []
			: await prisma.typedRelation.findMany({
					orderBy: { establishedAt: "asc" },
					where: {
						toId: { in: [...scope] },
						toKind: "Work",
						type: RELATIONS_COPY.blocks,
					},
				});
	const views = rows.flatMap((row) => {
		const view = toView(row, null);
		return view ? [view] : [];
	});
	const nodes = new Map<string, DependenciesProjection["nodes"][number]>();
	const edges: DependenciesProjection["edges"] = [];
	const workEdges: { fromId: string; id: string; toId: string }[] = [];
	for (const view of views) {
		nodes.set(nodeKey(view.source.kind, view.source.id), {
			id: view.source.id,
			kind: view.source.kind,
		});
		nodes.set(nodeKey("Work", view.blockedWorkId), {
			id: view.blockedWorkId,
			kind: "Work",
		});
		edges.push({
			direction: BLOCKERS_COPY.blocks,
			from: view.source,
			id: view.id,
			state: view.state,
			to: { id: view.blockedWorkId, kind: "Work" },
		});
		if (view.source.kind === "Work" && view.state === BLOCKERS_COPY.active) {
			workEdges.push({
				fromId: view.source.id,
				id: view.id,
				toId: view.blockedWorkId,
			});
		}
	}
	const workIdsInGraph = [
		...new Set(workEdges.flatMap((edge) => [edge.fromId, edge.toId])),
	];
	const cycles = stronglyConnectedWorkIds(workIdsInGraph, workEdges).flatMap(
		(component) => {
			const inComponent = new Set(component);
			const relationIds = workEdges
				.filter(
					(edge) => inComponent.has(edge.fromId) && inComponent.has(edge.toId)
				)
				.map((edge) => edge.id);
			const looping =
				component.length > 1 ||
				workEdges.some(
					(edge) => edge.fromId === component[0] && edge.toId === component[0]
				);
			if (!looping) {
				return [];
			}
			return [
				{
					explanation: BLOCKERS_COPY.cycle,
					relationIds,
					workIds: [...component].sort(),
				},
			];
		}
	);
	return {
		copy: {
			active: BLOCKERS_COPY.active,
			blockedBy: BLOCKERS_COPY.blockedBy,
			blocks: BLOCKERS_COPY.blocks,
			cycle: BLOCKERS_COPY.cycle,
			dependencies: BLOCKERS_COPY.dependencies,
			resolved: BLOCKERS_COPY.resolved,
		},
		cycles,
		edges,
		nodes: [...nodes.values()].sort((left, right) =>
			left.id.localeCompare(right.id)
		),
		writable: false,
	};
}
