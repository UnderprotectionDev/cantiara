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
	BROKEN_REASONS,
	type BrokenReason,
	catalogTypes,
	inverseTypeLabel,
	type OriginLocationInput,
	parseRecordKind,
	parseRelationType,
	RELATIONS_COPY,
	type RecordKind,
	type RecordRef,
	type RelationType,
	validateRelationEnds,
} from "./relations-catalog";
import {
	type CreateRelationCommand,
	type CreateUsageLinkCommand,
	createRelationCommandSchema,
	createUsageLinkCommandSchema,
	type DeleteRelationCommand,
	deleteRelationCommandSchema,
	inspectRecordGraph,
	isRecord,
	isUsageKind,
	presentUsedIn,
	previewRelationInputSchema,
	type RecordGraphView,
	type RelationsWriteOutcome,
	STANDARD_RELATION_TYPE,
	toUsageLinkView,
	type UndoRelationCommand,
	type UnlinkUsageLinkCommand,
	USAGE_KIND,
	type UsageKind,
	type UsageLinkView,
	type UsedInRow,
	undoRelationCommandSchema,
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
		workspaceId: parsed.data.workspaceId,
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
	recordId: string,
	workspaceId: string
): Promise<RecordGraphView> {
	const usageRows = await prisma.usageLink.findMany({
		orderBy: { createdAt: "asc" },
		where: {
			AND: [
				{ workspaceId },
				{
					OR: [{ hostRecordId: recordId }, { sourceRecordId: recordId }],
				},
			],
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
	const catalogRows = await prisma.typedRelation.findMany({
		where: {
			OR: [
				{ fromId: recordId, fromKind: "Work" },
				{ toId: recordId, toKind: "Work" },
			],
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
		...catalogRows
			.filter((row) => row.type === STANDARD_RELATION_TYPE.related)
			.map((row) => ({
				id: row.id,
				type: STANDARD_RELATION_TYPE.related,
			})),
	];
	const listed = await listRelations(prisma, {
		record: { id: recordId, kind: "Work" },
		viewerWorkspaceId: workspaceId,
	});
	const relationBacklinks: UsedInRow[] = [];
	for (const relation of listed) {
		const viewpoint = relation.from.id === recordId ? "from" : "to";
		const other = viewpoint === "from" ? relation.to : relation.from;
		const groupLabel =
			viewpoint === "from" ? relation.typeLabelFrom : relation.typeLabelTo;
		const row = usedInRowFromEnd(relation.id, other, groupLabel);
		if (row) {
			relationBacklinks.push(row);
		}
	}
	const usedInUsageRows = (
		await Promise.all(
			usageLinks
				.filter((link) => link.sourceRecordId === recordId)
				.map((link) => usedInRowForUsageHost(prisma, link, workspaceId))
		)
	).filter((row): row is UsedInRow => row !== null);
	return inspectRecordGraph({
		typedRelations,
		usageLinks,
		usedIn: presentUsedIn({
			relationBacklinks,
			usageRows: usedInUsageRows,
		}),
	});
}

export async function listUsageLinksForHosts(
	prisma: PrismaClient,
	workspaceId: string,
	hostRecordIds: readonly string[]
): Promise<Record<string, UsageLinkView[]>> {
	const grouped: Record<string, UsageLinkView[]> = {};
	for (const hostRecordId of hostRecordIds) {
		grouped[hostRecordId] = [];
	}
	if (hostRecordIds.length === 0) {
		return grouped;
	}
	let usageRows: Awaited<ReturnType<PrismaClient["usageLink"]["findMany"]>>;
	try {
		usageRows = await prisma.usageLink.findMany({
			orderBy: { createdAt: "asc" },
			where: {
				hostRecordId: { in: [...hostRecordIds] },
				workspaceId,
			},
		});
	} catch (error) {
		if (isMissingUsageStore(error)) {
			return grouped;
		}
		throw error;
	}
	for (const row of usageRows) {
		if (!isUsageKind(row.kind)) {
			continue;
		}
		grouped[row.hostRecordId]?.push(
			toUsageLinkView({
				embedId: row.embedId,
				hostRecordId: row.hostRecordId,
				id: row.id,
				kind: row.kind,
				sourceRecordId: row.sourceRecordId,
			})
		);
	}
	return grouped;
}

async function createUsageInTransaction(
	tx: PrismaTransaction,
	command: CreateUsageLinkCommand,
	commandKey: string,
	fingerprint: string
): Promise<RelationsWriteOutcome> {
	const hostWork = await tx.work.findUnique({
		where: { id: command.hostRecordId },
	});
	const sourceWork = await tx.work.findUnique({
		where: { id: command.sourceRecordId },
	});
	if (hostWork?.retiredIntoId || sourceWork?.retiredIntoId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (hostWork && sourceWork && hostWork.projectId !== sourceWork.projectId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (hostWork) {
		await lockProject(tx, hostWork.projectId);
	}
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const kind = command.kind as UsageKind;
	const embedId = crypto.randomUUID();
	const usageId = crypto.randomUUID();
	await tx.usageHostEmbed.create({
		data: {
			hostRecordId: command.hostRecordId,
			id: embedId,
			kind,
			sourceRecordId: command.sourceRecordId,
		},
	});
	await tx.usageLink.create({
		data: {
			embedId,
			hostRecordId: command.hostRecordId,
			id: usageId,
			kind,
			sourceRecordId: command.sourceRecordId,
			workspaceId: command.workspaceId,
		},
	});
	if (hostWork) {
		await tx.work.update({
			data: { revision: hostWork.revision + 1 },
			where: { id: hostWork.id },
		});
	}
	return await committedUsage(tx, {
		actorId: command.actorId,
		commandKey,
		embedId,
		fingerprint,
		hostId: command.hostRecordId,
		kind,
		sourceId: command.sourceRecordId,
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
	const hostWork = await tx.work.findUnique({
		where: { id: link.hostRecordId },
	});
	if (hostWork) {
		await lockProject(tx, hostWork.projectId);
	}
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	await tx.usageLink.delete({ where: { id: link.id } });
	await tx.usageHostEmbed.deleteMany({ where: { id: link.embedId } });
	if (hostWork) {
		await tx.work.update({
			data: { revision: hostWork.revision + 1 },
			where: { id: hostWork.id },
		});
	}
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
	const usageLink = toUsageLinkView({
		embedId: input.embedId,
		hostRecordId: input.hostId,
		id: input.usageId,
		kind: input.kind,
		sourceRecordId: input.sourceId,
	});
	const host = {
		id: hostWork?.id ?? input.hostId,
		revision: hostWork?.revision ?? 0,
		status: hostWork?.status ?? "",
	};
	const source = {
		id: sourceWork?.id ?? input.sourceId,
		revision: sourceWork?.revision ?? 0,
		status: sourceWork?.status ?? "",
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

export type RelationRejectionReason =
	| "cardinality"
	| "cycle"
	| "ends-not-allowed"
	| "missing-idempotency-key"
	| "owned-component-not-an-end"
	| "preview-required"
	| "same-end"
	| "silent-retarget"
	| "target-not-found"
	| "unknown-relation-type"
	| "origin-location-not-allowed";

export type RelationOutcome =
	| {
			copy: typeof RELATIONS_COPY;
			relation: PresentedRelation;
			status: "committed";
			undo: typeof MUTATION_COPY.undo;
	  }
	| { relation: PresentedRelation; status: "replayed" }
	| { reason: RelationRejectionReason; status: "rejected" }
	| { conflict: typeof MUTATION_COPY.conflict; status: "conflict" };

export interface OriginLocationView {
	componentId: string;
	missing: boolean;
	ownerId: string;
	ownerKind: RecordKind;
	sourceVersion: string;
}

export type PresentedEnd =
	| {
			id: string;
			kind: RecordKind;
			key?: string;
			openSourceRecord: true;
			status: "resolved";
			title: string;
			workStatus?: string;
	  }
	| {
			establishedAt: string;
			id: string;
			kind: RecordKind;
			openSourceRecord: boolean;
			reason: BrokenReason;
			status: "broken";
			title?: string;
	  };

export interface PresentedRelation {
	establishedAt: string;
	from: PresentedEnd;
	id: string;
	originLocation: OriginLocationView | null;
	to: PresentedEnd;
	type: RelationType;
	typeLabelFrom: string;
	typeLabelTo: string;
}

export interface RelationPreview {
	copy: typeof RELATIONS_COPY;
	from: PresentedEnd;
	originLocation: OriginLocationView | null;
	to: PresentedEnd;
	type: RelationType;
}

export interface EndLifecycleOverride {
	access?: "ok" | "none";
	body?: string;
	reason?: BrokenReason;
	title?: string;
}

export interface RelationListQuery {
	endOverrides?: Record<string, EndLifecycleOverride>;
	record: RecordRef;
	viewerWorkspaceId: string;
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

function isMissingUsageStore(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error.code === "P2021" || error.code === "P2022")
	);
}

function usedInRowFromEnd(
	id: string,
	end: PresentedEnd,
	groupLabel: string
): UsedInRow | null {
	if (end.status === "broken") {
		if (
			end.reason === RELATIONS_COPY.noAccess ||
			end.reason === RELATIONS_COPY.permanentlyDeleted ||
			end.reason === RELATIONS_COPY.redactedForSecurity
		) {
			return null;
		}
		return {
			groupLabel,
			id,
			openSourceRecord: end.openSourceRecord,
			reason: end.reason,
			sourceRecordId: end.id,
			title: end.title,
		};
	}
	return {
		groupLabel,
		id,
		key: end.key,
		openSourceRecord: true,
		sourceRecordId: end.id,
		title: end.title,
	};
}

async function usedInRowForUsageHost(
	db: PrismaClient | PrismaTransaction,
	link: UsageLinkView,
	workspaceId: string
): Promise<UsedInRow | null> {
	const work = await db.work.findUnique({
		where: { id: link.hostRecordId },
	});
	if (!work) {
		if (link.kind !== USAGE_KIND.flowNodeScreenReference) {
			return null;
		}
		return {
			groupLabel: link.kindLabel,
			id: link.id,
			openSourceRecord: false,
			sourceRecordId: link.hostRecordId,
		};
	}
	const end = await presentEnd(db, {
		establishedAt: new Date(0).toISOString(),
		id: work.id,
		kind: "Work",
		overrides: {},
		viewerWorkspaceId: workspaceId,
	});
	return usedInRowFromEnd(link.id, end, link.kindLabel);
}

function overlayKey(kind: string, id: string): string {
	return `${kind}:${id}`;
}

function parseKeyedCommand<T>(
	command: unknown,
	schema: {
		safeParse: (
			value: unknown
		) => { data: T; success: true } | { success: false };
	}
):
	| { command: T; status: "ok" }
	| { outcome: RelationOutcome; status: "rejected" } {
	if (!isRecord(command)) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		typeof command.idempotencyKey !== "string" ||
		command.idempotencyKey.length === 0
	) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = schema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "unknown-relation-type", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

export async function previewRelation(
	prisma: PrismaClient,
	input: unknown,
	endOverrides: Record<string, EndLifecycleOverride> = {}
): Promise<
	| { preview: RelationPreview; status: "ok" }
	| { reason: RelationRejectionReason; status: "rejected" }
> {
	const parsed = previewRelationInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "unknown-relation-type", status: "rejected" };
	}
	const type = parseRelationType(parsed.data.type);
	if (!type) {
		return { reason: "unknown-relation-type", status: "rejected" };
	}
	const ends = validateRelationEnds({
		from: parsed.data.from,
		originLocation: parsed.data.originLocation,
		to: parsed.data.to,
		type,
	});
	if (ends.status === "rejected") {
		return {
			reason: ends.reason as RelationRejectionReason,
			status: "rejected",
		};
	}
	const establishedAt = new Date(0).toISOString();
	const from = await presentEnd(prisma, {
		establishedAt,
		id: parsed.data.from.id,
		kind: parsed.data.from.kind,
		overrides: endOverrides,
		viewerWorkspaceId: parsed.data.viewerWorkspaceId,
	});
	const to = await presentEnd(prisma, {
		establishedAt,
		id: parsed.data.to.id,
		kind: parsed.data.to.kind,
		overrides: endOverrides,
		viewerWorkspaceId: parsed.data.viewerWorkspaceId,
	});
	return {
		preview: {
			copy: RELATIONS_COPY,
			from,
			originLocation: originLocationView(parsed.data.originLocation, false),
			to,
			type,
		},
		status: "ok",
	};
}

export async function createRelation(
	prisma: PrismaClient,
	command: unknown,
	endOverrides: Record<string, EndLifecycleOverride> = {}
): Promise<RelationOutcome> {
	return await prisma.$transaction((tx) =>
		createRelationInTransaction(tx, command, endOverrides)
	);
}

export async function createRelationInTransaction(
	tx: PrismaTransaction,
	command: unknown,
	endOverrides: Record<string, EndLifecycleOverride> = {}
): Promise<RelationOutcome> {
	await Promise.resolve();
	const parsed = parseKeyedCommand(command, createRelationCommandSchema);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	if (parsed.command.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	const type = parseRelationType(parsed.command.type);
	if (!type) {
		return { reason: "unknown-relation-type", status: "rejected" };
	}
	const typedCommand = { ...parsed.command, type };
	const ends = validateRelationEnds(typedCommand);
	if (ends.status === "rejected") {
		return {
			reason: ends.reason as RelationRejectionReason,
			status: "rejected",
		};
	}
	const fingerprint = payloadFingerprint({
		from: parsed.command.from,
		originLocation: parsed.command.originLocation ?? null,
		to: parsed.command.to,
		type,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return createInTransaction(
		tx,
		typedCommand,
		commandKey,
		fingerprint,
		endOverrides
	);
}

export async function deleteRelation(
	prisma: PrismaClient,
	command: unknown
): Promise<RelationOutcome> {
	const parsed = parseKeyedCommand(command, deleteRelationCommandSchema);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		delete: true,
		relationId: parsed.command.relationId,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		deleteInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function undoRelation(
	prisma: PrismaClient,
	command: unknown
): Promise<RelationOutcome> {
	const parsed = parseKeyedCommand(command, undoRelationCommandSchema);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	return await deleteRelation(prisma, parsed.command);
}

export async function listRelations(
	prisma: PrismaClient,
	query: RelationListQuery
): Promise<PresentedRelation[]> {
	const rows = await prisma.typedRelation.findMany({
		orderBy: { establishedAt: "asc" },
		where: {
			OR: [
				{ fromId: query.record.id, fromKind: query.record.kind },
				{ toId: query.record.id, toKind: query.record.kind },
			],
		},
	});
	return await Promise.all(
		rows.map((row) =>
			presentRelation(prisma, row, query.viewerWorkspaceId, query.endOverrides)
		)
	);
}

export function indexableContent(end: PresentedEnd): string[] {
	if (end.status === "broken") {
		return [];
	}
	return [end.title, end.key].flatMap((value) => (value ? [value] : []));
}

export function exportableContent(end: PresentedEnd): string[] {
	return indexableContent(end);
}

export function countsTowardComputed(end: PresentedEnd): boolean {
	return end.status === "resolved";
}

export function brokenEndSideEffects(_end: PresentedEnd): {
	attention: false;
	followUpWork: false;
} {
	return { attention: false, followUpWork: false };
}

export function relationsCatalog() {
	return {
		copy: RELATIONS_COPY,
		genericTypes: [RELATIONS_COPY.related, RELATIONS_COPY.origin],
		types: catalogTypes(),
	};
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateRelationCommand,
	commandKey: string,
	fingerprint: string,
	endOverrides: Record<string, EndLifecycleOverride>
): Promise<RelationOutcome> {
	const existingReceipt = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existingReceipt) {
		if (existingReceipt.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const stored = parseStoredRelation(existingReceipt.resultValue);
		if (stored) {
			return { relation: stored, status: "replayed" };
		}
	}
	const cardinality = await rejectCardinality(tx, command);
	if (cardinality) {
		return cardinality;
	}
	const cycle = await rejectSupersedesCycle(tx, command);
	if (cycle) {
		return cycle;
	}
	const retarget = await rejectSilentRetarget(tx, command);
	if (retarget) {
		return retarget;
	}
	const created = await tx.typedRelation.create({
		data: {
			blockerState:
				command.type === RELATIONS_COPY.blocks
					? (command.blockerState ?? "Active")
					: null,
			fromId: command.from.id,
			fromKind: command.from.kind,
			id: crypto.randomUUID(),
			originComponentId: command.originLocation?.componentId ?? null,
			originComponentMissing: false,
			originOwnerId: command.originLocation?.ownerId ?? null,
			originOwnerKind: command.originLocation?.ownerKind ?? null,
			originSourceVersion: command.originLocation?.sourceVersion ?? null,
			revision: 1,
			toId: command.to.id,
			toKind: command.to.kind,
			type: command.type,
		},
	});
	const relation = await presentRelation(
		tx,
		created,
		command.viewerWorkspaceId,
		endOverrides
	);
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: created.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(relation),
			targetId: created.id,
		},
	});
	return {
		copy: RELATIONS_COPY,
		relation,
		status: "committed",
		undo: MUTATION_COPY.undo,
	};
}

async function deleteInTransaction(
	tx: PrismaTransaction,
	command: DeleteRelationCommand | UndoRelationCommand,
	commandKey: string,
	fingerprint: string
): Promise<RelationOutcome> {
	const existingReceipt = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existingReceipt) {
		if (existingReceipt.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const stored = parseStoredRelation(existingReceipt.resultValue);
		if (stored) {
			return { relation: stored, status: "replayed" };
		}
	}
	const row = await tx.typedRelation.findUnique({
		where: { id: command.relationId },
	});
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const relation = await presentRelation(
		tx,
		row,
		command.viewerWorkspaceId,
		{}
	);
	await tx.typedRelation.delete({ where: { id: row.id } });
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: row.revision,
			id: crypto.randomUUID(),
			kind: "undo",
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(relation),
			targetId: row.id,
		},
	});
	return {
		copy: RELATIONS_COPY,
		relation,
		status: "committed",
		undo: MUTATION_COPY.undo,
	};
}

async function rejectCardinality(
	tx: PrismaTransaction,
	command: CreateRelationCommand
): Promise<RelationOutcome | null> {
	if (command.type === RELATIONS_COPY.includes) {
		const existing = await tx.typedRelation.findFirst({
			where: {
				toId: command.to.id,
				toKind: command.to.kind,
				type: RELATIONS_COPY.includes,
			},
		});
		if (existing) {
			return { reason: "cardinality", status: "rejected" };
		}
	}
	if (
		command.type === RELATIONS_COPY.primarySpec ||
		command.type === RELATIONS_COPY.belongsToCompany ||
		command.type === RELATIONS_COPY.participant
	) {
		const existing = await tx.typedRelation.findFirst({
			where: {
				fromId: command.from.id,
				fromKind: command.from.kind,
				type: command.type,
			},
		});
		if (existing) {
			return { reason: "cardinality", status: "rejected" };
		}
	}
	return null;
}

async function rejectSupersedesCycle(
	tx: PrismaTransaction,
	command: CreateRelationCommand
): Promise<RelationOutcome | null> {
	if (command.type !== RELATIONS_COPY.supersedes) {
		return null;
	}
	const edges = await tx.typedRelation.findMany({
		where: {
			fromKind: command.from.kind,
			type: RELATIONS_COPY.supersedes,
		},
	});
	const outgoing = new Map<string, string[]>();
	for (const edge of edges) {
		const next = outgoing.get(edge.fromId) ?? [];
		next.push(edge.toId);
		outgoing.set(edge.fromId, next);
	}
	const visited = new Set<string>();
	const frontier = [command.to.id];
	while (frontier.length > 0) {
		const id = frontier.pop();
		if (!id || visited.has(id)) {
			continue;
		}
		if (id === command.from.id) {
			return { reason: "cycle", status: "rejected" };
		}
		visited.add(id);
		for (const nextId of outgoing.get(id) ?? []) {
			frontier.push(nextId);
		}
	}
	return null;
}

async function rejectSilentRetarget(
	tx: PrismaTransaction,
	command: CreateRelationCommand
): Promise<RelationOutcome | null> {
	if (command.type !== RELATIONS_COPY.origin || !command.originLocation) {
		return null;
	}
	const existing = await tx.typedRelation.findUnique({
		where: {
			type_fromKind_fromId_toKind_toId: {
				fromId: command.from.id,
				fromKind: command.from.kind,
				toId: command.to.id,
				toKind: command.to.kind,
				type: command.type,
			},
		},
	});
	if (!existing) {
		return null;
	}
	if (
		existing.originComponentId !== command.originLocation.componentId ||
		existing.originSourceVersion !== command.originLocation.sourceVersion
	) {
		return { reason: "silent-retarget", status: "rejected" };
	}
	return null;
}

async function presentRelation(
	db: PrismaClient | PrismaTransaction,
	row: {
		establishedAt: Date;
		fromId: string;
		fromKind: string;
		id: string;
		originComponentId: string | null;
		originComponentMissing: boolean;
		originOwnerId: string | null;
		originOwnerKind: string | null;
		originSourceVersion: string | null;
		toId: string;
		toKind: string;
		type: string;
	},
	viewerWorkspaceId: string,
	overrides: Record<string, EndLifecycleOverride> = {}
): Promise<PresentedRelation> {
	const type = parseRelationType(row.type) ?? RELATIONS_COPY.related;
	const fromKind = parseRecordKind(row.fromKind) ?? "Work";
	const toKind = parseRecordKind(row.toKind) ?? "Work";
	const establishedAt = row.establishedAt.toISOString();
	const from = await presentEnd(db, {
		establishedAt,
		id: row.fromId,
		kind: fromKind,
		overrides,
		viewerWorkspaceId,
	});
	const to = await presentEnd(db, {
		establishedAt,
		id: row.toId,
		kind: toKind,
		overrides,
		viewerWorkspaceId,
	});
	const ownerKind = row.originOwnerKind
		? parseRecordKind(row.originOwnerKind)
		: null;
	return {
		establishedAt,
		from,
		id: row.id,
		originLocation:
			row.originComponentId &&
			row.originOwnerId &&
			ownerKind &&
			row.originSourceVersion
				? {
						componentId: row.originComponentId,
						missing: row.originComponentMissing,
						ownerId: row.originOwnerId,
						ownerKind,
						sourceVersion: row.originSourceVersion,
					}
				: null,
		to,
		type,
		typeLabelFrom: inverseTypeLabel(type, "from"),
		typeLabelTo: inverseTypeLabel(type, "to"),
	};
}

async function presentEnd(
	db: PrismaClient | PrismaTransaction,
	input: {
		establishedAt: string;
		id: string;
		kind: RecordKind;
		overrides: Record<string, EndLifecycleOverride>;
		viewerWorkspaceId: string;
	}
): Promise<PresentedEnd> {
	const override = input.overrides[overlayKey(input.kind, input.id)];
	if (override?.reason) {
		return brokenEnd(input, override);
	}
	if (override?.access === "none") {
		return brokenEnd(input, {
			reason: RELATIONS_COPY.noAccess,
			title: override.title,
		});
	}
	if (input.kind === "Work") {
		const work = await db.work.findUnique({
			include: { project: true },
			where: { id: input.id },
		});
		if (!work) {
			return brokenEnd(input, { reason: RELATIONS_COPY.permanentlyDeleted });
		}
		if (work.project.workspaceId !== input.viewerWorkspaceId) {
			return brokenEnd(input, { reason: RELATIONS_COPY.noAccess });
		}
		if (work.archived) {
			return {
				establishedAt: input.establishedAt,
				id: work.id,
				kind: "Work",
				openSourceRecord: true,
				reason: RELATIONS_COPY.archived,
				status: "broken",
				title: work.title,
			};
		}
		return {
			id: work.id,
			key: work.key,
			kind: "Work",
			openSourceRecord: true,
			status: "resolved",
			title: work.title,
			workStatus: work.status,
		};
	}
	if (input.kind === "Document") {
		return await presentDocumentEnd(db, input);
	}
	return await presentRemainingEnd(db, input, override);
}

async function presentRemainingEnd(
	db: PrismaClient | PrismaTransaction,
	input: {
		establishedAt: string;
		id: string;
		kind: RecordKind;
		overrides: Record<string, EndLifecycleOverride>;
		viewerWorkspaceId: string;
	},
	override: EndLifecycleOverride | undefined
): Promise<PresentedEnd> {
	if (input.kind === "Milestone") {
		return await presentMilestoneEnd(db, input);
	}
	if (input.kind === "Project Goal") {
		return await presentProjectGoalEnd(db, input);
	}
	if (input.kind === "File Attachment") {
		return await presentFileAttachmentEnd(db, input);
	}
	if (input.kind === "Capture") {
		const capture = await db.captureInboxItem.findUnique({
			where: { id: input.id },
		});
		if (!capture) {
			return brokenEnd(input, { reason: RELATIONS_COPY.permanentlyDeleted });
		}
		if (capture.workspaceId !== input.viewerWorkspaceId) {
			return brokenEnd(input, { reason: RELATIONS_COPY.noAccess });
		}
		return {
			id: capture.id,
			kind: "Capture",
			openSourceRecord: true,
			status: "resolved",
			title: capture.body.length > 0 ? capture.body : capture.id,
		};
	}
	if (override?.title) {
		return {
			id: input.id,
			kind: input.kind,
			openSourceRecord: true,
			status: "resolved",
			title: override.title,
		};
	}
	return brokenEnd(input, { reason: RELATIONS_COPY.permanentlyDeleted });
}

async function presentDocumentEnd(
	db: PrismaClient | PrismaTransaction,
	input: {
		establishedAt: string;
		id: string;
		kind: RecordKind;
		overrides: Record<string, EndLifecycleOverride>;
		viewerWorkspaceId: string;
	}
): Promise<PresentedEnd> {
	if (!("document" in db) || typeof db.document?.findUnique !== "function") {
		return brokenEnd(input, { reason: RELATIONS_COPY.permanentlyDeleted });
	}
	const document = await db.document.findUnique({
		where: { id: input.id },
	});
	if (!document) {
		return brokenEnd(input, { reason: RELATIONS_COPY.permanentlyDeleted });
	}
	if (document.workspaceId !== input.viewerWorkspaceId) {
		return brokenEnd(input, { reason: RELATIONS_COPY.noAccess });
	}
	return {
		id: document.id,
		kind: "Document",
		openSourceRecord: true,
		status: "resolved",
		title: document.title,
	};
}

async function presentFileAttachmentEnd(
	db: PrismaClient | PrismaTransaction,
	input: {
		establishedAt: string;
		id: string;
		kind: RecordKind;
		overrides: Record<string, EndLifecycleOverride>;
		viewerWorkspaceId: string;
	}
): Promise<PresentedEnd> {
	const file = await db.fileAttachment.findUnique({
		where: { id: input.id },
	});
	if (!file) {
		return brokenEnd(input, { reason: RELATIONS_COPY.permanentlyDeleted });
	}
	if (file.workspaceId !== input.viewerWorkspaceId) {
		return brokenEnd(input, { reason: RELATIONS_COPY.noAccess });
	}
	return {
		id: file.id,
		kind: "File Attachment",
		openSourceRecord: true,
		status: "resolved",
		title: file.title,
	};
}

async function presentProjectGoalEnd(
	db: PrismaClient | PrismaTransaction,
	input: {
		establishedAt: string;
		id: string;
		kind: RecordKind;
		overrides: Record<string, EndLifecycleOverride>;
		viewerWorkspaceId: string;
	}
): Promise<PresentedEnd> {
	if (
		!("projectGoal" in db) ||
		typeof db.projectGoal?.findUnique !== "function"
	) {
		return brokenEnd(input, { reason: RELATIONS_COPY.permanentlyDeleted });
	}
	const goal = await db.projectGoal.findUnique({
		include: { project: true },
		where: { id: input.id },
	});
	if (!goal) {
		return brokenEnd(input, { reason: RELATIONS_COPY.permanentlyDeleted });
	}
	if (goal.project.workspaceId !== input.viewerWorkspaceId) {
		return brokenEnd(input, { reason: RELATIONS_COPY.noAccess });
	}
	return {
		id: goal.id,
		kind: "Project Goal",
		openSourceRecord: true,
		status: "resolved",
		title: goal.title,
	};
}

async function presentMilestoneEnd(
	db: PrismaClient | PrismaTransaction,
	input: {
		establishedAt: string;
		id: string;
		kind: RecordKind;
		overrides: Record<string, EndLifecycleOverride>;
		viewerWorkspaceId: string;
	}
): Promise<PresentedEnd> {
	if (!("milestone" in db) || typeof db.milestone?.findUnique !== "function") {
		return brokenEnd(input, { reason: RELATIONS_COPY.permanentlyDeleted });
	}
	const milestone = await db.milestone.findUnique({
		include: { project: true },
		where: { id: input.id },
	});
	if (!milestone) {
		return brokenEnd(input, { reason: RELATIONS_COPY.permanentlyDeleted });
	}
	if (milestone.project.workspaceId !== input.viewerWorkspaceId) {
		return brokenEnd(input, { reason: RELATIONS_COPY.noAccess });
	}
	return {
		id: milestone.id,
		kind: "Milestone",
		openSourceRecord: true,
		status: "resolved",
		title: milestone.title,
	};
}

function brokenEnd(
	input: { establishedAt: string; id: string; kind: RecordKind },
	override: EndLifecycleOverride
): PresentedEnd {
	const reason = override.reason ?? RELATIONS_COPY.permanentlyDeleted;
	const mayShowTitle =
		reason === RELATIONS_COPY.archived || reason === RELATIONS_COPY.inTrash;
	const openSourceRecord = mayShowTitle;
	const hideTitle = reason === RELATIONS_COPY.noAccess || !mayShowTitle;
	return {
		establishedAt: input.establishedAt,
		id: input.id,
		kind: input.kind,
		openSourceRecord,
		reason,
		status: "broken",
		title: hideTitle ? undefined : override.title,
	};
}

function originLocationView(
	location: OriginLocationInput | undefined,
	missing: boolean
): OriginLocationView | null {
	if (!location) {
		return null;
	}
	return {
		componentId: location.componentId,
		missing,
		ownerId: location.ownerId,
		ownerKind: location.ownerKind,
		sourceVersion: location.sourceVersion,
	};
}

function parseStoredRelation(value: string): PresentedRelation | null {
	try {
		const parsed: unknown = JSON.parse(value);
		if (!isRecord(parsed) || typeof parsed.id !== "string") {
			return null;
		}
		return parsed as unknown as PresentedRelation;
	} catch {
		return null;
	}
}

export function isBrokenReason(value: string): value is BrokenReason {
	return (BROKEN_REASONS as readonly string[]).includes(value);
}
