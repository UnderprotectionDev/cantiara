export const BACKLOG_COPY = {
	backlog: "Backlog",
	date: "Date",
	deferred: "Deferred",
	field: "Field",
	manualOrder: "Manual order",
	moveDown: "Move down",
	moveUp: "Move up",
	notifyOnReappearDate: "Notify on Reappear date",
	priority: "Priority",
	reappearDate: "Reappear date",
	save: "Save",
} as const;

export const BACKLOG_SORTS = [
	BACKLOG_COPY.manualOrder,
	BACKLOG_COPY.priority,
	BACKLOG_COPY.date,
	BACKLOG_COPY.field,
] as const;

export type BacklogSort = (typeof BACKLOG_SORTS)[number];
