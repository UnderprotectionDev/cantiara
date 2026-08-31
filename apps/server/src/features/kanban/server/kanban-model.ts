import {
	WORK_LIFECYCLE_COPY,
	WORK_STATUS,
	WORK_STATUSES,
	type WorkStatus,
} from "../../work-lifecycle/server/work-lifecycle-model";

export const KANBAN_COPY = {
	blocked: WORK_STATUS.blocked,
	board: "Board",
	closed: WORK_STATUS.closed,
	inProgress: WORK_STATUS.inProgress,
	kanban: "Kanban",
	notStarted: WORK_STATUS.notStarted,
	openSourceRecord: WORK_LIFECYCLE_COPY.openSourceRecord,
} as const;

export const KANBAN_COLUMNS = WORK_STATUSES;

export type KanbanColumnStatus = WorkStatus;

export const PLANNING_MEMBERSHIP_SURFACES = [
	"Backlog",
	"Daily Focus",
	"Calendar",
	"Roadmap",
	"Favorites",
	"Focus Period",
] as const;

export type PlanningMembershipSurface =
	(typeof PLANNING_MEMBERSHIP_SURFACES)[number];

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
	status: WorkStatus;
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
	status: WorkStatus;
	summary: KanbanCardSummaryField[];
	title: string;
	type: string;
	workId: string;
}

export interface KanbanColumn {
	cards: KanbanCard[];
	status: KanbanColumnStatus;
}

export interface KanbanBoard {
	columns: KanbanColumn[];
	copy: typeof KANBAN_COPY;
	sort: SavedViewSort;
	visibleFields: readonly CardVisibleField[];
}

export type KanbanMoveOutcome =
	| { status: "committed"; workId: string; workflowStatus: WorkStatus }
	| { reason: "close-step-required"; status: "rejected" }
	| { reason: "reopen-required"; status: "rejected" }
	| { reason: "target-not-found"; status: "rejected" }
	| { reason: "unknown-work-status"; status: "rejected" };

export interface WorkStatusPort {
	fireSilentAutomation: (workId: string) => void;
	get: (workId: string) => KanbanWorkRecord | null;
	list: () => KanbanWorkRecord[];
	memberships: (workId: string) => readonly string[];
	recordPlanningMembership: (workId: string, surface: string) => void;
	writeGitHubStatus: (workId: string, status: string) => void;
	writeWorkflowStatus: (
		workId: string,
		status: WorkStatus
	) => KanbanMoveOutcome;
}
