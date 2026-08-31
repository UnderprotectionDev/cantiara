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
	collapse: "Collapse",
	expand: "Expand",
	focusThreshold: "Focus threshold",
	inProgress: WORK_STATUS.inProgress,
	inProgressCount: "In Progress count",
	kanban: "Kanban",
	notStarted: WORK_STATUS.notStarted,
	openBlocker: "Open blocker",
	openSourceRecord: WORK_LIFECYCLE_COPY.openSourceRecord,
	overLimit: "Over limit",
	softWip: "Soft WIP",
	timeInStatus: "Time in status",
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
	status: WorkStatus;
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

export interface KanbanBoard {
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

export type KanbanMoveOutcome =
	| { status: "committed"; workId: string; workflowStatus: WorkStatus }
	| { reason: "close-step-required"; status: "rejected" }
	| { reason: "reopen-required"; status: "rejected" }
	| { reason: "target-not-found"; status: "rejected" }
	| { reason: "unknown-work-status"; status: "rejected" };

export interface WorkStatusPort {
	automaticWorkWrites: string[];
	fireSilentAutomation: (workId: string) => void;
	get: (workId: string) => KanbanWorkRecord | null;
	healthVerdicts: string[];
	list: () => KanbanWorkRecord[];
	memberships: (workId: string) => readonly string[];
	mintHealthVerdict: (workId: string) => void;
	mintNotification: (workId: string) => void;
	mutateWorkAutomatically: (workId: string) => void;
	notifications: string[];
	recordPlanningMembership: (workId: string, surface: string) => void;
	writeGitHubStatus: (workId: string, status: string) => void;
	writeWorkflowStatus: (
		workId: string,
		status: WorkStatus
	) => KanbanMoveOutcome;
}
