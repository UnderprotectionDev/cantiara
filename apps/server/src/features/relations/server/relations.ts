import type { Prisma, PrismaClient } from "@cantiara/db";
import {
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
	createRelationCommandSchema,
	type DeleteRelationCommand,
	deleteRelationCommandSchema,
	isRecord,
	previewRelationInputSchema,
	type UndoRelationCommand,
	undoRelationCommandSchema,
} from "./relations-model";

type PrismaTransaction = Prisma.TransactionClient;

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
	return await prisma.$transaction((tx) =>
		createInTransaction(tx, typedCommand, commandKey, fingerprint, endOverrides)
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
