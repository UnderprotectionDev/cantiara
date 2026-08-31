import {
	CLOSURE_RESULTS,
	type ClosureResult,
	NON_TERMINAL_WORK_STATUSES,
	WORK_LIFECYCLE_COPY,
	WORK_STATUS,
	WORK_STATUSES,
	type WorkStatus,
} from "../../work-lifecycle/server/work-lifecycle-model";

export const KANBAN_COPY = {
	abandoned: WORK_LIFECYCLE_COPY.abandoned,
	blocked: WORK_STATUS.blocked,
	board: "Board",
	cancel: "Cancel",
	closed: WORK_STATUS.closed,
	completed: WORK_LIFECYCLE_COPY.completed,
	confirmReopen: WORK_LIFECYCLE_COPY.confirmReopen,
	inProgress: WORK_STATUS.inProgress,
	kanban: "Kanban",
	notStarted: WORK_STATUS.notStarted,
	openSourceRecord: WORK_LIFECYCLE_COPY.openSourceRecord,
	reason: WORK_LIFECYCLE_COPY.reason,
	reopen: WORK_LIFECYCLE_COPY.reopen,
} as const;

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
		reopenTargets: NON_TERMINAL_WORK_STATUSES,
		results: CLOSURE_RESULTS,
	};
}

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
	targetDate?: string | null;
	title: string;
	type: string;
}

export interface KanbanCardSummaryField {
	field: CardVisibleField;
	value: string;
}

export interface KanbanCard {
	closureResult: string | null;
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
	visibleFields: readonly CardVisibleField[];
}

export type KanbanMoveOutcome =
	| { status: "committed"; workId: string; workflowStatus: WorkStatus }
	| { reason: "close-step-required"; status: "rejected" }
	| { reason: "reopen-required"; status: "rejected" }
	| { reason: "target-not-found"; status: "rejected" }
	| { reason: "unknown-work-status"; status: "rejected" };

export type KanbanCloseOutcome =
	| {
			closureResult: ClosureResult;
			status: "committed";
			workId: string;
			workflowStatus: typeof WORK_STATUS.closed;
	  }
	| { reason: "unknown-closure-result"; status: "rejected" }
	| { reason: "target-not-found"; status: "rejected" };

export type KanbanReopenOutcome =
	| { status: "committed"; workId: string; workflowStatus: WorkStatus }
	| { reason: "reopen-confirm-required"; status: "rejected" }
	| { reason: "unknown-work-status"; status: "rejected" }
	| { reason: "target-not-found"; status: "rejected" };

export interface KanbanLifecycleEvent {
	closureResult: string | null;
	kind: "closed" | "reopened" | "status";
	reason: string | null;
	status: string;
}

export interface WorkStatusPort {
	closeWork: (
		workId: string,
		result?: string,
		reason?: string
	) => KanbanCloseOutcome;
	fireSilentAutomation: (workId: string) => void;
	get: (workId: string) => KanbanWorkRecord | null;
	history: (workId: string) => readonly KanbanLifecycleEvent[];
	list: () => KanbanWorkRecord[];
	memberships: (workId: string) => readonly string[];
	recordPlanningMembership: (workId: string, surface: string) => void;
	reopenWork: (
		workId: string,
		status: string,
		confirmed: boolean
	) => KanbanReopenOutcome;
	writeGitHubStatus: (workId: string, status: string) => void;
	writeWorkflowStatus: (
		workId: string,
		status: WorkStatus
	) => KanbanMoveOutcome;
}
