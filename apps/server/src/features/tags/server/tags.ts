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
	type RecordResolvedInlineUseCommand,
	type RemoveTagCommand,
	type RenameTagCommand,
	recordResolvedInlineUseCommandSchema,
	removeTagCommandSchema,
	renameTagCommandSchema,
	type TagApplyOutcome,
	type TagDocumentChangeView,
	type TaggedRecordView,
	type TagInlineUseOutcome,
	type TagMarkdownExport,
	type TagRenameOutcome,
	type TagView,
	type TagWriteOutcome,
	type UndoTagRenameCommand,
	undoTagRenameCommandSchema,
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
): Promise<TagApplyOutcome> {
	return await mutateApply(prisma, command, "apply");
}

export async function removeTag(
	prisma: PrismaClient,
	command: unknown
): Promise<TagApplyOutcome> {
	return await mutateApply(prisma, command, "remove");
}

export async function renameTag(
	prisma: PrismaClient,
	command: unknown
): Promise<TagRenameOutcome> {
	const parsed = renameTagCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		name: parsed.data.name,
		tagId: parsed.data.tagId,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		renameInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function undoTagRename(
	prisma: PrismaClient,
	command: unknown
): Promise<TagRenameOutcome> {
	const parsed = undoTagRenameCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		historyEntryId: parsed.data.historyEntryId,
		tagId: parsed.data.tagId,
		undo: true,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		undoRenameInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function recordResolvedInlineUse(
	prisma: PrismaClient,
	command: unknown
): Promise<TagInlineUseOutcome> {
	const parsed = recordResolvedInlineUseCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	return await prisma.$transaction((tx) =>
		recordInlineInTransaction(tx, parsed.data)
	);
}

export async function markdownExportTags(
	prisma: PrismaClient,
	workspaceId: string
): Promise<TagMarkdownExport> {
	const tags = await prisma.tag.findMany({
		orderBy: { name: "asc" },
		where: { workspaceId },
	});
	const uses = await prisma.tagInlineUse.findMany({
		orderBy: { documentId: "asc" },
		where: { tagId: { in: tags.map((tag) => tag.id) } },
	});
	const inlineByDocumentId: Record<string, string> = {};
	for (const use of uses) {
		inlineByDocumentId[use.documentId] = use.body;
	}
	return {
		inlineByDocumentId,
		manifest: {
			identities: tags.map((tag) => ({ id: tag.id, name: tag.name })),
		},
	};
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
	const tagIdsByWork = await loadTagIds(prisma, workIds);
	return rows.map((row) =>
		toRecordView(row.work, tagIdsByWork.get(row.workId) ?? [])
	);
}

export async function listWorkTags(
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

async function mutateApply(
	prisma: PrismaClient,
	command: unknown,
	kind: "apply" | "remove"
): Promise<TagApplyOutcome> {
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
		applyOrRemoveInTransaction(tx, parsed.data, commandKey, fingerprint, kind)
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

async function applyOrRemoveInTransaction(
	tx: PrismaTransaction,
	command: ApplyTagCommand | RemoveTagCommand,
	commandKey: string,
	fingerprint: string,
	kind: "apply" | "remove"
): Promise<TagApplyOutcome> {
	const work = await tx.work.findUnique({
		include: { project: { select: { workspaceId: true } } },
		where: { id: command.workId },
	});
	if (!work || work.retiredIntoId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, work.projectId);
	const replayed = await replayApply(tx, commandKey, fingerprint);
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
	await writeApplyReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		record,
		tag: toTagView(tag),
	});
	return { record, status: "committed", tag: toTagView(tag) };
}

async function renameInTransaction(
	tx: PrismaTransaction,
	command: RenameTagCommand,
	commandKey: string,
	fingerprint: string
): Promise<TagRenameOutcome> {
	const tag = await tx.tag.findUnique({ where: { id: command.tagId } });
	if (!tag) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockWorkspace(tx, tag.workspaceId);
	const replayed = await replayRename(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.tag.findUnique({ where: { id: tag.id } });
	if (!locked) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		return {
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	const name = optionalText(command.name);
	if (!name) {
		return { reason: "missing-name", status: "rejected" };
	}
	const taken = await tx.tag.findUnique({
		where: {
			workspaceId_name: { name, workspaceId: locked.workspaceId },
		},
	});
	if (taken && taken.id !== locked.id) {
		return { reason: "name-taken", status: "rejected" };
	}
	const updated = await tx.tag.update({
		data: { name, revision: locked.revision + 1 },
		where: { id: locked.id },
	});
	const documentChanges = await rewriteInlineUses(
		tx,
		updated.id,
		locked.name,
		name
	);
	const view = toTagView(updated);
	const historyEntryId = crypto.randomUUID();
	await writeRenameReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		historyEntryId,
		previousName: locked.name,
		result: {
			documentChanges,
			historyEntryId,
			tag: view,
			undo: MUTATION_COPY.undo,
		},
		tag: view,
	});
	return {
		documentChanges,
		historyEntryId,
		status: "committed",
		tag: view,
		undo: MUTATION_COPY.undo,
	};
}

async function undoRenameInTransaction(
	tx: PrismaTransaction,
	command: UndoTagRenameCommand,
	commandKey: string,
	fingerprint: string
): Promise<TagRenameOutcome> {
	const tag = await tx.tag.findUnique({ where: { id: command.tagId } });
	if (!tag) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockWorkspace(tx, tag.workspaceId);
	const replayed = await replayRename(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	if (tag.revision !== command.baseRevision) {
		return {
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	const history = await tx.mutationReceipt.findUnique({
		where: { id: command.historyEntryId },
	});
	if (!history || history.targetId !== tag.id) {
		return { reason: "history-not-found", status: "rejected" };
	}
	const stored = storedRename(history.resultValue);
	if (!stored) {
		return { reason: "history-not-found", status: "rejected" };
	}
	const previousName = storedPreviousName(history.resultValue);
	if (!previousName) {
		return { reason: "undo-not-safe", status: "rejected" };
	}
	const liveRows = await Promise.all(
		stored.documentChanges.map((change) =>
			tx.tagInlineUse.findUnique({
				where: {
					tagId_documentId: {
						documentId: change.documentId,
						tagId: tag.id,
					},
				},
			})
		)
	);
	if (
		liveRows.some(
			(live, index) =>
				!live || live.body !== stored.documentChanges[index]?.nextBody
		)
	) {
		return { reason: "undo-not-safe", status: "rejected" };
	}
	const taken = await tx.tag.findUnique({
		where: {
			workspaceId_name: {
				name: previousName,
				workspaceId: tag.workspaceId,
			},
		},
	});
	if (taken && taken.id !== tag.id) {
		return { reason: "name-taken", status: "rejected" };
	}
	const updated = await tx.tag.update({
		data: { name: previousName, revision: tag.revision + 1 },
		where: { id: tag.id },
	});
	const restoredRows = await Promise.all(
		stored.documentChanges.map((change) =>
			tx.tagInlineUse.update({
				data: {
					body: change.previousBody,
					revision: change.revision + 1,
				},
				where: {
					tagId_documentId: {
						documentId: change.documentId,
						tagId: tag.id,
					},
				},
			})
		)
	);
	const documentChanges: TagDocumentChangeView[] = restoredRows.map(
		(restored, index) => ({
			documentId: restored.documentId,
			nextBody: restored.body,
			previousBody: stored.documentChanges[index]?.nextBody ?? restored.body,
			revision: restored.revision,
			undo: MUTATION_COPY.undo,
		})
	);
	const view = toTagView(updated);
	const historyEntryId = crypto.randomUUID();
	await writeRenameReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		historyEntryId,
		previousName: tag.name,
		result: {
			documentChanges,
			historyEntryId,
			tag: view,
			undo: MUTATION_COPY.undo,
		},
		tag: view,
	});
	return {
		documentChanges,
		historyEntryId,
		status: "committed",
		tag: view,
		undo: MUTATION_COPY.undo,
	};
}

async function recordInlineInTransaction(
	tx: PrismaTransaction,
	command: RecordResolvedInlineUseCommand
): Promise<TagInlineUseOutcome> {
	const tag = await tx.tag.findUnique({ where: { id: command.tagId } });
	if (!tag) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const existing = await tx.tagInlineUse.findUnique({
		where: {
			tagId_documentId: {
				documentId: command.documentId,
				tagId: tag.id,
			},
		},
	});
	const row = existing
		? await tx.tagInlineUse.update({
				data: {
					body: command.body,
					revision: existing.revision + 1,
				},
				where: { id: existing.id },
			})
		: await tx.tagInlineUse.create({
				data: {
					body: command.body,
					documentId: command.documentId,
					id: crypto.randomUUID(),
					revision: 1,
					tagId: tag.id,
				},
			});
	return {
		body: row.body,
		documentId: row.documentId,
		revision: row.revision,
		status: "committed",
		tagId: tag.id,
	};
}

async function rewriteInlineUses(
	tx: PrismaTransaction,
	tagId: string,
	previousName: string,
	nextName: string
): Promise<TagDocumentChangeView[]> {
	const uses = await tx.tagInlineUse.findMany({
		orderBy: { documentId: "asc" },
		where: { tagId },
	});
	const updatedRows = await Promise.all(
		uses.map((use) =>
			tx.tagInlineUse.update({
				data: {
					body: rewriteToken(use.body, previousName, nextName),
					revision: use.revision + 1,
				},
				where: { id: use.id },
			})
		)
	);
	return updatedRows.map((updated, index) => ({
		documentId: updated.documentId,
		nextBody: updated.body,
		previousBody: uses[index]?.body ?? updated.body,
		revision: updated.revision,
		undo: MUTATION_COPY.undo,
	}));
}

function rewriteToken(
	body: string,
	previousName: string,
	nextName: string
): string {
	const token = `#${previousName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
	return body.replace(new RegExp(token, "g"), `#${nextName}`);
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

async function replayApply(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<TagApplyOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedApply(existing.resultValue);
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

async function writeApplyReceipt(
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

async function writeRenameReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		historyEntryId: string;
		previousName: string;
		result: {
			documentChanges: TagDocumentChangeView[];
			historyEntryId: string;
			tag: TagView;
			undo: typeof MUTATION_COPY.undo;
		};
		tag: TagView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.tag.revision,
			id: input.historyEntryId,
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify({
				...input.result,
				previousName: input.previousName,
			}),
			targetId: input.tag.id,
		},
	});
}

async function replayRename(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<TagRenameOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedRename(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { ...stored, status: "replayed" };
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

function storedApply(
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

function storedRename(value: string): {
	documentChanges: TagDocumentChangeView[];
	historyEntryId: string;
	tag: TagView;
	undo: typeof MUTATION_COPY.undo;
} | null {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			!("documentChanges" in parsed) ||
			!("historyEntryId" in parsed) ||
			!("tag" in parsed) ||
			!("undo" in parsed)
		) {
			return null;
		}
		const row = parsed as {
			documentChanges: TagDocumentChangeView[];
			historyEntryId: string;
			tag: TagView;
			undo: typeof MUTATION_COPY.undo;
		};
		return {
			documentChanges: row.documentChanges,
			historyEntryId: row.historyEntryId,
			tag: row.tag,
			undo: row.undo,
		};
	} catch {
		return null;
	}
}

function storedPreviousName(value: string): string | null {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			!("previousName" in parsed) ||
			typeof (parsed as { previousName: unknown }).previousName !== "string"
		) {
			return null;
		}
		return (parsed as { previousName: string }).previousName;
	} catch {
		return null;
	}
}
