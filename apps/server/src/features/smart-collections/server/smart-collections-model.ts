import { RECORD_DISCOVERY_COPY } from "../../record-discovery/server/record-discovery-copy";
import {
	recordSurface,
	STRUCTURED_METADATA_COLLECTION_KINDS,
} from "../../record-discovery/server/record-discovery-table";

export const SMART_COLLECTIONS_COPY = {
	addCondition: "Add condition",
	age: "Age",
	age0to7: "0–7 days",
	age8to30: "8–30 days",
	age31plus: "31+ days",
	allProjects: "All Projects",
	alreadyMatches: "The record already matches. No field write and no pin.",
	because: "Because",
	body: "Body",
	conditions: "Conditions",
	couldNotCreate: "Could not create this Smart Collection.",
	create: "Create Smart Collection",
	defaultNamedView: "Default",
	dragPreview:
		"This would write fields so the record matches. It does not pin membership.",
	dropHere: "Drop a record to preview a field write",
	effort: "Effort",
	empty: "No records match these conditions.",
	equals: "is",
	field: "Field",
	filter: "Filter",
	gallery: "Gallery",
	galleryUnavailable: "Gallery is not available for this source.",
	insights: "Insights",
	kanban: "Kanban",
	list: "List",
	loading: "Loading…",
	mayMissCollection: "This Work may not appear in the Smart Collection.",
	members: "Members",
	name: "Name",
	namedView: "Named view",
	newSmartCollection: "New Smart Collection",
	newWork: "New work",
	none: "None",
	noneYet: "No Smart Collection yet.",
	noPin: "Pinning is not allowed. Membership comes only from conditions.",
	notifyOnLeave: "Notify on leave",
	notMembers: "Not members",
	notSet: "Not set",
	pin: "Pin",
	project: "Project",
	purpose: "Purpose",
	readableSummary: "Summary",
	records: "Records",
	revert: "Revert",
	roadmap: "Roadmap",
	save: "Save",
	saveAs: "Save as",
	scope: "Scope",
	showAllRecords: "Show all records",
	smartCollection: "Smart Collection",
	sort: "Sort",
	sourceKind: "Source",
	status: "Status",
	subscribe: "Subscribe",
	table: "Table",
	tags: "Tags",
	timeInStatus: "Time in status",
	title: "Title",
	turnOnSubscribeFirst: "Turn on Subscribe first.",
	type: "Type",
	unsavedChanges: "Unsaved changes",
	value: "Value",
} as const;

export const CONDITION_FIELDS = [
	"status",
	"type",
	"projectId",
	"tagId",
	"scopeKind",
	"body",
] as const;

export type ConditionField = (typeof CONDITION_FIELDS)[number];

export const EQUALS_OPERATOR = "equals" as const;

export const CONDITION_OPERATORS = [
	"equals",
	"notEquals",
	"dateRange",
	"relatedTo",
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

const CONDITION_OPERATOR_SET = new Set<string>(CONDITION_OPERATORS);

export const PRESENTATIONS = [
	"List",
	"Table",
	"Gallery",
	"Kanban",
	"Roadmap",
] as const;

export type Presentation = (typeof PRESENTATIONS)[number];

const PRESENTATION_SET = new Set<string>(PRESENTATIONS);

export const PRESENTATION_WRITES = {
	backlogOrder: false,
	scope: false,
	status: false,
} as const;

export const NEW_WORK_PREFILL_FIELDS = ["status", "type", "projectId"] as const;

const NEW_WORK_PREFILL_FIELD_SET = new Set<string>(NEW_WORK_PREFILL_FIELDS);

export const DEFAULT_NAMED_VIEW = SMART_COLLECTIONS_COPY.defaultNamedView;

export function gallerySourceKinds(): readonly string[] {
	return [
		RECORD_DISCOVERY_COPY.document,
		RECORD_DISCOVERY_COPY.projectWall,
		RECORD_DISCOVERY_COPY.userFlow,
		RECORD_DISCOVERY_COPY.screen,
		RECORD_DISCOVERY_COPY.moodboard,
		RECORD_DISCOVERY_COPY.technicalDiagram,
		RECORD_DISCOVERY_COPY.fileAttachment,
		RECORD_DISCOVERY_COPY.source,
		RECORD_DISCOVERY_COPY.feedback,
	];
}

export function galleryAllowedFor(sourceKind: string): boolean {
	return gallerySourceKinds().includes(sourceKind);
}

export function parsePresentation(value: unknown): Presentation {
	if (typeof value === "string" && PRESENTATION_SET.has(value)) {
		return value as Presentation;
	}
	return "List";
}

export const BUILDER_FIELDS = CONDITION_FIELDS.filter(
	(field) => field !== "body"
);

const CONDITION_FIELD_SET = new Set<string>(CONDITION_FIELDS);

export function conditionMatches(
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

export function parseConditions(value: unknown): MembershipCondition[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.flatMap((item) => {
		if (!item || typeof item !== "object") {
			return [];
		}
		const record = item as Record<string, unknown>;
		if (
			typeof record.field !== "string" ||
			!CONDITION_FIELD_SET.has(record.field)
		) {
			return [];
		}
		if (
			typeof record.operator !== "string" ||
			!CONDITION_OPERATOR_SET.has(record.operator)
		) {
			return [];
		}
		if (typeof record.value !== "string" || record.value.length === 0) {
			return [];
		}
		return [
			{
				field: record.field as ConditionField,
				operator: record.operator as ConditionOperator,
				value: record.value,
			},
		];
	});
}

export interface MembershipCondition {
	field: ConditionField;
	operator: ConditionOperator;
	value: string;
}

export interface SmartCollectionDefinition {
	conditions: readonly MembershipCondition[];
	id: string;
	name: string;
	projectId: string | null;
	sourceKind: string;
	subscribeOnEntry: boolean;
	subscribeOnExit: boolean;
}

export interface CollectionRecord {
	accessible?: boolean;
	body?: string;
	createdAt?: string;
	documentVisualPath?: string | null;
	effort?: string;
	fileAttachmentVisualPath?: string | null;
	id: string;
	kind: string;
	projectId: string | null;
	safeLinkPreview?: string | null;
	scopeKind?: string;
	selectedDiagramViewId?: string | null;
	selectedWireframeVersionId?: string | null;
	status?: string;
	statusEnteredAt?: string;
	tagIds?: readonly string[];
	title: string;
	type?: string;
}

export interface MembershipReason {
	field: ConditionField;
	label: string;
}

export interface MembershipMember {
	because: readonly MembershipReason[];
	id: string;
	kind: string;
	projectId: string | null;
	title: string;
}

export interface MembershipView {
	members: readonly MembershipMember[];
	summary: string;
}

export const INSIGHT_DIMENSIONS = [
	"status",
	"effort",
	"age",
	"timeInStatus",
] as const;

export type InsightDimension = (typeof INSIGHT_DIMENSIONS)[number];

export interface InsightSlice {
	dimension: InsightDimension;
	value: string;
}

export interface InsightBucket {
	count: number;
	value: string;
}

export interface LightInsights {
	age: readonly InsightBucket[];
	effort: readonly InsightBucket[];
	recordCount: number;
	status: readonly InsightBucket[];
	timeInStatus: readonly InsightBucket[];
}

export interface InsightSliceOptions {
	now?: Date;
	slices?: readonly InsightSlice[];
}

export interface SmartCollectionPresentation {
	insights: LightInsights | null;
	membership: MembershipView;
}

export type DefineSmartCollectionResult =
	| { collection: SmartCollectionDefinition; status: "ok" }
	| {
			reason:
				| "source-not-allowed"
				| "document-body-condition"
				| "free-query"
				| "invalid-name"
				| "manual-membership";
			status: "refused";
	  };

export interface PinResult {
	parenting: false;
	reason: "pin-not-allowed" | "exception-not-allowed";
	status: "refused";
}

export interface FieldWrite {
	field: ConditionField;
	value: string;
}

export type DragPreviewResult =
	| {
			parenting: false;
			status: "preview";
			writes: readonly FieldWrite[];
	  }
	| { parenting: false; status: "impossible" };

export interface NamedViewDefinition {
	filterText: string;
	groupField: string | null;
	id: string;
	isDefault: boolean;
	name: string;
	presentation: Presentation;
	purpose: string | null;
	sortDirection: "asc" | "desc" | null;
	sortField: string | null;
	visibleFields: readonly string[];
}

export interface PresentationDraft {
	filterText: string;
	groupField: string | null;
	presentation: Presentation;
	purpose: string | null;
	sortDirection: "asc" | "desc" | null;
	sortField: string | null;
	visibleFields: readonly string[];
}

export type GalleryPreviewKind =
	| "wireframe"
	| "diagram-view"
	| "file-visual"
	| "document-visual"
	| "link-preview"
	| "text";

export interface GalleryPreview {
	coverRecord: false;
	kind: GalleryPreviewKind;
	text: string;
}

export type PresentationResult =
	| {
			coverRecord: false;
			memberIds: readonly string[];
			members: readonly MembershipMember[];
			presentation: Presentation;
			previews: readonly GalleryPreview[];
			status: "ok";
			writes: typeof PRESENTATION_WRITES;
	  }
	| { reason: "gallery-not-allowed"; status: "refused" };

export interface NamedViewPresentation {
	dirty: boolean;
	memberIds: readonly string[];
	presented: readonly MembershipMember[];
}

export interface NewWorkPrefill {
	fields: readonly FieldWrite[];
	skipped: readonly Pick<MembershipCondition, "field" | "operator">[];
}

export interface NewWorkDraft {
	projectId?: string;
	status?: string;
	type?: string;
}

export const DOCUMENT_METADATA_FIELDS = new Set<ConditionField>([
	"type",
	"projectId",
	"tagId",
	"scopeKind",
]);

const METADATA_KIND_SET = new Set<string>(STRUCTURED_METADATA_COLLECTION_KINDS);

export function fieldLabel(field: ConditionField): string {
	switch (field) {
		case "body":
			return SMART_COLLECTIONS_COPY.body;
		case "projectId":
			return SMART_COLLECTIONS_COPY.project;
		case "scopeKind":
			return SMART_COLLECTIONS_COPY.scope;
		case "status":
			return SMART_COLLECTIONS_COPY.status;
		case "tagId":
			return SMART_COLLECTIONS_COPY.tags;
		case "type":
			return SMART_COLLECTIONS_COPY.type;
		default:
			return field;
	}
}

export function smartCollectionSourceAllowed(kind: string): boolean {
	const surface = recordSurface(kind);
	return surface?.smartCollectionSource !== false && surface !== null;
}

export function isStructuredMetadataSource(kind: string): boolean {
	return METADATA_KIND_SET.has(kind);
}

export const SMART_COLLECTION_SUBSCRIPTION_COUNTERPARTS = {
	emailDigest: false,
	notificationCenterShell: false,
} as const;

export function smartCollectionsCatalog() {
	return {
		copy: SMART_COLLECTIONS_COPY,
		counterparts: SMART_COLLECTION_SUBSCRIPTION_COUNTERPARTS,
		gallerySourceKinds: gallerySourceKinds(),
		kind: "smart-collection" as const,
		presentations: PRESENTATIONS,
		sourceKinds: {
			document: RECORD_DISCOVERY_COPY.document,
			fileAttachment: RECORD_DISCOVERY_COPY.fileAttachment,
			screen: RECORD_DISCOVERY_COPY.screen,
			wikiDocument: RECORD_DISCOVERY_COPY.wikiDocument,
			work: RECORD_DISCOVERY_COPY.work,
		},
		writes: PRESENTATION_WRITES,
	};
}

export function draftFromNamedView(
	view: NamedViewDefinition
): PresentationDraft {
	return {
		filterText: view.filterText,
		groupField: view.groupField,
		presentation: view.presentation,
		purpose: view.purpose,
		sortDirection: view.sortDirection,
		sortField: view.sortField,
		visibleFields: [...view.visibleFields],
	};
}

export function isNamedViewDirty(
	saved: NamedViewDefinition,
	draft: PresentationDraft
): boolean {
	return (
		saved.filterText !== draft.filterText ||
		saved.groupField !== draft.groupField ||
		saved.presentation !== draft.presentation ||
		saved.purpose !== draft.purpose ||
		saved.sortDirection !== draft.sortDirection ||
		saved.sortField !== draft.sortField ||
		saved.visibleFields.join("\0") !== draft.visibleFields.join("\0")
	);
}

export function presentMembership(
	collection: SmartCollectionDefinition,
	membership: MembershipView,
	presentation: Presentation
): PresentationResult {
	if (presentation === "Gallery" && !galleryAllowedFor(collection.sourceKind)) {
		return { reason: "gallery-not-allowed", status: "refused" };
	}
	return {
		coverRecord: false,
		memberIds: membership.members.map((member) => member.id),
		members: membership.members,
		presentation,
		previews:
			presentation === "Gallery"
				? membership.members.map((member) =>
						deriveGalleryPreview({
							id: member.id,
							kind: member.kind,
							projectId: member.projectId,
							title: member.title,
						})
					)
				: [],
		status: "ok",
		writes: PRESENTATION_WRITES,
	};
}

export function presentNamedView(
	membership: MembershipView,
	saved: NamedViewDefinition,
	draft?: PresentationDraft
): NamedViewPresentation {
	const spec = draft ?? draftFromNamedView(saved);
	const filter = spec.filterText.trim().toLowerCase();
	let presented = membership.members.filter((member) => {
		if (filter.length === 0) {
			return true;
		}
		return member.title.toLowerCase().includes(filter);
	});
	if (spec.sortField === "title") {
		const direction = spec.sortDirection === "desc" ? -1 : 1;
		presented = [...presented].sort(
			(left, right) => left.title.localeCompare(right.title) * direction
		);
	}
	return {
		dirty: draft ? isNamedViewDirty(saved, draft) : false,
		memberIds: membership.members.map((member) => member.id),
		presented,
	};
}

export function deriveGalleryPreview(record: CollectionRecord): GalleryPreview {
	if (record.selectedWireframeVersionId) {
		return { coverRecord: false, kind: "wireframe", text: record.title };
	}
	if (record.selectedDiagramViewId) {
		return { coverRecord: false, kind: "diagram-view", text: record.title };
	}
	if (record.fileAttachmentVisualPath) {
		return { coverRecord: false, kind: "file-visual", text: record.title };
	}
	if (record.documentVisualPath) {
		return { coverRecord: false, kind: "document-visual", text: record.title };
	}
	if (record.safeLinkPreview) {
		return { coverRecord: false, kind: "link-preview", text: record.title };
	}
	return { coverRecord: false, kind: "text", text: record.title };
}

export function newWorkPrefill(
	collection: SmartCollectionDefinition
): NewWorkPrefill {
	const fields: FieldWrite[] = [];
	const skipped: Pick<MembershipCondition, "field" | "operator">[] = [];
	for (const condition of collection.conditions) {
		if (
			condition.operator === EQUALS_OPERATOR &&
			NEW_WORK_PREFILL_FIELD_SET.has(condition.field)
		) {
			fields.push({ field: condition.field, value: condition.value });
			continue;
		}
		skipped.push({ field: condition.field, operator: condition.operator });
	}
	return { fields, skipped };
}

export function newWorkMissWarning(
	collection: SmartCollectionDefinition,
	draft: NewWorkDraft
): string | null {
	const prefill = newWorkPrefill(collection);
	for (const field of prefill.fields) {
		const current = draft[field.field as keyof NewWorkDraft];
		if (current !== undefined && current !== field.value) {
			return SMART_COLLECTIONS_COPY.mayMissCollection;
		}
	}
	return null;
}

export function allowedPresentationsFor(sourceKind: string): Presentation[] {
	const base: Presentation[] = ["List", "Table"];
	if (galleryAllowedFor(sourceKind)) {
		base.push("Gallery");
	}
	if (sourceKind === RECORD_DISCOVERY_COPY.work) {
		base.push("Kanban", "Roadmap");
	}
	return base;
}
