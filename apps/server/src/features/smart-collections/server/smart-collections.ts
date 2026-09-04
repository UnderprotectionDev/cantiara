import type { Prisma, PrismaClient } from "@cantiara/db";
import { RECORD_DISCOVERY_COPY } from "../../record-discovery/server/record-discovery-copy";
import {
	listPreparedLongInTheSameStatusCollections,
	viewPreparedLongInTheSameStatus,
} from "../../return-to-work/server/return-to-work";
import { parsePreparedLongInTheSameStatusProjectId } from "../../return-to-work/server/return-to-work-model";
import {
	changeWorkStatus,
	createWork,
} from "../../work-lifecycle/server/work-lifecycle";

import {
	type CollectionRecord,
	conditionMatches,
	DEFAULT_NAMED_VIEW,
	type DefineSmartCollectionResult,
	DOCUMENT_METADATA_FIELDS,
	type DragPreviewResult,
	type FieldWrite,
	fieldLabel,
	galleryAllowedFor,
	type InsightBucket,
	type InsightSlice,
	type InsightSliceOptions,
	isStructuredMetadataSource,
	type LightInsights,
	type MembershipCondition,
	type MembershipMember,
	type MembershipReason,
	type MembershipView,
	type NamedViewDefinition,
	type NewWorkDraft,
	newWorkMissWarning,
	newWorkPrefill,
	type PinResult,
	type Presentation,
	type PresentationDraft,
	parseConditions,
	parsePresentation,
	SMART_COLLECTIONS_COPY,
	type SmartCollectionDefinition,
	type SmartCollectionPresentation,
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

function isAccessibleRecord(record: CollectionRecord): boolean {
	return record.accessible !== false;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string | undefined, now: Date): number | null {
	if (!fromIso) {
		return null;
	}
	const from = Date.parse(fromIso);
	if (Number.isNaN(from)) {
		return null;
	}
	return Math.floor(Math.max(0, now.getTime() - from) / DAY_MS);
}

function dayBucket(days: number | null): string {
	if (days === null) {
		return SMART_COLLECTIONS_COPY.notSet;
	}
	if (days <= 7) {
		return SMART_COLLECTIONS_COPY.age0to7;
	}
	if (days <= 30) {
		return SMART_COLLECTIONS_COPY.age8to30;
	}
	return SMART_COLLECTIONS_COPY.age31plus;
}

function effortValue(record: CollectionRecord): string {
	if (typeof record.effort === "string" && record.effort.length > 0) {
		return record.effort;
	}
	return SMART_COLLECTIONS_COPY.notSet;
}

function ageValue(record: CollectionRecord, now: Date): string {
	return dayBucket(daysBetween(record.createdAt, now));
}

function timeInStatusValue(record: CollectionRecord, now: Date): string {
	return dayBucket(
		daysBetween(record.statusEnteredAt ?? record.createdAt, now)
	);
}

function sliceValue(
	record: CollectionRecord,
	slice: InsightSlice,
	now: Date
): string {
	switch (slice.dimension) {
		case "age":
			return ageValue(record, now);
		case "effort":
			return effortValue(record);
		case "status":
			return record.status ?? SMART_COLLECTIONS_COPY.notSet;
		case "timeInStatus":
			return timeInStatusValue(record, now);
		default:
			return SMART_COLLECTIONS_COPY.notSet;
	}
}

function recordMatchesSlices(
	record: CollectionRecord,
	slices: readonly InsightSlice[],
	now: Date
): boolean {
	return slices.every(
		(slice) => sliceValue(record, slice, now) === slice.value
	);
}

function countBuckets(values: readonly string[]): InsightBucket[] {
	const counts = new Map<string, number>();
	for (const value of values) {
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([value, count]) => ({ count, value }))
		.sort((left, right) => {
			if (right.count !== left.count) {
				return right.count - left.count;
			}
			return left.value.localeCompare(right.value);
		});
}

function insightsFor(
	records: readonly CollectionRecord[],
	now: Date
): LightInsights {
	return {
		age: countBuckets(records.map((record) => ageValue(record, now))),
		effort: countBuckets(records.map(effortValue)),
		recordCount: records.length,
		status: countBuckets(
			records.map((record) => record.status ?? SMART_COLLECTIONS_COPY.notSet)
		),
		timeInStatus: countBuckets(
			records.map((record) => timeInStatusValue(record, now))
		),
	};
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
		if (!isAccessibleRecord(record)) {
			return [];
		}
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
		if (condition.operator !== "equals") {
			return [];
		}
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

export function applyInsightSlices(
	collection: SmartCollectionDefinition,
	records: readonly CollectionRecord[],
	options: InsightSliceOptions = {}
): SmartCollectionPresentation {
	const now = options.now ?? new Date();
	const slices = options.slices ?? [];
	const membership = deriveMembership(collection, records);
	if (collection.sourceKind !== RECORD_DISCOVERY_COPY.work) {
		return { insights: null, membership };
	}
	const byId = new Map(records.map((record) => [record.id, record]));
	const matching = membership.members.filter((member) => {
		const record = byId.get(member.id);
		return record ? recordMatchesSlices(record, slices, now) : false;
	});
	const matchingRecords = matching.flatMap((member) => {
		const record = byId.get(member.id);
		return record ? [record] : [];
	});
	return {
		insights: insightsFor(matchingRecords, now),
		membership: {
			members: matching,
			summary: membership.summary,
		},
	};
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

function hasNamedViewDelegate(db: MutationDb): boolean {
	const delegate = (
		db as unknown as {
			smartCollectionNamedView?: {
				create?: unknown;
				findMany?: unknown;
				update?: unknown;
			};
		}
	).smartCollectionNamedView;
	return (
		typeof delegate?.create === "function" &&
		typeof delegate?.findMany === "function" &&
		typeof delegate?.update === "function"
	);
}

function parseVisibleFields(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return ["title"];
	}
	return value.flatMap((item) => (typeof item === "string" ? [item] : []));
}

function namedViewFromRow(row: {
	filterText: string;
	groupField: string | null;
	id: string;
	isDefault: boolean;
	name: string;
	presentation: string;
	purpose: string | null;
	sortDirection: string | null;
	sortField: string | null;
	visibleFields: unknown;
}): NamedViewDefinition {
	return {
		filterText: row.filterText,
		groupField: row.groupField,
		id: row.id,
		isDefault: row.isDefault,
		name: row.name,
		presentation: parsePresentation(row.presentation),
		purpose: row.purpose,
		sortDirection:
			row.sortDirection === "desc" || row.sortDirection === "asc"
				? row.sortDirection
				: null,
		sortField: row.sortField,
		visibleFields: parseVisibleFields(row.visibleFields),
	};
}

function defaultNamedViewData(): {
	filterText: string;
	groupField: string | null;
	id: string;
	isDefault: boolean;
	name: string;
	presentation: Presentation;
	purpose: string | null;
	sortDirection: "asc" | "desc" | null;
	sortField: string | null;
	visibleFields: string[];
} {
	return {
		filterText: "",
		groupField: null,
		id: crypto.randomUUID(),
		isDefault: true,
		name: DEFAULT_NAMED_VIEW,
		presentation: "List",
		purpose: null,
		sortDirection: null,
		sortField: null,
		visibleFields: ["title", "status", "type"],
	};
}

async function insertNamedView(
	db: MutationDb,
	data: ReturnType<typeof defaultNamedViewData> & { collectionId: string }
): Promise<NamedViewDefinition> {
	if (hasNamedViewDelegate(db)) {
		const row = await (db as PrismaClient).smartCollectionNamedView.create({
			data: {
				collectionId: data.collectionId,
				filterText: data.filterText,
				groupField: data.groupField,
				id: data.id,
				isDefault: data.isDefault,
				name: data.name,
				presentation: data.presentation,
				purpose: data.purpose,
				revision: 1,
				sortDirection: data.sortDirection,
				sortField: data.sortField,
				visibleFields: data.visibleFields as unknown as Prisma.InputJsonValue,
			},
		});
		return namedViewFromRow(row);
	}
	const payload = JSON.stringify(data.visibleFields);
	await db.$executeRaw`
		INSERT INTO "smart_collection_named_view"
			(id, "collectionId", name, purpose, presentation, "groupField", "sortField", "sortDirection", "filterText", "visibleFields", "isDefault", revision, "createdAt", "updatedAt")
		VALUES (
			${data.id},
			${data.collectionId},
			${data.name},
			${data.purpose},
			${data.presentation},
			${data.groupField},
			${data.sortField},
			${data.sortDirection},
			${data.filterText},
			CAST(${payload} AS JSONB),
			${data.isDefault},
			1,
			CURRENT_TIMESTAMP,
			CURRENT_TIMESTAMP
		)
	`;
	return namedViewFromRow(data);
}

export async function listNamedViews(
	prisma: MutationDb,
	collectionId: string
): Promise<NamedViewDefinition[]> {
	if (hasNamedViewDelegate(prisma)) {
		const rows = await (
			prisma as PrismaClient
		).smartCollectionNamedView.findMany({
			orderBy: { createdAt: "asc" },
			where: { collectionId },
		});
		return rows.map(namedViewFromRow);
	}
	const rows = await prisma.$queryRaw<
		{
			filterText: string;
			groupField: string | null;
			id: string;
			isDefault: boolean;
			name: string;
			presentation: string;
			purpose: string | null;
			sortDirection: string | null;
			sortField: string | null;
			visibleFields: unknown;
		}[]
	>`
		SELECT id, name, purpose, presentation, "groupField", "sortField", "sortDirection", "filterText", "visibleFields", "isDefault"
		FROM "smart_collection_named_view"
		WHERE "collectionId" = ${collectionId}
		ORDER BY "createdAt" ASC
	`;
	return rows.map(namedViewFromRow);
}

export async function createNamedView(
	prisma: PrismaClient,
	input: {
		collectionId: string;
		draft?: PresentationDraft;
		name: string;
		purpose?: string | null;
		workspaceId: string;
	}
): Promise<
	| { status: "ok"; view: NamedViewDefinition }
	| {
			reason: "gallery-not-allowed" | "invalid-name" | "not-found" | "not-work";
			status: "refused";
	  }
> {
	const collection = await getSmartCollection(
		prisma,
		input.workspaceId,
		input.collectionId
	);
	if (!collection) {
		return { reason: "not-found", status: "refused" };
	}
	if (collection.sourceKind !== RECORD_DISCOVERY_COPY.work) {
		return { reason: "not-work", status: "refused" };
	}
	const name = input.name.trim();
	if (name.length === 0) {
		return { reason: "invalid-name", status: "refused" };
	}
	const presentation = input.draft?.presentation ?? "List";
	if (presentation === "Gallery" && !galleryAllowedFor(collection.sourceKind)) {
		return { reason: "gallery-not-allowed", status: "refused" };
	}
	const purposeRaw = input.purpose ?? input.draft?.purpose ?? null;
	const purpose = purposeRaw?.trim() ? purposeRaw.trim() : null;
	const base = defaultNamedViewData();
	const view = await insertNamedView(prisma, {
		...base,
		collectionId: input.collectionId,
		filterText: input.draft?.filterText ?? "",
		groupField: input.draft?.groupField ?? null,
		isDefault: false,
		name,
		presentation,
		purpose,
		sortDirection: input.draft?.sortDirection ?? null,
		sortField: input.draft?.sortField ?? null,
		visibleFields: input.draft
			? [...input.draft.visibleFields]
			: base.visibleFields,
	});
	return { status: "ok", view };
}

export async function saveNamedView(
	prisma: PrismaClient,
	input: {
		collectionId: string;
		draft: PresentationDraft;
		purpose?: string | null;
		viewId: string;
		workspaceId: string;
	}
): Promise<
	| { status: "ok"; view: NamedViewDefinition }
	| { reason: "gallery-not-allowed" | "not-found"; status: "refused" }
> {
	const collection = await getSmartCollection(
		prisma,
		input.workspaceId,
		input.collectionId
	);
	if (!collection) {
		return { reason: "not-found", status: "refused" };
	}
	if (
		input.draft.presentation === "Gallery" &&
		!galleryAllowedFor(collection.sourceKind)
	) {
		return { reason: "gallery-not-allowed", status: "refused" };
	}
	const views = await listNamedViews(prisma, input.collectionId);
	const current = views.find((view) => view.id === input.viewId);
	if (!current) {
		return { reason: "not-found", status: "refused" };
	}
	const purposeRaw = input.purpose ?? input.draft.purpose;
	const purpose = purposeRaw?.trim() ? purposeRaw.trim() : null;
	if (hasNamedViewDelegate(prisma)) {
		const row = await prisma.smartCollectionNamedView.update({
			data: {
				filterText: input.draft.filterText,
				groupField: input.draft.groupField,
				presentation: input.draft.presentation,
				purpose,
				sortDirection: input.draft.sortDirection,
				sortField: input.draft.sortField,
				visibleFields: [
					...input.draft.visibleFields,
				] as unknown as Prisma.InputJsonValue,
			},
			where: { id: input.viewId },
		});
		return { status: "ok", view: namedViewFromRow(row) };
	}
	const payload = JSON.stringify(input.draft.visibleFields);
	await prisma.$executeRaw`
		UPDATE "smart_collection_named_view"
		SET
			presentation = ${input.draft.presentation},
			purpose = ${purpose},
			"groupField" = ${input.draft.groupField},
			"sortField" = ${input.draft.sortField},
			"sortDirection" = ${input.draft.sortDirection},
			"filterText" = ${input.draft.filterText},
			"visibleFields" = CAST(${payload} AS JSONB),
			revision = 1,
			"updatedAt" = CURRENT_TIMESTAMP
		WHERE id = ${input.viewId}
	`;
	return {
		status: "ok",
		view: {
			...current,
			...input.draft,
			purpose,
		},
	};
}

export async function saveAsNamedView(
	prisma: PrismaClient,
	input: {
		collectionId: string;
		draft: PresentationDraft;
		name: string;
		purpose?: string | null;
		workspaceId: string;
	}
): Promise<
	| { status: "ok"; view: NamedViewDefinition }
	| {
			reason: "gallery-not-allowed" | "invalid-name" | "not-found" | "not-work";
			status: "refused";
	  }
> {
	return await createNamedView(prisma, input);
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
				conditions: data.conditions as unknown as Prisma.InputJsonValue,
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
				conditions: data.conditions as unknown as Prisma.InputJsonValue,
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
	const defaults = defaultNamedViewData();
	await insertNamedView(prisma, {
		...defaults,
		collectionId: row.id,
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
			createdAt: true,
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
	const ids = rows.map((row) => row.id);
	const events =
		ids.length === 0
			? []
			: await prisma.workLifecycleEvent.findMany({
					orderBy: { createdAt: "desc" },
					select: { createdAt: true, workId: true },
					where: {
						kind: { in: ["status", "closed", "reopened"] },
						workId: { in: ids },
					},
				});
	const enteredAt = new Map<string, Date>();
	for (const event of events) {
		if (!enteredAt.has(event.workId)) {
			enteredAt.set(event.workId, event.createdAt);
		}
	}
	return rows.map((row) => ({
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		kind: RECORD_DISCOVERY_COPY.work,
		projectId: row.projectId,
		status: row.status,
		statusEnteredAt: (enteredAt.get(row.id) ?? row.createdAt).toISOString(),
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
	insights: LightInsights | null;
	membership: MembershipView;
	namedViews: readonly NamedViewDefinition[];
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

function membershipPeriodKey(period: MembershipPeriod): string {
	return `${period.recordId}:${period.recordKind}:${period.open}`;
}

function sameMembershipPeriods(
	left: readonly MembershipPeriod[],
	right: readonly MembershipPeriod[]
): boolean {
	if (left.length !== right.length) {
		return false;
	}
	const remaining = new Map<string, number>();
	for (const period of left) {
		const key = membershipPeriodKey(period);
		remaining.set(key, (remaining.get(key) ?? 0) + 1);
	}
	for (const period of right) {
		const key = membershipPeriodKey(period);
		const count = remaining.get(key);
		if (!count) {
			return false;
		}
		remaining.set(key, count - 1);
	}
	return true;
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
	if (
		!(collection.subscribeOnEntry || collection.subscribeOnExit || seedOnly)
	) {
		return await loadSignals(prisma, collection.id);
	}
	const periods = await loadPeriods(prisma, collection.id);
	if (seedOnly) {
		const seeded = seedOpenMembershipPeriods(membership.members, periods);
		if (!sameMembershipPeriods(periods, seeded)) {
			await replacePeriods(prisma, collection.id, seeded);
		}
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
	if (!sameMembershipPeriods(periods, produced.periods)) {
		await replacePeriods(prisma, collection.id, produced.periods);
	}
	await appendSignals(prisma, collection.id, sink.emissions);
	return await loadSignals(prisma, collection.id);
}

export async function viewSmartCollection(
	prisma: PrismaClient,
	workspaceId: string,
	collectionId: string,
	options: InsightSliceOptions = {}
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
			accountId: options.accountId ?? workspace?.ownerId ?? "",
			now: options.now,
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
	const unfiltered = deriveMembership(collection, catalog);
	const presented = applyInsightSlices(collection, catalog, options);
	const unfilteredIds = new Set(unfiltered.members.map((member) => member.id));
	const namedViews = await listNamedViews(prisma, collectionId);
	const signals = await evaluateStoredSubscription(
		prisma,
		collection,
		catalog,
		unfiltered,
		false
	);
	return {
		collection,
		dropCandidates: catalog.filter((record) => !unfilteredIds.has(record.id)),
		insights: presented.insights,
		membership: presented.membership,
		namedViews,
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

export async function createWorkFromCollection(
	prisma: PrismaClient,
	input: {
		actorId: string;
		collectionId: string;
		draft: NewWorkDraft & { title: string };
		idempotencyKey: string;
		workspaceId: string;
	}
): Promise<
	| {
			missWarning: string | null;
			prefill: ReturnType<typeof newWorkPrefill>;
			status: "ok";
			workId: string;
	  }
	| { reason: "not-found" | "not-work" | "missing-project"; status: "refused" }
> {
	const collection = await getSmartCollection(
		prisma,
		input.workspaceId,
		input.collectionId
	);
	if (!collection) {
		return { reason: "not-found", status: "refused" };
	}
	if (collection.sourceKind !== RECORD_DISCOVERY_COPY.work) {
		return { reason: "not-work", status: "refused" };
	}
	const prefill = newWorkPrefill(collection);
	const projectId =
		input.draft.projectId ??
		prefill.fields.find((field) => field.field === "projectId")?.value ??
		collection.projectId;
	if (!projectId) {
		return { reason: "missing-project", status: "refused" };
	}
	const type =
		input.draft.type ??
		prefill.fields.find((field) => field.field === "type")?.value;
	const created = await createWork(prisma, {
		actorId: input.actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human",
		payload: {
			projectId,
			title: input.draft.title,
			type,
		},
	});
	if (created.status !== "committed") {
		return { reason: "not-found", status: "refused" };
	}
	const statusValue =
		input.draft.status ??
		prefill.fields.find((field) => field.field === "status")?.value;
	if (statusValue && statusValue !== created.work.status) {
		await changeWorkStatus(prisma, {
			actorId: input.actorId,
			baseRevision: created.work.revision,
			idempotencyKey: `${input.idempotencyKey}-status`,
			origin: "human",
			status: statusValue,
			workId: created.work.id,
		});
	}
	return {
		missWarning: newWorkMissWarning(collection, input.draft),
		prefill,
		status: "ok",
		workId: created.work.id,
	};
}
