import type { PrismaClient } from "@cantiara/db";

import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import {
	createRelation,
	deleteRelation,
} from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	type AddActiveBlockingRelationCommand,
	addActiveBlockingRelationCommandSchema,
	BLOCKER_SOURCE_KINDS,
	BLOCKERS_COPY,
	type BlockerSourceKind,
	type BlockingRelationView,
	type RemoveBlockingRelationCommand,
	removeBlockingRelationCommandSchema,
	type WorkBlockersView,
	type WorkBlockersWriteOutcome,
} from "./blockers-model";

function isBlockerSourceKind(value: string): value is BlockerSourceKind {
	return (BLOCKER_SOURCE_KINDS as readonly string[]).includes(value);
}

function toView(row: {
	blockerState: string | null;
	fromId: string;
	fromKind: string;
	id: string;
	toId: string;
}): BlockingRelationView | null {
	if (row.blockerState !== BLOCKERS_COPY.active) {
		return null;
	}
	if (!isBlockerSourceKind(row.fromKind)) {
		return null;
	}
	return {
		blockedWorkId: row.toId,
		copy: {
			active: BLOCKERS_COPY.active,
			removeRelation: BLOCKERS_COPY.removeRelation,
		},
		id: row.id,
		source: { id: row.fromId, kind: row.fromKind },
		state: BLOCKERS_COPY.active,
		type: BLOCKERS_COPY.blocks,
		typeLabelFrom: BLOCKERS_COPY.blocks,
		typeLabelTo: BLOCKERS_COPY.blockedBy,
	};
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
		const view = toView(existing);
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
	const view = toView(row);
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
			blockerState: BLOCKERS_COPY.active,
			toId: workId,
			toKind: "Work",
			type: RELATIONS_COPY.blocks,
		},
	});
	const relations = rows.flatMap((row) => {
		const view = toView(row);
		return view ? [view] : [];
	});
	return {
		copy: {
			active: BLOCKERS_COPY.active,
			removeRelation: BLOCKERS_COPY.removeRelation,
		},
		hasActiveBlocker: relations.length > 0,
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
	const view = toView(row);
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
