export const KANBAN_COPY = {
	abandoned: "Abandoned",
	blocked: "Blocked",
	board: "Board",
	cancel: "Cancel",
	closed: "Closed",
	collapse: "Collapse",
	completed: "Completed",
	confirmReopen: "Confirm reopen",
	expand: "Expand",
	focusThreshold: "Focus threshold",
	inProgress: "In Progress",
	inProgressCount: "In Progress count",
	kanban: "Kanban",
	list: "List",
	notStarted: "Not Started",
	openBlocker: "Open blocker",
	openSourceRecord: "Open source record",
	overLimit: "Over limit",
	reason: "Reason",
	reopen: "Reopen",
	softWip: "Soft WIP",
	timeInStatus: "Time in status",
} as const;

export const KANBAN_LIST_LAYOUT = "list" as const;

export const KANBAN_COLUMNS = [
	KANBAN_COPY.notStarted,
	KANBAN_COPY.inProgress,
	KANBAN_COPY.blocked,
	KANBAN_COPY.closed,
] as const;

export const KANBAN_CLOSURE_RESULTS = [
	KANBAN_COPY.completed,
	KANBAN_COPY.abandoned,
] as const;

export const KANBAN_REOPEN_TARGETS = [
	KANBAN_COPY.notStarted,
	KANBAN_COPY.inProgress,
	KANBAN_COPY.blocked,
] as const;

export function presentKanbanClosureStep() {
	return {
		copy: {
			abandoned: KANBAN_COPY.abandoned,
			cancel: KANBAN_COPY.cancel,
			completed: KANBAN_COPY.completed,
			confirmReopen: KANBAN_COPY.confirmReopen,
			reason: KANBAN_COPY.reason,
			reopen: KANBAN_COPY.reopen,
		},
		reopenTargets: KANBAN_REOPEN_TARGETS,
		results: KANBAN_CLOSURE_RESULTS,
	};
}

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
	statusEnteredAt?: string | null;
	targetDate?: string | null;
	title: string;
	type: string;
	unplanned?: boolean;
}

export interface KanbanCardSummaryField {
	field: CardVisibleField;
	value: string;
}

export interface KanbanCard {
	background: boolean;
	closureResult: string | null;
	id: string;
	key: string;
	openBlocker: boolean;
	revision: number;
	status: KanbanColumnStatus;
	summary: KanbanCardSummaryField[];
	timeInCurrentStatus: string | null;
	title: string;
	type: string;
	workId: string;
}

export interface KanbanSoftWipView {
	count: number;
	exceeded: boolean;
	limit: number | null;
	mark: typeof KANBAN_COPY.overLimit | null;
}

export interface KanbanFocusView {
	count: number;
	exceeded: boolean;
	mark: typeof KANBAN_COPY.overLimit | null;
	threshold: number | null;
}

export interface KanbanColumn {
	cards: KanbanCard[];
	collapsed: boolean;
	count: number;
	openBlockerCount: number;
	softWip: KanbanSoftWipView;
	status: KanbanColumnStatus;
}

export interface KanbanBoardView {
	columns: KanbanColumn[];
	copy: typeof KANBAN_COPY;
	focus: KanbanFocusView;
	inProgressCount: number;
	sort: SavedViewSort;
	visibleFields: readonly CardVisibleField[];
}

export interface KanbanListView {
	copy: typeof KANBAN_COPY;
	layout: typeof KANBAN_LIST_LAYOUT;
	rows: KanbanCard[];
	visibleFields: readonly CardVisibleField[];
}

export interface KanbanPresentationOptions {
	asOf?: string;
	collapsedStatuses?: readonly KanbanColumnStatus[];
	focusThreshold?: number | null;
	now?: Date;
	softWipLimits?: Partial<Record<KanbanColumnStatus, number>>;
	sort?: SavedViewSort;
	visibleFields?: readonly CardVisibleField[];
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
export function presentKanbanBoard(
	records: readonly KanbanWorkRecord[],
	options: KanbanPresentationOptions = {}
): KanbanBoardView {
	const visibleFields = options.visibleFields ?? DEFAULT_CARD_VISIBLE_FIELDS;
	const now = options.now ?? new Date();
	const asOf = options.asOf ?? now.toISOString().slice(0, 10);
	const sort = options.sort ?? DEFAULT_SAVED_VIEW_SORT;
	const collapsed = new Set(options.collapsedStatuses ?? []);
	const active = records.filter((record) => record.archived !== true);
	const inProgressCount = active.filter(
		(record) => record.status === KANBAN_COPY.inProgress
	).length;
	const threshold =
		typeof options.focusThreshold === "number" && options.focusThreshold > 0
			? options.focusThreshold
			: null;
	const focusExceeded =
		typeof threshold === "number" && inProgressCount > threshold;
	return {
		columns: KANBAN_COLUMNS.map((status) => {
			const cards = sortRecords(
				active.filter((record) => record.status === status),
				sort
			).map((record) => toCard(record, visibleFields, now, asOf));
			const limit = options.softWipLimits?.[status] ?? null;
			const count = cards.length;
			const exceeded = typeof limit === "number" && count > limit;
			return {
				cards,
				collapsed: collapsed.has(status),
				count,
				openBlockerCount: cards.filter((card) => card.openBlocker).length,
				softWip: {
					count,
					exceeded,
					limit,
					mark: exceeded ? KANBAN_COPY.overLimit : null,
				},
				status,
			};
		}),
		copy: KANBAN_COPY,
		focus: {
			count: inProgressCount,
			exceeded: focusExceeded,
			mark: focusExceeded ? KANBAN_COPY.overLimit : null,
			threshold,
		},
		inProgressCount,
		sort,
		visibleFields,
	};
}

export function presentKanbanList(
	records: readonly KanbanWorkRecord[],
	options: KanbanPresentationOptions = {}
): KanbanListView {
	const board = presentKanbanBoard(records, options);
	return {
		copy: KANBAN_COPY,
		layout: KANBAN_LIST_LAYOUT,
		rows: board.columns.flatMap((column) => column.cards),
		visibleFields: board.visibleFields,
	};
}

export function sortKanbanList(
	list: KanbanListView,
	field: CardVisibleField
): KanbanListView {
	return {
		...list,
		rows: [...list.rows].sort((left, right) =>
			listFieldValue(left, field).localeCompare(listFieldValue(right, field))
		),
	};
}

export function collapseKanbanColumn(
	board: KanbanBoardView,
	status: KanbanColumnStatus
): KanbanBoardView {
	return {
		...board,
		columns: board.columns.map((column) =>
			column.status === status ? { ...column, collapsed: true } : column
		),
	};
}

function listFieldValue(row: KanbanCard, field: CardVisibleField): string {
	if (field === "Key") {
		return row.key;
	}
	return row.summary.find((entry) => entry.field === field)?.value ?? "";
}
function toCard(
	record: KanbanWorkRecord,
	visibleFields: readonly CardVisibleField[],
	now: Date,
	asOf: string
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
	const active = record.status !== KANBAN_COPY.closed;
	return {
		background: isBackground(record, asOf),
		closureResult: record.closureResult ?? null,
		id: record.id,
		key: record.key,
		openBlocker: record.blocker === "Active",
		revision: record.revision,
		status: record.status,
		summary: visibleFields.flatMap((field) => {
			const value = values[field];
			if (!value) {
				return [];
			}
			return [{ field, value }];
		}),
		timeInCurrentStatus:
			active && record.statusEnteredAt
				? formatTimeInCurrentStatus(record.statusEnteredAt, now)
				: null,
		title: record.title,
		type: record.type,
		workId: record.id,
	};
}

function isBackground(record: KanbanWorkRecord, asOf: string): boolean {
	if (!record.reappearDate) {
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

function formatTimeInCurrentStatus(enteredAt: string, now: Date): string {
	const elapsed = Math.max(0, now.getTime() - Date.parse(enteredAt));
	if (elapsed < HOUR_MS) {
		return `${Math.floor(elapsed / MINUTE_MS)}m`;
	}
	if (elapsed < DAY_MS) {
		return `${Math.floor(elapsed / HOUR_MS)}h`;
	}
	return `${Math.floor(elapsed / DAY_MS)}d`;
}

function checklistLabel(record: KanbanWorkRecord): string | null {
	if (record.checklistTotal === undefined || record.checklistTotal === 0) {
		return null;
	}
	return `${record.checklistCompleted ?? 0}/${record.checklistTotal}`;
}
