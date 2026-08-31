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
	"Closure",
	"Priority",
	"Planned start",
	"Target date",
	"Reappear date",
	"Blocker",
	"Risk",
	"Checklist",
] as const;

export type CardVisibleField = (typeof DEFAULT_CARD_VISIBLE_FIELDS)[number];

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
	visibleFields: readonly CardVisibleField[];
}

export function presentKanbanBoard(
	records: readonly KanbanWorkRecord[],
	visibleFields: readonly CardVisibleField[] = DEFAULT_CARD_VISIBLE_FIELDS
): KanbanBoardView {
	const active = records.filter((record) => record.archived !== true);
	return {
		columns: KANBAN_COLUMNS.map((status) => ({
			cards: active
				.filter((record) => record.status === status)
				.map((record) => toCard(record, visibleFields)),
			status,
		})),
		copy: KANBAN_COPY,
		visibleFields,
	};
}

export function openSourceRecord(card: { workId: string }): { workId: string } {
	return { workId: card.workId };
}

function toCard(
	record: KanbanWorkRecord,
	visibleFields: readonly CardVisibleField[]
): KanbanCard {
	const values: Record<CardVisibleField, string | null> = {
		Blocker: record.blocker ?? null,
		Checklist: checklistLabel(record),
		Closure: record.closureResult ?? null,
		Key: record.key,
		"Planned start": record.plannedStart ?? null,
		Priority: record.priority ?? null,
		"Reappear date": record.reappearDate ?? null,
		Risk: record.risk ?? null,
		Status: record.status,
		"Target date": record.targetDate ?? null,
		Type: record.type,
	};
	return {
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

function checklistLabel(record: KanbanWorkRecord): string | null {
	if (record.checklistTotal === undefined || record.checklistTotal === 0) {
		return null;
	}
	return `${record.checklistCompleted ?? 0}/${record.checklistTotal}`;
}
