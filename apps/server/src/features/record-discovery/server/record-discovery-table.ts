import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";

export const TABLE_AND_CELL_KINDS = [
	RECORD_DISCOVERY_COPY.work,
	RECORD_DISCOVERY_COPY.projectGoal,
	RECORD_DISCOVERY_COPY.milestone,
	RECORD_DISCOVERY_COPY.projectRelease,
	RECORD_DISCOVERY_COPY.feedback,
	RECORD_DISCOVERY_COPY.contact,
	RECORD_DISCOVERY_COPY.company,
	RECORD_DISCOVERY_COPY.userResearchSession,
	RECORD_DISCOVERY_COPY.decision,
	RECORD_DISCOVERY_COPY.risk,
	RECORD_DISCOVERY_COPY.assumption,
	RECORD_DISCOVERY_COPY.openQuestion,
	RECORD_DISCOVERY_COPY.productGap,
	RECORD_DISCOVERY_COPY.source,
	RECORD_DISCOVERY_COPY.plannedTestCase,
	RECORD_DISCOVERY_COPY.testHandoff,
	RECORD_DISCOVERY_COPY.testSession,
	RECORD_DISCOVERY_COPY.testGap,
	RECORD_DISCOVERY_COPY.testAssessment,
	RECORD_DISCOVERY_COPY.productionIncident,
] as const;

export const STRUCTURED_METADATA_COLLECTION_KINDS = [
	RECORD_DISCOVERY_COPY.document,
	RECORD_DISCOVERY_COPY.wikiDocument,
] as const;

export const SEARCH_WITHOUT_TABLE_OR_COLLECTION_KINDS = [
	RECORD_DISCOVERY_COPY.screen,
	RECORD_DISCOVERY_COPY.userFlow,
	RECORD_DISCOVERY_COPY.projectWall,
	RECORD_DISCOVERY_COPY.moodboard,
	RECORD_DISCOVERY_COPY.technicalDiagram,
	RECORD_DISCOVERY_COPY.fileAttachment,
] as const;

export const OWN_SURFACE_KINDS = [
	RECORD_DISCOVERY_COPY.captureInboxItem,
	RECORD_DISCOVERY_COPY.draft,
	RECORD_DISCOVERY_COPY.externalSurface,
	RECORD_DISCOVERY_COPY.githubExternalRecord,
] as const;

export type TableKind = (typeof TABLE_AND_CELL_KINDS)[number];

export type RecordSurfaceKind =
	| TableKind
	| (typeof STRUCTURED_METADATA_COLLECTION_KINDS)[number]
	| (typeof SEARCH_WITHOUT_TABLE_OR_COLLECTION_KINDS)[number]
	| (typeof OWN_SURFACE_KINDS)[number];

export interface RecordSurface {
	searchAndIndex: boolean;
	smartCollectionSource: boolean | "structured-metadata";
	tableAndCellEdit: boolean;
}

export interface SessionTestCell {
	id: string;
	result: string;
	title: string;
}

export interface TableRecord {
	id: string;
	kind: string;
	projectId: string | null;
	recordKey: string | null;
	revision: number;
	sessionTests: readonly SessionTestCell[];
	status: string;
	title: string;
}

export type OpenTypeTableResult =
	| {
			kind: TableKind;
			status: "ok";
			surface: typeof RECORD_DISCOVERY_COPY.table;
	  }
	| { reason: "table-not-allowed"; status: "refused" };

export type InlineCellResult =
	| { row: TableRecord; status: "ok" }
	| {
			reason:
				| "table-not-allowed"
				| "inline-is-not-bulk"
				| "field-not-writable"
				| "historical-result-not-writable";
			status: "refused";
	  };

export type TableSortField = "title" | "key" | "status";

export interface TypeTableQuery {
	filterText: string;
	kind: string;
	sortDirection: "asc" | "desc";
	sortField: TableSortField;
}

export interface TypeTableView {
	kind: string;
	rows: TableRecord[];
	surface: typeof RECORD_DISCOVERY_COPY.table;
}

export interface PasteColumnMapping {
	key: number | null;
	title: number;
}

export interface PastePreviewRow {
	action: "create" | "update" | "invalid";
	index: number;
	key: string;
	recordId: string | null;
	revision: number | null;
	title: string;
}

export interface PastePreview {
	headers: readonly string[];
	kind: string;
	mapping: PasteColumnMapping;
	projectId: string | null;
	rows: PastePreviewRow[];
}

export type ApplyPasteResult =
	| { records: TableRecord[]; status: "ok" }
	| {
			reason: "partial-refused" | "table-not-allowed";
			records: TableRecord[];
			status: "rejected";
	  };

const TABLE_KIND_SET = new Set<string>(TABLE_AND_CELL_KINDS);
const METADATA_KIND_SET = new Set<string>(STRUCTURED_METADATA_COLLECTION_KINDS);
const SEARCH_ONLY_KIND_SET = new Set<string>(
	SEARCH_WITHOUT_TABLE_OR_COLLECTION_KINDS
);
const OWN_SURFACE_SET = new Set<string>(OWN_SURFACE_KINDS);

const WRITABLE_FIELDS = new Set(["title"]);

export function recordSurface(kind: string): RecordSurface | null {
	if (TABLE_KIND_SET.has(kind)) {
		return {
			searchAndIndex: true,
			smartCollectionSource: true,
			tableAndCellEdit: true,
		};
	}
	if (METADATA_KIND_SET.has(kind)) {
		return {
			searchAndIndex: true,
			smartCollectionSource: "structured-metadata",
			tableAndCellEdit: false,
		};
	}
	if (SEARCH_ONLY_KIND_SET.has(kind)) {
		return {
			searchAndIndex: true,
			smartCollectionSource: false,
			tableAndCellEdit: false,
		};
	}
	if (OWN_SURFACE_SET.has(kind)) {
		return {
			searchAndIndex: false,
			smartCollectionSource: false,
			tableAndCellEdit: false,
		};
	}
	return null;
}

export function openTypeTable(kind: string): OpenTypeTableResult {
	if (!TABLE_KIND_SET.has(kind)) {
		return { reason: "table-not-allowed", status: "refused" };
	}
	return {
		kind: kind as TableKind,
		status: "ok",
		surface: RECORD_DISCOVERY_COPY.table,
	};
}

export function queryTypeTable(
	records: readonly TableRecord[],
	query: TypeTableQuery
): TypeTableView {
	const opened = openTypeTable(query.kind);
	if (opened.status !== "ok") {
		return {
			kind: query.kind,
			rows: [],
			surface: RECORD_DISCOVERY_COPY.table,
		};
	}
	const filter = query.filterText.trim().toLowerCase();
	const rows = records
		.filter((row) => row.kind === query.kind)
		.filter((row) => {
			if (filter.length === 0) {
				return true;
			}
			return (
				row.title.toLowerCase().includes(filter) ||
				(row.recordKey ?? "").toLowerCase().includes(filter)
			);
		})
		.slice()
		.sort((left, right) => compareRows(left, right, query));
	return {
		kind: query.kind,
		rows,
		surface: RECORD_DISCOVERY_COPY.table,
	};
}

export function applyInlineCell(input: {
	field: string;
	kind: string;
	row: TableRecord;
	value: string;
	withFields?: Record<string, string>;
}): InlineCellResult {
	if (openTypeTable(input.kind).status !== "ok") {
		return { reason: "table-not-allowed", status: "refused" };
	}
	if (input.withFields && Object.keys(input.withFields).length > 0) {
		return { reason: "inline-is-not-bulk", status: "refused" };
	}
	if (input.field.startsWith("sessionTests.")) {
		return { reason: "historical-result-not-writable", status: "refused" };
	}
	if (!WRITABLE_FIELDS.has(input.field)) {
		return { reason: "field-not-writable", status: "refused" };
	}
	const title = input.value.trim();
	if (title.length === 0) {
		return { reason: "field-not-writable", status: "refused" };
	}
	return {
		row: {
			...input.row,
			kind: input.kind,
			title,
		},
		status: "ok",
	};
}

export function previewTablePaste(input: {
	existing: readonly TableRecord[];
	headers: readonly string[];
	kind: string;
	mapping: PasteColumnMapping;
	projectId: string | null;
	rows: readonly (readonly string[])[];
}): PastePreview {
	const byKey = new Map(
		input.existing
			.filter((row) => row.kind === input.kind && row.recordKey)
			.map((row) => [row.recordKey as string, row])
	);
	const previewRows = input.rows.map((cells, index) => {
		const title = cellAt(cells, input.mapping.title).trim();
		const key =
			input.mapping.key === null ? "" : cellAt(cells, input.mapping.key).trim();
		if (title.length === 0) {
			return {
				action: "invalid" as const,
				index,
				key,
				recordId: null,
				revision: null,
				title,
			};
		}
		const match = key.length > 0 ? byKey.get(key) : undefined;
		if (match) {
			return {
				action: "update" as const,
				index,
				key,
				recordId: match.id,
				revision: match.revision,
				title,
			};
		}
		if (!input.projectId) {
			return {
				action: "invalid" as const,
				index,
				key,
				recordId: null,
				revision: null,
				title,
			};
		}
		return {
			action: "create" as const,
			index,
			key,
			recordId: null,
			revision: null,
			title,
		};
	});
	return {
		headers: input.headers,
		kind: input.kind,
		mapping: input.mapping,
		projectId: input.projectId,
		rows: previewRows,
	};
}

export function applyTablePaste(input: {
	existing: readonly TableRecord[];
	excludedIndexes: readonly number[];
	preview: PastePreview;
}): ApplyPasteResult {
	if (openTypeTable(input.preview.kind).status !== "ok") {
		return {
			reason: "table-not-allowed",
			records: [...input.existing],
			status: "rejected",
		};
	}
	const excluded = new Set(input.excludedIndexes);
	const included = input.preview.rows.filter((row) => !excluded.has(row.index));
	if (included.some((row) => row.action === "invalid")) {
		return {
			reason: "partial-refused",
			records: [...input.existing],
			status: "rejected",
		};
	}
	const records = input.existing.map((row) => ({ ...row }));
	for (const row of included) {
		if (row.action === "update" && row.recordId) {
			const current = records.find((item) => item.id === row.recordId);
			if (!current) {
				return {
					reason: "partial-refused",
					records: [...input.existing],
					status: "rejected",
				};
			}
			current.title = row.title;
		}
		if (row.action === "create") {
			records.push({
				id: `paste-${row.index}`,
				kind: input.preview.kind,
				projectId: input.preview.projectId,
				recordKey: row.key.length > 0 ? row.key : null,
				revision: 1,
				sessionTests: [],
				status: "Not Started",
				title: row.title,
			});
		}
	}
	return { records, status: "ok" };
}

export function saveTableAsSmartCollection(_kind: string): {
	membershipStored: false;
	status: "refused";
} {
	return { membershipStored: false, status: "refused" };
}

function compareRows(
	left: TableRecord,
	right: TableRecord,
	query: TypeTableQuery
): number {
	const leftValue = sortValue(left, query.sortField);
	const rightValue = sortValue(right, query.sortField);
	if (leftValue < rightValue) {
		return query.sortDirection === "asc" ? -1 : 1;
	}
	if (leftValue > rightValue) {
		return query.sortDirection === "asc" ? 1 : -1;
	}
	if (left.id < right.id) {
		return -1;
	}
	if (left.id > right.id) {
		return 1;
	}
	return 0;
}

function sortValue(row: TableRecord, field: TableSortField): string {
	if (field === "key") {
		return (row.recordKey ?? "").toLowerCase();
	}
	if (field === "status") {
		return row.status.toLowerCase();
	}
	return row.title.toLowerCase();
}

function cellAt(cells: readonly string[], index: number): string {
	return cells[index] ?? "";
}
