import type { Prisma, PrismaClient } from "@cantiara/db";

import { RECORD_DISCOVERY_COPY } from "../../record-discovery/server/record-discovery-copy";
import {
	listPreparedLongInTheSameStatusCollections,
	viewPreparedLongInTheSameStatus,
} from "../../return-to-work/server/return-to-work";
import { parsePreparedLongInTheSameStatusProjectId } from "../../return-to-work/server/return-to-work-model";

import {
	type CollectionRecord,
	type DefineSmartCollectionResult,
	DOCUMENT_METADATA_FIELDS,
	type DragPreviewResult,
	type FieldWrite,
	fieldLabel,
	isStructuredMetadataSource,
	type MembershipCondition,
	type MembershipMember,
	type MembershipReason,
	type MembershipView,
	type PinResult,
	parseConditions,
	type SmartCollectionDefinition,
	smartCollectionSourceAllowed,
} from "./smart-collections-model";

export interface DefineSmartCollectionInput {
	conditions: readonly MembershipCondition[];
	members?: unknown;
	name: string;
	pins?: unknown;
	projectId: string | null;
	query?: unknown;
	sourceKind: string;
}

function conditionMatches(
	record: CollectionRecord,
	condition: MembershipCondition
): boolean {
	switch (condition.field) {
		case "body":
			return record.body === condition.value;
		case "projectId":
			return record.projectId === condition.value;
		case "scopeKind":
			return record.scopeKind === condition.value;
		case "status":
			return record.status === condition.value;
		case "tagId":
			return (record.tagIds ?? []).includes(condition.value);
		case "type":
			return record.type === condition.value;
		default:
			return false;
	}
}

function becauseFor(
	record: CollectionRecord,
	conditions: readonly MembershipCondition[]
): MembershipReason[] {
	return conditions.flatMap((condition) => {
		if (!conditionMatches(record, condition)) {
			return [];
		}
		return [
			{
				field: condition.field,
				label: `${fieldLabel(condition.field)} is ${condition.value}`,
			},
		];
	});
}

export function summarizeConditions(
	conditions: readonly MembershipCondition[]
): string {
	if (conditions.length === 0) {
		return "";
	}
	return conditions
		.map((condition) => `${fieldLabel(condition.field)} is ${condition.value}`)
		.join(" and ");
}

function kindMatchesSource(recordKind: string, sourceKind: string): boolean {
	if (recordKind === sourceKind) {
		return true;
	}
	return (
		sourceKind === RECORD_DISCOVERY_COPY.document &&
		recordKind === RECORD_DISCOVERY_COPY.wikiDocument
	);
}

export function defineSmartCollection(
	input: DefineSmartCollectionInput
): DefineSmartCollectionResult {
	if (typeof input.query === "string") {
		return { reason: "free-query", status: "refused" };
	}
	if (input.members !== undefined || input.pins !== undefined) {
		return { reason: "manual-membership", status: "refused" };
	}
	const name = input.name.trim();
	if (name.length === 0) {
		return { reason: "invalid-name", status: "refused" };
	}
	if (!smartCollectionSourceAllowed(input.sourceKind)) {
		return { reason: "source-not-allowed", status: "refused" };
	}
	if (isStructuredMetadataSource(input.sourceKind)) {
		const usesBody = input.conditions.some(
			(condition) =>
				condition.field === "body" ||
				!DOCUMENT_METADATA_FIELDS.has(condition.field)
		);
		if (usesBody) {
			return { reason: "document-body-condition", status: "refused" };
		}
	}
	return {
		collection: {
			conditions: input.conditions,
			id: "",
			name,
			projectId: input.projectId,
			sourceKind: input.sourceKind,
		},
		status: "ok",
	};
}

export function deriveMembership(
	collection: SmartCollectionDefinition,
	records: readonly CollectionRecord[]
): MembershipView {
	const members: MembershipMember[] = records.flatMap((record) => {
		if (!kindMatchesSource(record.kind, collection.sourceKind)) {
			return [];
		}
		if (
			collection.projectId !== null &&
			record.projectId !== collection.projectId
		) {
			return [];
		}
		const matches = collection.conditions.every((condition) =>
			conditionMatches(record, condition)
		);
		if (!matches) {
			return [];
		}
		return [
			{
				because: becauseFor(record, collection.conditions),
				id: record.id,
				kind: record.kind,
				projectId: record.projectId,
				title: record.title,
			},
		];
	});
	return {
		members,
		summary: summarizeConditions(collection.conditions),
	};
}

export function pinMember(
	_collection: SmartCollectionDefinition,
	_recordId: string
): PinResult {
	return {
		parenting: false,
		reason: "pin-not-allowed",
		status: "refused",
	};
}

export function addException(
	_collection: SmartCollectionDefinition,
	_recordId: string
): PinResult {
	return {
		parenting: false,
		reason: "exception-not-allowed",
		status: "refused",
	};
}

export function previewDragOntoCollection(
	collection: SmartCollectionDefinition,
	record: CollectionRecord
): DragPreviewResult {
	const writes: FieldWrite[] = collection.conditions.flatMap((condition) => {
		if (conditionMatches(record, condition)) {
			return [];
		}
		if (condition.field === "body") {
			return [];
		}
		return [{ field: condition.field, value: condition.value }];
	});
	if (writes.length === 0) {
		return { parenting: false, status: "impossible" };
	}
	return { parenting: false, status: "preview", writes };
}

type MutationDb = PrismaClient | Prisma.TransactionClient;

interface StoredSmartCollectionRow {
	conditions: unknown;
	id: string;
	name: string;
	projectId: string | null;
	sourceKind: string;
}

function hasSmartCollectionDelegate(db: MutationDb): boolean {
	const delegate = (
		db as unknown as {
			smartCollection?: {
				create?: unknown;
				findFirst?: unknown;
				findMany?: unknown;
				update?: unknown;
			};
		}
	).smartCollection;
	return (
		typeof delegate?.create === "function" &&
		typeof delegate?.findFirst === "function" &&
		typeof delegate?.findMany === "function" &&
		typeof delegate?.update === "function"
	);
}

function fromRow(row: StoredSmartCollectionRow): SmartCollectionDefinition {
	return {
		conditions: parseConditions(row.conditions),
		id: row.id,
		name: row.name,
		projectId: row.projectId,
		sourceKind: row.sourceKind,
	};
}

async function insertSmartCollection(
	db: MutationDb,
	data: {
		conditions: MembershipCondition[];
		id: string;
		name: string;
		projectId: string | null;
		sourceKind: string;
		workspaceId: string;
	}
): Promise<StoredSmartCollectionRow> {
	if (hasSmartCollectionDelegate(db)) {
		return await (db as PrismaClient).smartCollection.create({
			data: {
				conditions: data.conditions,
				id: data.id,
				name: data.name,
				projectId: data.projectId,
				revision: 1,
				sourceKind: data.sourceKind,
				workspaceId: data.workspaceId,
			},
		});
	}
	const payload = JSON.stringify(data.conditions);
	await db.$executeRaw`
		INSERT INTO "smart_collection"
			(id, "workspaceId", "projectId", name, "sourceKind", conditions, revision, "createdAt", "updatedAt")
		VALUES (
			${data.id},
			${data.workspaceId},
			${data.projectId},
			${data.name},
			${data.sourceKind},
			CAST(${payload} AS JSONB),
			1,
			CURRENT_TIMESTAMP,
			CURRENT_TIMESTAMP
		)
	`;
	return data;
}

async function selectSmartCollections(
	db: MutationDb,
	workspaceId: string
): Promise<StoredSmartCollectionRow[]> {
	if (hasSmartCollectionDelegate(db)) {
		return await (db as PrismaClient).smartCollection.findMany({
			orderBy: { createdAt: "asc" },
			where: { workspaceId },
		});
	}
	return await db.$queryRaw<StoredSmartCollectionRow[]>`
		SELECT id, name, "projectId", "sourceKind", conditions
		FROM "smart_collection"
		WHERE "workspaceId" = ${workspaceId}
		ORDER BY "createdAt" ASC
	`;
}

async function selectSmartCollection(
	db: MutationDb,
	workspaceId: string,
	collectionId: string
): Promise<StoredSmartCollectionRow | null> {
	if (hasSmartCollectionDelegate(db)) {
		return await (db as PrismaClient).smartCollection.findFirst({
			where: { id: collectionId, workspaceId },
		});
	}
	const rows = await db.$queryRaw<StoredSmartCollectionRow[]>`
		SELECT id, name, "projectId", "sourceKind", conditions
		FROM "smart_collection"
		WHERE id = ${collectionId} AND "workspaceId" = ${workspaceId}
		LIMIT 1
	`;
	return rows[0] ?? null;
}

async function persistSmartCollectionUpdate(
	db: MutationDb,
	collectionId: string,
	data: { conditions: MembershipCondition[]; name: string }
): Promise<StoredSmartCollectionRow> {
	if (hasSmartCollectionDelegate(db)) {
		return await (db as PrismaClient).smartCollection.update({
			data: {
				conditions: data.conditions,
				name: data.name,
				revision: 1,
			},
			where: { id: collectionId },
		});
	}
	const payload = JSON.stringify(data.conditions);
	await db.$executeRaw`
		UPDATE "smart_collection"
		SET
			conditions = CAST(${payload} AS JSONB),
			name = ${data.name},
			revision = 1,
			"updatedAt" = CURRENT_TIMESTAMP
		WHERE id = ${collectionId}
	`;
	return {
		conditions: data.conditions,
		id: collectionId,
		name: data.name,
		projectId: null,
		sourceKind: "",
	};
}

export async function createSmartCollection(
	prisma: PrismaClient,
	input: {
		conditions: readonly MembershipCondition[];
		name: string;
		projectId: string | null;
		sourceKind: string;
		workspaceId: string;
	}
): Promise<DefineSmartCollectionResult> {
	const defined = defineSmartCollection(input);
	if (defined.status !== "ok") {
		return defined;
	}
	const row = await insertSmartCollection(prisma, {
		conditions: [...defined.collection.conditions],
		id: crypto.randomUUID(),
		name: defined.collection.name,
		projectId: defined.collection.projectId,
		sourceKind: defined.collection.sourceKind,
		workspaceId: input.workspaceId,
	});
	return { collection: fromRow(row), status: "ok" };
}

export async function listSmartCollections(
	prisma: PrismaClient,
	workspaceId: string
): Promise<SmartCollectionDefinition[]> {
	const rows = await selectSmartCollections(prisma, workspaceId);
	const prepared = await listPreparedLongInTheSameStatusCollections(
		prisma,
		workspaceId
	);
	return [...rows.map(fromRow), ...prepared];
}

export async function getSmartCollection(
	prisma: PrismaClient,
	workspaceId: string,
	collectionId: string
): Promise<SmartCollectionDefinition | null> {
	const prepared = await listPreparedLongInTheSameStatusCollections(
		prisma,
		workspaceId
	);
	const preparedMatch = prepared.find((item) => item.id === collectionId);
	if (preparedMatch) {
		return preparedMatch;
	}
	const row = await selectSmartCollection(prisma, workspaceId, collectionId);
	return row ? fromRow(row) : null;
}

export async function updateSmartCollectionConditions(
	prisma: PrismaClient,
	input: {
		collectionId: string;
		conditions: readonly MembershipCondition[];
		name: string;
		workspaceId: string;
	}
): Promise<DefineSmartCollectionResult> {
	const current = await getSmartCollection(
		prisma,
		input.workspaceId,
		input.collectionId
	);
	if (!current) {
		return { reason: "invalid-name", status: "refused" };
	}
	if (parsePreparedLongInTheSameStatusProjectId(input.collectionId)) {
		return { reason: "invalid-name", status: "refused" };
	}
	const defined = defineSmartCollection({
		conditions: input.conditions,
		name: input.name,
		projectId: current.projectId,
		sourceKind: current.sourceKind,
	});
	if (defined.status !== "ok") {
		return defined;
	}
	const row = await persistSmartCollectionUpdate(prisma, input.collectionId, {
		conditions: [...defined.collection.conditions],
		name: defined.collection.name,
	});
	return {
		collection: {
			...fromRow(row),
			projectId: current.projectId,
			sourceKind: current.sourceKind,
		},
		status: "ok",
	};
}

async function loadWorkCatalog(
	prisma: PrismaClient,
	workspaceId: string,
	projectId: string | null
): Promise<CollectionRecord[]> {
	const rows = await prisma.work.findMany({
		orderBy: [{ projectId: "asc" }, { number: "asc" }],
		select: {
			id: true,
			projectId: true,
			status: true,
			tags: { select: { tagId: true } },
			title: true,
			type: true,
		},
		where: {
			archived: false,
			project: projectId ? { id: projectId, workspaceId } : { workspaceId },
			retiredIntoId: null,
			trashedAt: null,
		},
	});
	return rows.map((row) => ({
		id: row.id,
		kind: RECORD_DISCOVERY_COPY.work,
		projectId: row.projectId,
		status: row.status,
		tagIds: row.tags.map((tag) => tag.tagId),
		title: row.title,
		type: row.type,
	}));
}

async function loadDocumentCatalog(
	prisma: PrismaClient,
	workspaceId: string,
	sourceKind: string,
	projectId: string | null
): Promise<CollectionRecord[]> {
	if (typeof prisma.document?.findMany !== "function") {
		return [];
	}
	const wiki = sourceKind === RECORD_DISCOVERY_COPY.wikiDocument;
	const rows = await prisma.document.findMany({
		orderBy: { createdAt: "asc" },
		select: {
			id: true,
			projectId: true,
			scopeKind: true,
			title: true,
			type: true,
		},
		where: {
			archivedAt: null,
			scopeKind: wiki ? "personal-wiki" : "project",
			workspaceId,
			...(projectId && !wiki ? { projectId } : {}),
			...(wiki ? { projectId: null } : {}),
		},
	});
	const tagIds = new Map<string, string[]>();
	if (rows.length > 0 && typeof prisma.tagInlineUse?.findMany === "function") {
		const uses = await prisma.tagInlineUse.findMany({
			select: { documentId: true, tagId: true },
			where: { documentId: { in: rows.map((row) => row.id) } },
		});
		for (const use of uses) {
			const list = tagIds.get(use.documentId) ?? [];
			list.push(use.tagId);
			tagIds.set(use.documentId, list);
		}
	}
	return rows.map((row) => ({
		id: row.id,
		kind: wiki
			? RECORD_DISCOVERY_COPY.wikiDocument
			: RECORD_DISCOVERY_COPY.document,
		projectId: row.projectId,
		scopeKind: row.scopeKind,
		tagIds: tagIds.get(row.id) ?? [],
		title: row.title,
		type: row.type,
	}));
}

export async function loadCollectionCatalog(
	prisma: PrismaClient,
	workspaceId: string,
	collection: SmartCollectionDefinition
): Promise<CollectionRecord[]> {
	if (collection.sourceKind === RECORD_DISCOVERY_COPY.work) {
		return await loadWorkCatalog(prisma, workspaceId, collection.projectId);
	}
	if (
		collection.sourceKind === RECORD_DISCOVERY_COPY.document ||
		collection.sourceKind === RECORD_DISCOVERY_COPY.wikiDocument
	) {
		return await loadDocumentCatalog(
			prisma,
			workspaceId,
			collection.sourceKind,
			collection.projectId
		);
	}
	return [];
}

export interface SmartCollectionView {
	collection: SmartCollectionDefinition;
	dropCandidates: readonly CollectionRecord[];
	membership: MembershipView;
}

export async function viewSmartCollection(
	prisma: PrismaClient,
	workspaceId: string,
	collectionId: string,
	options?: { accountId?: string; now?: Date }
): Promise<SmartCollectionView | null> {
	const workspace = await prisma.workspace.findFirst({
		select: { ownerId: true },
		where: { id: workspaceId },
	});
	const prepared = await viewPreparedLongInTheSameStatus(
		prisma,
		workspaceId,
		collectionId,
		{
			accountId: options?.accountId ?? workspace?.ownerId ?? "",
			now: options?.now,
		}
	);
	if (prepared) {
		return prepared;
	}
	const collection = await getSmartCollection(
		prisma,
		workspaceId,
		collectionId
	);
	if (!collection) {
		return null;
	}
	const catalog = await loadCollectionCatalog(prisma, workspaceId, collection);
	const membership = deriveMembership(collection, catalog);
	const memberIds = new Set(membership.members.map((member) => member.id));
	return {
		collection,
		dropCandidates: catalog.filter((record) => !memberIds.has(record.id)),
		membership,
	};
}

export async function previewDragForRecord(
	prisma: PrismaClient,
	workspaceId: string,
	collectionId: string,
	recordId: string
): Promise<DragPreviewResult | { status: "not-found" }> {
	const collection = await getSmartCollection(
		prisma,
		workspaceId,
		collectionId
	);
	if (!collection) {
		return { status: "not-found" };
	}
	const catalog = await loadCollectionCatalog(prisma, workspaceId, collection);
	const record = catalog.find((item) => item.id === recordId);
	if (!record) {
		return { status: "not-found" };
	}
	return previewDragOntoCollection(collection, record);
}
