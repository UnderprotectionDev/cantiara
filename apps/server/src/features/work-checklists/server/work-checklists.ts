import type { Prisma, PrismaClient } from "@cantiara/db";
import { z } from "zod";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	isClosureResult,
	WORK_STATUS,
} from "../../work-lifecycle/server/work-lifecycle-model";
import {
	type AddChecklistItemCommand,
	addChecklistItemCommandSchema,
	type ChecklistItemView,
	checklistItemSchema,
	type RemoveChecklistItemCommand,
	type ReorderChecklistItemsCommand,
	removeChecklistItemCommandSchema,
	reorderChecklistItemsCommandSchema,
	type SetChecklistItemCompletedCommand,
	setChecklistItemCompletedCommandSchema,
	type UpdateChecklistItemCommand,
	updateChecklistItemCommandSchema,
	type WorkChecklistOutcome,
	type WorkChecklistView,
	workChecklistViewSchema,
} from "./work-checklists-model";

type PrismaTransaction = Prisma.TransactionClient;

interface WorkRow {
	closureResult: string | null;
	id: string;
	key: string;
	lightChecklist: Prisma.JsonValue;
	revision: number;
	status: string;
}

export async function getWorkChecklist(
	prisma: PrismaClient,
	workId: string
): Promise<WorkChecklistView | null> {
	const row = await prisma.work.findUnique({
		where: { id: workId },
	});
	if (!row || row.retiredIntoId) {
		return null;
	}
	return toChecklistView(row);
}

export async function addChecklistItem(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkChecklistOutcome> {
	const parsed = addChecklistItemCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const title = optionalText(parsed.data.title);
	if (!title) {
		return { reason: "missing-title", status: "rejected" };
	}
	return await mutateItems(
		prisma,
		parsed.data,
		{ kind: "add", title },
		(items) => [
			...items,
			{
				completed: false,
				id: crypto.randomUUID(),
				title,
			},
		]
	);
}

export async function updateChecklistItem(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkChecklistOutcome> {
	const parsed = updateChecklistItemCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const title = optionalText(parsed.data.title);
	if (!title) {
		return { reason: "missing-title", status: "rejected" };
	}
	return await mutateItems(
		prisma,
		parsed.data,
		{ itemId: parsed.data.itemId, kind: "update", title },
		(items) => {
			const index = items.findIndex((item) => item.id === parsed.data.itemId);
			if (index < 0) {
				return { reason: "item-not-found" as const };
			}
			return items.map((item, itemIndex) =>
				itemIndex === index ? { ...item, title } : item
			);
		}
	);
}

export async function setChecklistItemCompleted(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkChecklistOutcome> {
	const parsed = setChecklistItemCompletedCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await mutateItems(
		prisma,
		parsed.data,
		{
			completed: parsed.data.completed,
			itemId: parsed.data.itemId,
			kind: "set-completed",
		},
		(items) => {
			const index = items.findIndex((item) => item.id === parsed.data.itemId);
			if (index < 0) {
				return { reason: "item-not-found" as const };
			}
			return items.map((item, itemIndex) =>
				itemIndex === index
					? { ...item, completed: parsed.data.completed }
					: item
			);
		}
	);
}

export async function reorderChecklistItems(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkChecklistOutcome> {
	const parsed = reorderChecklistItemsCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await mutateItems(
		prisma,
		parsed.data,
		{ kind: "reorder", orderedItemIds: parsed.data.orderedItemIds },
		(items) => {
			const next = permuteItems(items, parsed.data.orderedItemIds);
			if (!next) {
				return { reason: "invalid-order" as const };
			}
			return next;
		}
	);
}

export async function removeChecklistItem(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkChecklistOutcome> {
	const parsed = removeChecklistItemCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await mutateItems(
		prisma,
		parsed.data,
		{ itemId: parsed.data.itemId, kind: "remove" },
		(items) => {
			if (!items.some((item) => item.id === parsed.data.itemId)) {
				return { reason: "item-not-found" as const };
			}
			return items.filter((item) => item.id !== parsed.data.itemId);
		}
	);
}

async function mutateItems(
	prisma: PrismaClient,
	command:
		| AddChecklistItemCommand
		| UpdateChecklistItemCommand
		| SetChecklistItemCompletedCommand
		| ReorderChecklistItemsCommand
		| RemoveChecklistItemCommand,
	fingerprintPayload: unknown,
	transform: (
		items: ChecklistItemView[]
	) => ChecklistItemView[] | { reason: "invalid-order" | "item-not-found" }
): Promise<WorkChecklistOutcome> {
	if (command.origin !== HUMAN_ORIGIN) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(fingerprintPayload);
	const commandKey = `human:${command.actorId}:${command.idempotencyKey}`;
	return await prisma.$transaction((tx) =>
		mutateInTransaction(tx, command, commandKey, fingerprint, transform)
	);
}

async function mutateInTransaction(
	tx: PrismaTransaction,
	command: { baseRevision: number; workId: string; actorId: string },
	commandKey: string,
	fingerprint: string,
	transform: (
		items: ChecklistItemView[]
	) => ChecklistItemView[] | { reason: "invalid-order" | "item-not-found" }
): Promise<WorkChecklistOutcome> {
	const current = await tx.work.findUnique({ where: { id: command.workId } });
	if (!current || current.retiredIntoId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.work.findUnique({ where: { id: current.id } });
	if (!locked || locked.retiredIntoId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return {
			checklist: toChecklistView(locked),
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	const transformed = transform(asItems(locked.lightChecklist));
	if (!Array.isArray(transformed)) {
		return { reason: transformed.reason, status: "rejected" };
	}
	await tx.work.update({
		data: {
			lightChecklist: transformed as Prisma.InputJsonValue,
			revision: locked.revision + 1,
		},
		where: { id: locked.id },
	});
	const updated = await tx.work.findUnique({ where: { id: locked.id } });
	if (!updated) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const checklist = toChecklistView(updated);
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: checklist.work.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(checklist),
			targetId: checklist.work.id,
		},
	});
	return { checklist, status: "committed" };
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<WorkChecklistOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.work.findUnique({ where: { id: existing.targetId } });
	if (live && !live.retiredIntoId) {
		return { checklist: toChecklistView(live), status: "replayed" };
	}
	const stored = workChecklistViewSchemaSafe(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { checklist: stored, status: "replayed" };
}

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`project-shell:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function toChecklistView(row: WorkRow): WorkChecklistView {
	const closureResult =
		row.status === WORK_STATUS.closed &&
		row.closureResult &&
		isClosureResult(row.closureResult)
			? row.closureResult
			: null;
	return {
		items: asItems(row.lightChecklist),
		work: {
			closureResult,
			id: row.id,
			key: row.key,
			revision: row.revision,
			status: row.status,
		},
	};
}

function asItems(value: Prisma.JsonValue): ChecklistItemView[] {
	const parsed = z.array(checklistItemSchema).safeParse(value);
	return parsed.success ? parsed.data : [];
}

function permuteItems(
	items: ChecklistItemView[],
	orderedItemIds: string[]
): ChecklistItemView[] | null {
	if (orderedItemIds.length !== items.length) {
		return null;
	}
	const unique = new Set(orderedItemIds);
	if (unique.size !== items.length) {
		return null;
	}
	const byId = new Map(items.map((item) => [item.id, item] as const));
	const next: ChecklistItemView[] = [];
	for (const id of orderedItemIds) {
		const item = byId.get(id);
		if (!item) {
			return null;
		}
		next.push(item);
	}
	return next;
}

function optionalText(value: string): string | null {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function workChecklistViewSchemaSafe(text: string): WorkChecklistView | null {
	try {
		const parsed: unknown = JSON.parse(text);
		const result = workChecklistViewSchema.safeParse(parsed);
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}
