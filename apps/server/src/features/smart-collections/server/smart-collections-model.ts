import { RECORD_DISCOVERY_COPY } from "../../record-discovery/server/record-discovery-copy";
import {
	recordSurface,
	STRUCTURED_METADATA_COLLECTION_KINDS,
} from "../../record-discovery/server/record-discovery-table";

export const SMART_COLLECTIONS_COPY = {
	addCondition: "Add condition",
	allProjects: "All Projects",
	alreadyMatches: "The record already matches. No field write and no pin.",
	because: "Because",
	body: "Body",
	conditions: "Conditions",
	couldNotCreate: "Could not create this Smart Collection.",
	create: "Create Smart Collection",
	dragPreview:
		"This would write fields so the record matches. It does not pin membership.",
	dropHere: "Drop a record to preview a field write",
	empty: "No records match these conditions.",
	equals: "is",
	field: "Field",
	loading: "Loading…",
	members: "Members",
	name: "Name",
	newSmartCollection: "New Smart Collection",
	noneYet: "No Smart Collection yet.",
	noPin: "Pinning is not allowed. Membership comes only from conditions.",
	notMembers: "Not members",
	pin: "Pin",
	project: "Project",
	readableSummary: "Summary",
	records: "Records",
	scope: "Scope",
	smartCollection: "Smart Collection",
	sourceKind: "Source",
	status: "Status",
	tags: "Tags",
	type: "Type",
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

export const BUILDER_FIELDS = CONDITION_FIELDS.filter(
	(field) => field !== "body"
);

const CONDITION_FIELD_SET = new Set<string>(CONDITION_FIELDS);

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
		if (record.operator !== EQUALS_OPERATOR) {
			return [];
		}
		if (typeof record.value !== "string" || record.value.length === 0) {
			return [];
		}
		return [
			{
				field: record.field as ConditionField,
				operator: EQUALS_OPERATOR,
				value: record.value,
			},
		];
	});
}

export interface MembershipCondition {
	field: ConditionField;
	operator: typeof EQUALS_OPERATOR;
	value: string;
}

export interface SmartCollectionDefinition {
	conditions: readonly MembershipCondition[];
	id: string;
	name: string;
	projectId: string | null;
	sourceKind: string;
}

export interface CollectionRecord {
	body?: string;
	id: string;
	kind: string;
	projectId: string | null;
	scopeKind?: string;
	status?: string;
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

export function smartCollectionsCatalog() {
	return {
		copy: SMART_COLLECTIONS_COPY,
		kind: "smart-collection" as const,
		sourceKinds: {
			document: RECORD_DISCOVERY_COPY.document,
			fileAttachment: RECORD_DISCOVERY_COPY.fileAttachment,
			screen: RECORD_DISCOVERY_COPY.screen,
			wikiDocument: RECORD_DISCOVERY_COPY.wikiDocument,
			work: RECORD_DISCOVERY_COPY.work,
		},
	};
}
