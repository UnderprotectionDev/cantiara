export const KANBAN_COPY = {
	blocked: "Blocked",
	board: "Board",
	closed: "Closed",
	collapse: "Collapse",
	expand: "Expand",
	focusThreshold: "Focus threshold",
	inProgress: "In Progress",
	inProgressCount: "In Progress count",
	kanban: "Kanban",
	notStarted: "Not Started",
	openBlocker: "Open blocker",
	openSourceRecord: "Open source record",
	overLimit: "Over limit",
	softWip: "Soft WIP",
	timeInStatus: "Time in status",
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
}

export interface KanbanCardSummaryField {
	field: CardVisibleField;
	value: string;
}

export interface KanbanCard {
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
	visibleFields: readonly CardVisibleField[];
}

export interface KanbanPresentationOptions {
	collapsedStatuses?: readonly KanbanColumnStatus[];
	focusThreshold?: number | null;
	now?: Date;
	softWipLimits?: Partial<Record<KanbanColumnStatus, number>>;
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
			const cards = active
				.filter((record) => record.status === status)
				.map((record) => toCard(record, visibleFields, now));
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
		visibleFields,
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

function toCard(
	record: KanbanWorkRecord,
	visibleFields: readonly CardVisibleField[],
	now: Date
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
