export const KANBAN_COPY = {
	blocked: "Blocked",
	board: "Board",
	closed: "Closed",
	inProgress: "In Progress",
	kanban: "Kanban",
	notStarted: "Not Started",
	openSourceRecord: "Open source record",
} as const;

export const KANBAN_COLUMNS = [
	KANBAN_COPY.notStarted,
	KANBAN_COPY.inProgress,
	KANBAN_COPY.blocked,
	KANBAN_COPY.closed,
] as const;

export type KanbanColumnStatus = (typeof KANBAN_COLUMNS)[number];

export const DEFAULT_CARD_VISIBLE_FIELDS = [
	"Key",
	"Type",
	"Status",
	"Priority",
	"Planned start",
	"Target date",
	"Reappear date",
	"Blocker",
	"Risk",
	"Checklist",
] as const;

export type CardVisibleField = (typeof DEFAULT_CARD_VISIBLE_FIELDS)[number];

export const KANBAN_SORT_FIELDS = [
	"Key",
	"Title",
	"Type",
	"Status",
	"Priority",
	"Planned start",
	"Target date",
	"Reappear date",
] as const;

export type KanbanSortField = (typeof KANBAN_SORT_FIELDS)[number];

export interface SavedViewSort {
	direction: "asc" | "desc";
	field: KanbanSortField;
}

export const DEFAULT_SAVED_VIEW_SORT: SavedViewSort = {
	direction: "asc",
	field: "Key",
};

export interface KanbanBoardPresentation {
	asOf?: string;
	sort?: SavedViewSort;
	visibleFields?: readonly CardVisibleField[];
}

export interface KanbanWorkRecord {
	archived?: boolean;
	blocker?: string | null;
	checklistCompleted?: number;
	checklistTotal?: number;
	closureResult?: string | null;
	id: string;
	key: string;
	plannedStart?: string | null;
	priority?: string | null;
	reappearDate?: string | null;
	revision: number;
	risk?: string | null;
	status: KanbanColumnStatus;
	targetDate?: string | null;
	title: string;
	type: string;
}

export interface KanbanCardSummaryField {
	field: CardVisibleField;
	value: string;
}

export interface KanbanCard {
	background: boolean;
	id: string;
	key: string;
	revision: number;
	status: KanbanColumnStatus;
	summary: KanbanCardSummaryField[];
	title: string;
	type: string;
	workId: string;
}

export interface KanbanColumn {
	cards: KanbanCard[];
	status: KanbanColumnStatus;
}

export interface KanbanBoardView {
	columns: KanbanColumn[];
	copy: typeof KANBAN_COPY;
	sort: SavedViewSort;
	visibleFields: readonly CardVisibleField[];
}

export function presentKanbanBoard(
	records: readonly KanbanWorkRecord[],
	presentation: KanbanBoardPresentation = {}
): KanbanBoardView {
	const {
		asOf,
		sort = DEFAULT_SAVED_VIEW_SORT,
		visibleFields = DEFAULT_CARD_VISIBLE_FIELDS,
	} = presentation;
	const active = records.filter((record) => record.archived !== true);
	return {
		columns: KANBAN_COLUMNS.map((status) => ({
			cards: sortRecords(
				active.filter((record) => record.status === status),
				sort
			).map((record) => toCard(record, visibleFields, asOf)),
			status,
		})),
		copy: KANBAN_COPY,
		sort,
		visibleFields,
	};
}

function toCard(
	record: KanbanWorkRecord,
	visibleFields: readonly CardVisibleField[],
	asOf?: string
): KanbanCard {
	const values: Record<CardVisibleField, string | null> = {
		Blocker: record.blocker ?? null,
		Checklist: checklistLabel(record),
		Key: record.key,
		"Planned start": record.plannedStart ?? null,
		Priority: record.priority ?? null,
		"Reappear date": record.reappearDate ?? null,
		Risk: record.risk ?? null,
		Status: record.closureResult
			? `${record.status} · ${record.closureResult}`
			: record.status,
		"Target date": record.targetDate ?? null,
		Type: record.type,
	};
	return {
		background: isBackground(record, asOf),
		id: record.id,
		key: record.key,
		revision: record.revision,
		status: record.status,
		summary: visibleFields.flatMap((field) => {
			const value = values[field];
			if (!value) {
				return [];
			}
			return [{ field, value }];
		}),
		title: record.title,
		type: record.type,
		workId: record.id,
	};
}

function isBackground(record: KanbanWorkRecord, asOf?: string): boolean {
	if (!(asOf && record.reappearDate)) {
		return false;
	}
	return record.reappearDate > asOf;
}

function sortRecords(
	records: readonly KanbanWorkRecord[],
	sort: SavedViewSort
): KanbanWorkRecord[] {
	const factor = sort.direction === "desc" ? -1 : 1;
	return [...records].sort((left, right) => {
		const compared =
			sortValue(left, sort.field).localeCompare(sortValue(right, sort.field)) *
			factor;
		if (compared !== 0) {
			return compared;
		}
		return left.key.localeCompare(right.key);
	});
}

function sortValue(record: KanbanWorkRecord, field: KanbanSortField): string {
	const values: Record<KanbanSortField, string> = {
		Key: record.key,
		"Planned start": record.plannedStart ?? "",
		Priority: record.priority ?? "",
		"Reappear date": record.reappearDate ?? "",
		Status: record.status,
		"Target date": record.targetDate ?? "",
		Title: record.title,
		Type: record.type,
	};
	return values[field];
}

function checklistLabel(record: KanbanWorkRecord): string | null {
	if (record.checklistTotal === undefined || record.checklistTotal === 0) {
		return null;
	}
	return `${record.checklistCompleted ?? 0}/${record.checklistTotal}`;
}
