import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	type ApplyTagCommand,
	applyTagCommandSchema,
	type CreateTagCommand,
	createTagCommandSchema,
	type RemoveTagCommand,
	removeTagCommandSchema,
	type TaggedRecordView,
	type TagMembershipOutcome,
	type TagView,
	type TagWriteOutcome,
} from "./tags-model";

type PrismaTransaction = Prisma.TransactionClient;

export async function createTag(
	prisma: PrismaClient,
	command: unknown
): Promise<TagWriteOutcome> {
	const parsed = createTagCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({ name: parsed.data.name });
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		createInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function applyTag(
	prisma: PrismaClient,
	command: unknown
): Promise<TagMembershipOutcome> {
	return await mutateMembership(prisma, command, "apply");
}

export async function removeTag(
	prisma: PrismaClient,
	command: unknown
): Promise<TagMembershipOutcome> {
	return await mutateMembership(prisma, command, "remove");
}

export async function listTags(
	prisma: PrismaClient,
	workspaceId: string
): Promise<TagView[]> {
	const rows = await prisma.tag.findMany({
		orderBy: { name: "asc" },
		where: { workspaceId },
	});
	return rows.map(toTagView);
}

export async function suggestTags(
	prisma: PrismaClient,
	input: { projectId: string; workspaceId: string }
): Promise<TagView[]> {
	const tags = await prisma.tag.findMany({
		where: { workspaceId: input.workspaceId },
	});
	if (tags.length === 0) {
		return [];
	}
	const usage = await prisma.workTag.groupBy({
		_count: { tagId: true },
		by: ["tagId"],
		where: {
			tagId: { in: tags.map((tag) => tag.id) },
			work: { projectId: input.projectId, retiredIntoId: null },
		},
	});
	const countByTag = new Map(
		usage.map((row) => [row.tagId, row._count.tagId] as const)
	);
	return [...tags]
		.sort((left, right) => {
			const leftCount = countByTag.get(left.id) ?? 0;
			const rightCount = countByTag.get(right.id) ?? 0;
			if (leftCount !== rightCount) {
				return rightCount - leftCount;
			}
			return left.name.localeCompare(right.name);
		})
		.map(toTagView);
}

export async function listRecords(
	prisma: PrismaClient,
	input: { tagId: string; workspaceId: string }
): Promise<TaggedRecordView[]> {
	const rows = await prisma.workTag.findMany({
		include: { work: true },
		orderBy: { work: { key: "asc" } },
		where: {
			tagId: input.tagId,
			work: {
				project: { workspaceId: input.workspaceId },
				retiredIntoId: null,
			},
		},
	});
	const workIds = rows.map((row) => row.workId);
	const memberships = await loadTagIds(prisma, workIds);
	return rows.map((row) =>
		toRecordView(row.work, memberships.get(row.workId) ?? [])
	);
}

export async function listMemberships(
	prisma: PrismaClient,
	projectId: string
): Promise<Array<{ tagIds: string[]; workId: string }>> {
	const rows = await prisma.workTag.findMany({
		orderBy: [{ workId: "asc" }, { tagId: "asc" }],
		where: { work: { projectId, retiredIntoId: null } },
	});
	const byWork = new Map<string, string[]>();
	for (const row of rows) {
		const current = byWork.get(row.workId) ?? [];
		current.push(row.tagId);
		byWork.set(row.workId, current);
	}
	return [...byWork.entries()].map(([workId, tagIds]) => ({ tagIds, workId }));
}

async function mutateMembership(
	prisma: PrismaClient,
	command: unknown,
	kind: "apply" | "remove"
): Promise<TagMembershipOutcome> {
	const parsed =
		kind === "apply"
			? applyTagCommandSchema.safeParse(command)
			: removeTagCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		kind,
		tagId: parsed.data.tagId,
		workId: parsed.data.workId,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		membershipInTransaction(tx, parsed.data, commandKey, fingerprint, kind)
	);
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateTagCommand,
	commandKey: string,
	fingerprint: string
): Promise<TagWriteOutcome> {
	const workspace = await tx.workspace.findUnique({
		select: { id: true },
		where: { id: command.workspaceId },
	});
	if (!workspace) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockWorkspace(tx, workspace.id);
	const replayed = await replayTagWrite(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const name = optionalText(command.name);
	if (!name) {
		return { reason: "missing-name", status: "rejected" };
	}
	const existing = await tx.tag.findUnique({
		where: {
			workspaceId_name: { name, workspaceId: workspace.id },
		},
	});
	const tag = existing
		? toTagView(existing)
		: toTagView(
				await tx.tag.create({
					data: {
						id: crypto.randomUUID(),
						name,
						revision: 1,
						workspaceId: workspace.id,
					},
				})
			);
	await writeTagReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		tag,
	});
	return { status: "committed", tag };
}

async function membershipInTransaction(
	tx: PrismaTransaction,
	command: ApplyTagCommand | RemoveTagCommand,
	commandKey: string,
	fingerprint: string,
	kind: "apply" | "remove"
): Promise<TagMembershipOutcome> {
	const work = await tx.work.findUnique({
		include: { project: { select: { workspaceId: true } } },
		where: { id: command.workId },
	});
	if (!work || work.retiredIntoId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, work.projectId);
	const replayed = await replayMembership(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.work.findUnique({
		include: { project: { select: { workspaceId: true } } },
		where: { id: work.id },
	});
	if (!locked || locked.retiredIntoId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return {
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	const tag = await tx.tag.findUnique({ where: { id: command.tagId } });
	if (!tag || tag.workspaceId !== locked.project.workspaceId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (kind === "apply") {
		await tx.workTag.upsert({
			create: { tagId: tag.id, workId: locked.id },
			update: {},
			where: { tagId_workId: { tagId: tag.id, workId: locked.id } },
		});
	} else {
		await tx.workTag.deleteMany({
			where: { tagId: tag.id, workId: locked.id },
		});
	}
	const updated = await tx.work.update({
		data: { revision: locked.revision + 1 },
		where: { id: locked.id },
	});
	const tagIds = await loadTagIds(tx, [updated.id]);
	const record = toRecordView(updated, tagIds.get(updated.id) ?? []);
	await writeMembershipReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		record,
		tag: toTagView(tag),
	});
	return { record, status: "committed", tag: toTagView(tag) };
}

async function replayTagWrite(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<TagWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.tag.findUnique({ where: { id: existing.targetId } });
	if (live) {
		return { status: "replayed", tag: toTagView(live) };
	}
	return { conflict: MUTATION_COPY.conflict, status: "conflict" };
}

async function replayMembership(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<TagMembershipOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedMembership(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { ...stored, status: "replayed" };
}

async function writeTagReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		tag: TagView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.tag.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.tag),
			targetId: input.tag.id,
		},
	});
}

async function writeMembershipReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		record: TaggedRecordView;
		tag: TagView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.record.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify({
				record: input.record,
				tag: input.tag,
			}),
			targetId: input.record.id,
		},
	});
}

async function loadTagIds(
	db: PrismaClient | PrismaTransaction,
	workIds: string[]
): Promise<Map<string, string[]>> {
	if (workIds.length === 0) {
		return new Map();
	}
	const rows = await db.workTag.findMany({
		orderBy: { tagId: "asc" },
		where: { workId: { in: workIds } },
	});
	const byWork = new Map<string, string[]>();
	for (const row of rows) {
		const current = byWork.get(row.workId) ?? [];
		current.push(row.tagId);
		byWork.set(row.workId, current);
	}
	return byWork;
}

async function lockWorkspace(
	tx: PrismaTransaction,
	workspaceId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`tags:workspace:${workspaceId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`project-shell:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

function optionalText(value: string): string | null {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function toTagView(row: {
	id: string;
	name: string;
	revision: number;
	workspaceId: string;
}): TagView {
	return {
		id: row.id,
		name: row.name,
		revision: row.revision,
		workspaceId: row.workspaceId,
	};
}

function toRecordView(
	row: {
		id: string;
		key: string;
		projectId: string;
		revision: number;
		title: string;
	},
	tagIds: string[]
): TaggedRecordView {
	return {
		id: row.id,
		key: row.key,
		projectId: row.projectId,
		revision: row.revision,
		tagIds,
		title: row.title,
	};
}

function storedMembership(
	value: string
): { record: TaggedRecordView; tag: TagView } | null {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			!("record" in parsed) ||
			!("tag" in parsed)
		) {
			return null;
		}
		return parsed as { record: TaggedRecordView; tag: TagView };
	} catch {
		return null;
	}
}
