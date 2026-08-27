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
	type CreateUsageLinkCommand,
	createUsageLinkCommandSchema,
	inspectRecordGraph,
	isUsageKind,
	type RecordGraphView,
	type RelationsWriteOutcome,
	STANDARD_RELATION_TYPE,
	toUsageLinkView,
	type UnlinkUsageLinkCommand,
	type UsageKind,
	type UsageLinkView,
	unlinkUsageLinkCommandSchema,
} from "./relations-model";

type PrismaTransaction = Prisma.TransactionClient;

export function createUsageLink(
	prisma: PrismaClient,
	command: unknown
): Promise<RelationsWriteOutcome> {
	const parsed = createUsageLinkCommandSchema.safeParse(command);
	if (!parsed.success) {
		return Promise.resolve({
			reason: "unknown-usage-kind",
			status: "rejected",
		});
	}
	if (parsed.data.evidenceRole !== undefined) {
		return Promise.resolve({
			reason: "evidence-role-not-allowed",
			status: "rejected",
		});
	}
	if (!isUsageKind(parsed.data.kind)) {
		return Promise.resolve({
			reason: "unknown-usage-kind",
			status: "rejected",
		});
	}
	const fingerprint = payloadFingerprint({
		hostRecordId: parsed.data.hostRecordId,
		kind: parsed.data.kind,
		sourceRecordId: parsed.data.sourceRecordId,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return prisma.$transaction((tx) =>
		createUsageInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export function unlinkUsageLink(
	prisma: PrismaClient,
	command: unknown
): Promise<RelationsWriteOutcome> {
	const parsed = unlinkUsageLinkCommandSchema.safeParse(command);
	if (!parsed.success) {
		return Promise.resolve({
			reason: "target-not-found",
			status: "rejected",
		});
	}
	const fingerprint = payloadFingerprint({
		usageLinkId: parsed.data.usageLinkId,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return prisma.$transaction((tx) =>
		unlinkUsageInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function inspectRelations(
	prisma: PrismaClient,
	recordId: string
): Promise<RecordGraphView> {
	const usageRows = await prisma.usageLink.findMany({
		orderBy: { createdAt: "asc" },
		where: {
			OR: [{ hostRecordId: recordId }, { sourceRecordId: recordId }],
		},
	});
	const usageLinks: UsageLinkView[] = [];
	for (const row of usageRows) {
		if (!isUsageKind(row.kind)) {
			continue;
		}
		usageLinks.push(
			toUsageLinkView({
				embedId: row.embedId,
				hostRecordId: row.hostRecordId,
				id: row.id,
				kind: row.kind,
				sourceRecordId: row.sourceRecordId,
			})
		);
	}
	const relatedEdges = await prisma.workRelatedEdge.findMany({
		where: {
			OR: [{ fromWorkId: recordId }, { toWorkId: recordId }],
		},
	});
	const relatedRows = await prisma.workRelation.findMany({
		where: {
			OR: [{ fromId: recordId }, { toId: recordId }],
		},
	});
	const typedRelations = [
		...relatedEdges
			.filter((row) => row.kind === STANDARD_RELATION_TYPE.related)
			.map((row) => ({
				id: row.id,
				type: STANDARD_RELATION_TYPE.related,
			})),
		...relatedRows
			.filter((row) => row.kind === STANDARD_RELATION_TYPE.related)
			.map((row) => ({
				id: row.id,
				type: STANDARD_RELATION_TYPE.related,
			})),
	];
	return inspectRecordGraph({ typedRelations, usageLinks });
}

async function createUsageInTransaction(
	tx: PrismaTransaction,
	command: CreateUsageLinkCommand,
	commandKey: string,
	fingerprint: string
): Promise<RelationsWriteOutcome> {
	const host = await tx.work.findUnique({
		where: { id: command.hostRecordId },
	});
	const source = await tx.work.findUnique({
		where: { id: command.sourceRecordId },
	});
	if (!(host && source) || host.retiredIntoId || source.retiredIntoId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (host.projectId !== source.projectId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, host.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const kind = command.kind as UsageKind;
	const embedId = crypto.randomUUID();
	const usageId = crypto.randomUUID();
	const project = await tx.project.findUnique({
		where: { id: host.projectId },
	});
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await tx.usageHostEmbed.create({
		data: {
			hostRecordId: host.id,
			id: embedId,
			kind,
			sourceRecordId: source.id,
		},
	});
	await tx.usageLink.create({
		data: {
			embedId,
			hostRecordId: host.id,
			id: usageId,
			kind,
			sourceRecordId: source.id,
			workspaceId: project.workspaceId,
		},
	});
	await tx.work.update({
		data: { revision: host.revision + 1 },
		where: { id: host.id },
	});
	return await committedUsage(tx, {
		actorId: command.actorId,
		commandKey,
		embedId,
		fingerprint,
		hostId: host.id,
		kind,
		sourceId: source.id,
		usageId,
	});
}

async function unlinkUsageInTransaction(
	tx: PrismaTransaction,
	command: UnlinkUsageLinkCommand,
	commandKey: string,
	fingerprint: string
): Promise<RelationsWriteOutcome> {
	const link = await tx.usageLink.findUnique({
		where: { id: command.usageLinkId },
	});
	if (!(link && isUsageKind(link.kind))) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const host = await tx.work.findUnique({
		where: { id: link.hostRecordId },
	});
	if (!host) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, host.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	await tx.usageLink.delete({ where: { id: link.id } });
	await tx.usageHostEmbed.deleteMany({ where: { id: link.embedId } });
	await tx.work.update({
		data: { revision: host.revision + 1 },
		where: { id: host.id },
	});
	return await committedUsage(tx, {
		actorId: command.actorId,
		commandKey,
		embedId: link.embedId,
		fingerprint,
		hostId: link.hostRecordId,
		kind: link.kind,
		sourceId: link.sourceRecordId,
		usageId: link.id,
	});
}

async function committedUsage(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		embedId: string;
		fingerprint: string;
		hostId: string;
		kind: UsageKind;
		sourceId: string;
		usageId: string;
	}
): Promise<RelationsWriteOutcome> {
	const hostWork = await tx.work.findUnique({ where: { id: input.hostId } });
	const sourceWork = await tx.work.findUnique({
		where: { id: input.sourceId },
	});
	if (!(hostWork && sourceWork)) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const usageLink = toUsageLinkView({
		embedId: input.embedId,
		hostRecordId: input.hostId,
		id: input.usageId,
		kind: input.kind,
		sourceRecordId: input.sourceId,
	});
	const host = {
		id: hostWork.id,
		revision: hostWork.revision,
		status: hostWork.status,
	};
	const source = {
		id: sourceWork.id,
		revision: sourceWork.revision,
		status: sourceWork.status,
	};
	await writeReceipt(tx, {
		actorId: input.actorId,
		commandKey: input.commandKey,
		fingerprint: input.fingerprint,
		host,
		source,
		usageLink,
	});
	return {
		embed: {
			hostRecordId: input.hostId,
			id: input.embedId,
			sourceRecordId: input.sourceId,
		},
		host,
		source,
		status: "committed",
		usageLink,
	};
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<RelationsWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedUsage(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { ...stored, status: "replayed" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		host: { id: string; revision: number; status: string };
		source: { id: string; revision: number; status: string };
		usageLink: UsageLinkView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.host.revision,
			id: crypto.randomUUID(),
			kind: "commit",
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify({
				embed: {
					hostRecordId: input.usageLink.hostRecordId,
					id: input.usageLink.embedId,
					sourceRecordId: input.usageLink.sourceRecordId,
				},
				host: input.host,
				source: input.source,
				usageLink: input.usageLink,
			}),
			targetId: input.host.id,
		},
	});
}

function storedUsage(
	value: string
): Omit<
	Extract<RelationsWriteOutcome, { status: "committed" }>,
	"status"
> | null {
	try {
		const parsed: unknown = JSON.parse(value);
		const envelope = z
			.object({
				embed: z.object({
					hostRecordId: z.string(),
					id: z.string(),
					sourceRecordId: z.string(),
				}),
				host: z
					.object({
						id: z.string(),
						revision: z.number(),
						status: z.string(),
					})
					.optional(),
				source: z
					.object({
						id: z.string(),
						revision: z.number(),
						status: z.string(),
					})
					.optional(),
				usageLink: z.object({
					embedId: z.string(),
					hostRecordId: z.string(),
					id: z.string(),
					kind: z.string(),
					kindLabel: z.string(),
					sourceRecordId: z.string(),
				}),
			})
			.safeParse(parsed);
		if (!(envelope.success && isUsageKind(envelope.data.usageLink.kind))) {
			return null;
		}
		const usageLink = toUsageLinkView({
			embedId: envelope.data.usageLink.embedId,
			hostRecordId: envelope.data.usageLink.hostRecordId,
			id: envelope.data.usageLink.id,
			kind: envelope.data.usageLink.kind,
			sourceRecordId: envelope.data.usageLink.sourceRecordId,
		});
		return {
			embed: envelope.data.embed,
			host: envelope.data.host ?? {
				id: usageLink.hostRecordId,
				revision: 0,
				status: "",
			},
			source: envelope.data.source ?? {
				id: usageLink.sourceRecordId,
				revision: 0,
				status: "",
			},
			usageLink,
		};
	} catch {
		return null;
	}
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`project-shell:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}
