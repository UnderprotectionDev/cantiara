import type { Prisma, PrismaClient } from "@cantiara/db";

import { RECORD_DISCOVERY_COPY } from "../../record-discovery/server/record-discovery-copy";

import {
	type CollectionRecord,
	conditionMatches,
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
import {
	asRegisteredCollectionSignal,
	type MembershipPeriod,
	MemorySignalSink,
	produceSubscriptionSignals,
	type SmartCollectionEntrySignal,
	seedOpenMembershipPeriods,
} from "./smart-collections-subscription";

export interface DefineSmartCollectionInput {
	conditions: readonly MembershipCondition[];
	members?: unknown;
	name: string;
	pins?: unknown;
	projectId: string | null;
	query?: unknown;
	sourceKind: string;
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
			subscribeOnEntry: false,
			subscribeOnExit: false,
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
	subscribeOnEntry?: boolean;
	subscribeOnExit?: boolean;
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
		subscribeOnEntry: Boolean(row.subscribeOnEntry),
		subscribeOnExit: Boolean(row.subscribeOnExit),
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
				conditions: data.conditions as Prisma.InputJsonValue,
				id: data.id,
				name: data.name,
				projectId: data.projectId,
				revision: 1,
				sourceKind: data.sourceKind,
				subscribeOnEntry: false,
				subscribeOnExit: false,
				workspaceId: data.workspaceId,
			},
		});
	}
	const payload = JSON.stringify(data.conditions);
	await db.$executeRaw`
		INSERT INTO "smart_collection"
			(id, "workspaceId", "projectId", name, "sourceKind", conditions, revision, "subscribeOnEntry", "subscribeOnExit", "createdAt", "updatedAt")
		VALUES (
			${data.id},
			${data.workspaceId},
			${data.projectId},
			${data.name},
			${data.sourceKind},
			CAST(${payload} AS JSONB),
			1,
			false,
			false,
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
		SELECT id, name, "projectId", "sourceKind", conditions, "subscribeOnEntry", "subscribeOnExit"
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
		SELECT id, name, "projectId", "sourceKind", conditions, "subscribeOnEntry", "subscribeOnExit"
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
				conditions: data.conditions as Prisma.InputJsonValue,
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
	return rows.map(fromRow);
}

export async function getSmartCollection(
	prisma: PrismaClient,
	workspaceId: string,
	collectionId: string
): Promise<SmartCollectionDefinition | null> {
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
			subscribeOnEntry: current.subscribeOnEntry,
			subscribeOnExit: current.subscribeOnExit,
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
	signals: readonly SmartCollectionEntrySignal[];
}

interface StoredPeriodRow {
	open: boolean;
	recordId: string;
	recordKind: string;
}

interface StoredSignalRow {
	phase: string;
	reason: string;
	recordId: string;
	recordKind: string;
	section: string;
	signalId: string;
}

function hasPeriodDelegate(db: MutationDb): boolean {
	const delegate = (
		db as unknown as {
			smartCollectionMembershipPeriod?: {
				createMany?: unknown;
				deleteMany?: unknown;
				findMany?: unknown;
			};
		}
	).smartCollectionMembershipPeriod;
	return (
		typeof delegate?.createMany === "function" &&
		typeof delegate?.deleteMany === "function" &&
		typeof delegate?.findMany === "function"
	);
}

function hasSignalDelegate(db: MutationDb): boolean {
	const delegate = (
		db as unknown as {
			smartCollectionAttentionSignal?: {
				createMany?: unknown;
				findMany?: unknown;
			};
		}
	).smartCollectionAttentionSignal;
	return (
		typeof delegate?.createMany === "function" &&
		typeof delegate?.findMany === "function"
	);
}

function asEntrySignal(
	row: StoredSignalRow
): SmartCollectionEntrySignal | null {
	const registered = asRegisteredCollectionSignal(row.signalId);
	if (registered.status !== "ok") {
		return null;
	}
	if (row.section !== registered.section) {
		return null;
	}
	return {
		parenting: false,
		phase: row.phase === "leave" ? "leave" : "enter",
		reason: row.reason,
		section: registered.section,
		signalId: registered.signalId,
		source: { id: row.recordId, kind: row.recordKind },
		sourceFieldWrites: false,
	};
}

async function loadPeriods(
	db: MutationDb,
	collectionId: string
): Promise<MembershipPeriod[]> {
	if (hasPeriodDelegate(db)) {
		const rows = await (
			db as PrismaClient
		).smartCollectionMembershipPeriod.findMany({
			orderBy: { createdAt: "asc" },
			where: { collectionId },
		});
		return rows.map((row) => ({
			open: row.open,
			recordId: row.recordId,
			recordKind: row.recordKind,
		}));
	}
	const rows = await db.$queryRaw<StoredPeriodRow[]>`
		SELECT open, "recordId", "recordKind"
		FROM "smart_collection_membership_period"
		WHERE "collectionId" = ${collectionId}
		ORDER BY "createdAt" ASC
	`;
	return rows.map((row) => ({
		open: row.open,
		recordId: row.recordId,
		recordKind: row.recordKind,
	}));
}

async function replacePeriods(
	db: MutationDb,
	collectionId: string,
	periods: readonly MembershipPeriod[]
): Promise<void> {
	if (hasPeriodDelegate(db)) {
		await (db as PrismaClient).smartCollectionMembershipPeriod.deleteMany({
			where: { collectionId },
		});
		if (periods.length === 0) {
			return;
		}
		await (db as PrismaClient).smartCollectionMembershipPeriod.createMany({
			data: periods.map((period) => ({
				collectionId,
				id: crypto.randomUUID(),
				open: period.open,
				recordId: period.recordId,
				recordKind: period.recordKind,
			})),
		});
		return;
	}
	await db.$executeRaw`
		DELETE FROM "smart_collection_membership_period"
		WHERE "collectionId" = ${collectionId}
	`;
	await Promise.all(
		periods.map((period) => {
			const id = crypto.randomUUID();
			return db.$executeRaw`
			INSERT INTO "smart_collection_membership_period"
				(id, "collectionId", "recordId", "recordKind", open, "createdAt", "updatedAt")
			VALUES (
				${id},
				${collectionId},
				${period.recordId},
				${period.recordKind},
				${period.open},
				CURRENT_TIMESTAMP,
				CURRENT_TIMESTAMP
			)
		`;
		})
	);
}

async function loadSignals(
	db: MutationDb,
	collectionId: string
): Promise<SmartCollectionEntrySignal[]> {
	if (hasSignalDelegate(db)) {
		const rows = await (
			db as PrismaClient
		).smartCollectionAttentionSignal.findMany({
			orderBy: { createdAt: "asc" },
			where: { collectionId },
		});
		return rows.flatMap((row) => {
			const signal = asEntrySignal(row);
			return signal ? [signal] : [];
		});
	}
	const rows = await db.$queryRaw<StoredSignalRow[]>`
		SELECT phase, reason, "recordId", "recordKind", section, "signalId"
		FROM "smart_collection_attention_signal"
		WHERE "collectionId" = ${collectionId}
		ORDER BY "createdAt" ASC
	`;
	return rows.flatMap((row) => {
		const signal = asEntrySignal(row);
		return signal ? [signal] : [];
	});
}

async function appendSignals(
	db: MutationDb,
	collectionId: string,
	signals: readonly SmartCollectionEntrySignal[]
): Promise<void> {
	const registered = signals.filter(
		(signal) => signal.signalId === "smart-collection-entry"
	);
	if (registered.length === 0) {
		return;
	}
	if (hasSignalDelegate(db)) {
		await (db as PrismaClient).smartCollectionAttentionSignal.createMany({
			data: registered.map((signal) => ({
				collectionId,
				id: crypto.randomUUID(),
				phase: signal.phase,
				reason: signal.reason,
				recordId: signal.source.id,
				recordKind: signal.source.kind,
				section: signal.section,
				signalId: signal.signalId,
			})),
		});
		return;
	}
	await Promise.all(
		registered.map((signal) => {
			const id = crypto.randomUUID();
			return db.$executeRaw`
			INSERT INTO "smart_collection_attention_signal"
				(id, "collectionId", "recordId", "recordKind", "signalId", section, phase, reason, "createdAt", "updatedAt")
			VALUES (
				${id},
				${collectionId},
				${signal.source.id},
				${signal.source.kind},
				${signal.signalId},
				${signal.section},
				${signal.phase},
				${signal.reason},
				CURRENT_TIMESTAMP,
				CURRENT_TIMESTAMP
			)
		`;
		})
	);
}

async function persistSubscriptionFlags(
	db: MutationDb,
	collectionId: string,
	flags: { subscribeOnEntry: boolean; subscribeOnExit: boolean }
): Promise<void> {
	if (hasSmartCollectionDelegate(db)) {
		await (db as PrismaClient).smartCollection.update({
			data: {
				subscribeOnEntry: flags.subscribeOnEntry,
				subscribeOnExit: flags.subscribeOnExit,
			},
			where: { id: collectionId },
		});
		return;
	}
	await db.$executeRaw`
		UPDATE "smart_collection"
		SET
			"subscribeOnEntry" = ${flags.subscribeOnEntry},
			"subscribeOnExit" = ${flags.subscribeOnExit},
			"updatedAt" = CURRENT_TIMESTAMP
		WHERE id = ${collectionId}
	`;
}

async function evaluateStoredSubscription(
	prisma: PrismaClient,
	collection: SmartCollectionDefinition,
	catalog: readonly CollectionRecord[],
	membership: MembershipView,
	seedOnly: boolean
): Promise<SmartCollectionEntrySignal[]> {
	const periods = await loadPeriods(prisma, collection.id);
	if (seedOnly) {
		await replacePeriods(
			prisma,
			collection.id,
			seedOpenMembershipPeriods(membership.members, periods)
		);
		return await loadSignals(prisma, collection.id);
	}
	const sink = new MemorySignalSink();
	const produced = produceSubscriptionSignals({
		catalog,
		conditions: collection.conditions,
		members: membership.members,
		periods,
		sink,
		subscription: {
			onEntry: collection.subscribeOnEntry,
			onExit: collection.subscribeOnExit,
		},
	});
	await replacePeriods(prisma, collection.id, produced.periods);
	await appendSignals(prisma, collection.id, sink.emissions);
	return await loadSignals(prisma, collection.id);
}

export async function viewSmartCollection(
	prisma: PrismaClient,
	workspaceId: string,
	collectionId: string
): Promise<SmartCollectionView | null> {
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
	const signals = await evaluateStoredSubscription(
		prisma,
		collection,
		catalog,
		membership,
		false
	);
	return {
		collection,
		dropCandidates: catalog.filter((record) => !memberIds.has(record.id)),
		membership,
		signals,
	};
}

export async function subscribeSmartCollection(
	prisma: PrismaClient,
	input: {
		collectionId: string;
		onEntry: boolean;
		onExit: boolean;
		workspaceId: string;
	}
): Promise<
	| { signals: SmartCollectionEntrySignal[]; status: "ok" }
	| { status: "not-found" }
> {
	const current = await getSmartCollection(
		prisma,
		input.workspaceId,
		input.collectionId
	);
	if (!current) {
		return { status: "not-found" };
	}
	const subscribeOnEntry = input.onEntry;
	const subscribeOnExit = input.onEntry && input.onExit;
	await persistSubscriptionFlags(prisma, input.collectionId, {
		subscribeOnEntry,
		subscribeOnExit,
	});
	const collection: SmartCollectionDefinition = {
		...current,
		subscribeOnEntry,
		subscribeOnExit,
	};
	const catalog = await loadCollectionCatalog(
		prisma,
		input.workspaceId,
		collection
	);
	const membership = deriveMembership(collection, catalog);
	const signals = subscribeOnEntry
		? await evaluateStoredSubscription(
				prisma,
				collection,
				catalog,
				membership,
				true
			)
		: await loadSignals(prisma, collection.id);
	return { signals, status: "ok" };
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
