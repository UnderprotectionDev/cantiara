import { z } from "zod";

export const FOCUS_PERIOD_COPY = {
	abandon: "Abandon",
	active: "Active",
	add: "Add",
	addedLater: "Added later",
	alreadyInAnActivePeriod:
		"Work is already in an active Focus Period. Use Move.",
	anotherPeriod: "Another period",
	backlog: "Backlog",
	blockedBy: "Blocked by",
	blocks: "Blocks",
	cancel: "Cancel",
	canceled: "Canceled",
	change: "Change",
	close: "Close",
	closed: "Closed",
	completed: "Completed",
	completedAfter: "Completed after",
	completedOnTarget: "Completed on target",
	confirm: "Confirm",
	create: "Create Focus Period",
	cycle: "These records wait on each other.",
	dateComparison: "Date comparison",
	dependencies: "Dependencies",
	empty: "No Focus Period yet.",
	endDate: "End date",
	focusPeriod: "Focus Period",
	followUpWork: "Follow-up Work",
	inStartSnapshot: "In start snapshot",
	keep: "Keep",
	loading: "Loading…",
	members: "Work",
	move: "Move",
	movedEarlier: "Moved earlier",
	movedLater: "Moved later",
	nextPeriod: "Next period",
	openSourceRecord: "Open source record",
	periodEvaluation: "Period evaluation",
	planned: "Planned",
	preview: "Preview",
	purpose: "Purpose",
	purposeRequired: "Purpose is required.",
	remove: "Remove",
	removed: "Removed",
	resolved: "Resolved",
	send: "Send",
	skip: "Skip",
	startDate: "Start date",
	stillOpenWork: "Still-open Work",
	tryNext: "Try next",
	windowMustBeOneToEightWeeks: "Focus Period must be 1–8 weeks.",
	work: "Work",
} as const;

export const FOCUS_PERIOD_STATUS = {
	active: FOCUS_PERIOD_COPY.active,
	canceled: FOCUS_PERIOD_COPY.canceled,
	closed: FOCUS_PERIOD_COPY.closed,
	planned: FOCUS_PERIOD_COPY.planned,
} as const;

export const FOCUS_PERIOD_STATUSES = [
	FOCUS_PERIOD_STATUS.planned,
	FOCUS_PERIOD_STATUS.active,
	FOCUS_PERIOD_STATUS.closed,
	FOCUS_PERIOD_STATUS.canceled,
] as const;

export type FocusPeriodStatus = (typeof FOCUS_PERIOD_STATUSES)[number];

export const FOCUS_PERIOD_MIN_DAYS = 7;
export const FOCUS_PERIOD_MAX_DAYS = 56;

export const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const calendarDaySchema = z.string().regex(CALENDAR_DAY_PATTERN);

export const FOCUS_PERIOD_PLANNING_WRITES = {
	stage: false,
	status: false,
} as const;

export const FOCUS_PERIOD_COUNTERPARTS = {
	dailyFocus: false,
	milestone: false,
	projectRelease: false,
} as const;

export const FOCUS_PERIOD_STILL_OPEN = {
	autoRollover: false,
	writesManualOrder: false,
} as const;

export const FOCUS_PERIOD_LEFTOVER_DESTINATION = {
	abandon: "abandon",
	anotherPeriod: "another-period",
	backlog: "backlog",
	nextPeriod: "next-period",
} as const;

export const FOCUS_PERIOD_LEFTOVER_DESTINATIONS = [
	FOCUS_PERIOD_LEFTOVER_DESTINATION.nextPeriod,
	FOCUS_PERIOD_LEFTOVER_DESTINATION.backlog,
	FOCUS_PERIOD_LEFTOVER_DESTINATION.anotherPeriod,
	FOCUS_PERIOD_LEFTOVER_DESTINATION.abandon,
] as const;

export type FocusPeriodLeftoverDestination =
	(typeof FOCUS_PERIOD_LEFTOVER_DESTINATIONS)[number];

export const FOCUS_PERIOD_CLOSE_JUDGEMENT = {
	actualDateField: false,
	generatedActionItems: false,
	health: false,
	performanceNote: false,
	score: false,
	velocity: false,
} as const;

export const FOCUS_PERIOD_DEPENDENCY_ACTIONS = {
	createRelation: false,
	resolveRelation: false,
} as const;

export const FOCUS_PERIOD_DEPENDENCY_FACTS = {
	criticalPath: false,
	secondPlanningFact: false,
	writable: false,
} as const;

export const FOCUS_PERIOD_DEPENDENCY_KINDS = [
	"Work",
	"Decision",
	"Question",
] as const;

export function inclusiveDayCount(startDate: string, endDate: string): number {
	const start = utcDay(startDate);
	const end = utcDay(endDate);
	return Math.round((end - start) / 86_400_000) + 1;
}

export function isFocusPeriodWindow(
	startDate: string,
	endDate: string
): boolean {
	if (
		!(
			CALENDAR_DAY_PATTERN.test(startDate) && CALENDAR_DAY_PATTERN.test(endDate)
		)
	) {
		return false;
	}
	const days = inclusiveDayCount(startDate, endDate);
	return days >= FOCUS_PERIOD_MIN_DAYS && days <= FOCUS_PERIOD_MAX_DAYS;
}

function utcDay(isoDate: string): number {
	const [year, month, day] = isoDate.split("-").map(Number);
	return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export const focusPeriodWorkSchema = z.object({
	id: z.string().min(1),
	key: z.string().min(1),
	projectId: z.string().min(1),
	projectName: z.string().min(1),
	title: z.string().min(1),
});

export type FocusPeriodWork = z.infer<typeof focusPeriodWorkSchema>;

const eligibleWorkSchema = focusPeriodWorkSchema.extend({
	activePeriodId: z.string().min(1).nullable(),
});

export const focusPeriodDependencyNodeSchema = z.object({
	href: z.string().min(1),
	id: z.string().min(1),
	kind: z.enum(FOCUS_PERIOD_DEPENDENCY_KINDS),
	label: z.string().min(1),
	openSourceRecord: z.literal(FOCUS_PERIOD_COPY.openSourceRecord),
});

export type FocusPeriodDependencyNode = z.infer<
	typeof focusPeriodDependencyNodeSchema
>;

export const focusPeriodDependencyEdgeSchema = z.object({
	direction: z.literal(FOCUS_PERIOD_COPY.blocks),
	from: z.object({
		id: z.string().min(1),
		kind: z.enum(FOCUS_PERIOD_DEPENDENCY_KINDS),
	}),
	id: z.string().min(1),
	state: z.enum([FOCUS_PERIOD_COPY.active, FOCUS_PERIOD_COPY.resolved]),
	to: z.object({
		id: z.string().min(1),
		kind: z.literal("Work"),
	}),
});

export const focusPeriodDependencyCycleSchema = z.object({
	explanation: z.literal(FOCUS_PERIOD_COPY.cycle),
	relationIds: z.array(z.string().min(1)),
	workIds: z.array(z.string().min(1)),
});

export const focusPeriodDependenciesSchema = z.object({
	actions: z.object({
		createRelation: z.literal(false),
		resolveRelation: z.literal(false),
	}),
	copy: z.object({
		active: z.literal(FOCUS_PERIOD_COPY.active),
		blockedBy: z.literal(FOCUS_PERIOD_COPY.blockedBy),
		blocks: z.literal(FOCUS_PERIOD_COPY.blocks),
		cycle: z.literal(FOCUS_PERIOD_COPY.cycle),
		dependencies: z.literal(FOCUS_PERIOD_COPY.dependencies),
		openSourceRecord: z.literal(FOCUS_PERIOD_COPY.openSourceRecord),
		resolved: z.literal(FOCUS_PERIOD_COPY.resolved),
	}),
	criticalPath: z.literal(false),
	cycles: z.array(focusPeriodDependencyCycleSchema),
	edges: z.array(focusPeriodDependencyEdgeSchema),
	nodes: z.array(focusPeriodDependencyNodeSchema),
	optional: z.literal(true),
	secondPlanningFact: z.literal(false),
	writable: z.literal(false),
});

export type FocusPeriodDependencies = z.infer<
	typeof focusPeriodDependenciesSchema
>;

export function emptyFocusPeriodDependencies(): FocusPeriodDependencies {
	return {
		actions: FOCUS_PERIOD_DEPENDENCY_ACTIONS,
		copy: {
			active: FOCUS_PERIOD_COPY.active,
			blockedBy: FOCUS_PERIOD_COPY.blockedBy,
			blocks: FOCUS_PERIOD_COPY.blocks,
			cycle: FOCUS_PERIOD_COPY.cycle,
			dependencies: FOCUS_PERIOD_COPY.dependencies,
			openSourceRecord: FOCUS_PERIOD_COPY.openSourceRecord,
			resolved: FOCUS_PERIOD_COPY.resolved,
		},
		criticalPath: FOCUS_PERIOD_DEPENDENCY_FACTS.criticalPath,
		cycles: [],
		edges: [],
		nodes: [],
		optional: true,
		secondPlanningFact: FOCUS_PERIOD_DEPENDENCY_FACTS.secondPlanningFact,
		writable: FOCUS_PERIOD_DEPENDENCY_FACTS.writable,
	};
}

export function sourceRecordHref(
	kind: (typeof FOCUS_PERIOD_DEPENDENCY_KINDS)[number],
	id: string,
	projectId: string
): string {
	if (kind === "Work") {
		return `/projects/${projectId}?work=${encodeURIComponent(id)}#work`;
	}
	if (kind === "Decision") {
		return `/projects/${projectId}#decisions`;
	}
	return `/projects/${projectId}#questions`;
}

export const focusPeriodScopeSchema = z.object({
	workIds: z.array(z.string().min(1)),
});

export type FocusPeriodScope = z.infer<typeof focusPeriodScopeSchema>;

export const focusPeriodDestinationPeriodSchema = z.object({
	endDate: calendarDaySchema,
	id: z.string().min(1),
	purpose: z.string().min(1),
	startDate: calendarDaySchema,
	status: z.enum(FOCUS_PERIOD_STATUSES),
});

export const leftoverDecisionSchema = z.object({
	destination: z.enum(FOCUS_PERIOD_LEFTOVER_DESTINATIONS),
	periodId: z.string().min(1).nullable(),
	workId: z.string().min(1),
});

export const stillOpenWorkSchema = z.object({
	autoRollover: z.literal(false),
	decisions: z.array(leftoverDecisionSchema),
	destinations: z.object({
		abandon: z.literal(true),
		anotherPeriod: z.array(focusPeriodDestinationPeriodSchema),
		backlog: z.literal(true),
		nextPeriod: focusPeriodDestinationPeriodSchema.nullable(),
	}),
	opened: z.boolean(),
	stillOpen: z.array(focusPeriodWorkSchema),
	writesManualOrder: z.literal(false),
});

export const closeComparisonSchema = z.object({
	addedLater: z.array(focusPeriodWorkSchema),
	completed: z.array(focusPeriodWorkSchema),
	inStartSnapshot: z.array(focusPeriodWorkSchema),
	performanceNote: z.literal(false),
	removed: z.array(focusPeriodWorkSchema),
	score: z.literal(false),
	stillOpen: z.array(focusPeriodWorkSchema),
	velocity: z.literal(false),
});

export const dateComparisonSchema = z.object({
	actualDateField: z.literal(false),
	completedAfter: z.array(focusPeriodWorkSchema),
	completedOnTarget: z.array(focusPeriodWorkSchema),
	health: z.literal(false),
	movedEarlier: z.array(focusPeriodWorkSchema),
	movedLater: z.array(focusPeriodWorkSchema),
	optional: z.literal(true),
	score: z.literal(false),
	stillOpen: z.array(focusPeriodWorkSchema),
});

export const followUpWorkPreviewSchema = z.object({
	generatedActionItems: z.literal(false),
	projectId: z.string().min(1),
	sourcePeriodId: z.string().min(1),
	title: z.string().min(1),
});

export const periodEvaluationSchema = z.object({
	change: z.string(),
	followUpWork: z.array(focusPeriodWorkSchema),
	generatedActionItems: z.literal(false),
	keep: z.string(),
	previewRequired: z.literal(true),
	skippable: z.literal(true),
	skipped: z.boolean(),
	tryNext: z.string(),
});

const focusPeriodCopySchema = z.object({
	abandon: z.literal(FOCUS_PERIOD_COPY.abandon),
	active: z.literal(FOCUS_PERIOD_COPY.active),
	add: z.literal(FOCUS_PERIOD_COPY.add),
	addedLater: z.literal(FOCUS_PERIOD_COPY.addedLater),
	alreadyInAnActivePeriod: z.literal(FOCUS_PERIOD_COPY.alreadyInAnActivePeriod),
	anotherPeriod: z.literal(FOCUS_PERIOD_COPY.anotherPeriod),
	backlog: z.literal(FOCUS_PERIOD_COPY.backlog),
	blockedBy: z.literal(FOCUS_PERIOD_COPY.blockedBy),
	blocks: z.literal(FOCUS_PERIOD_COPY.blocks),
	cancel: z.literal(FOCUS_PERIOD_COPY.cancel),
	canceled: z.literal(FOCUS_PERIOD_COPY.canceled),
	change: z.literal(FOCUS_PERIOD_COPY.change),
	close: z.literal(FOCUS_PERIOD_COPY.close),
	closed: z.literal(FOCUS_PERIOD_COPY.closed),
	completed: z.literal(FOCUS_PERIOD_COPY.completed),
	completedAfter: z.literal(FOCUS_PERIOD_COPY.completedAfter),
	completedOnTarget: z.literal(FOCUS_PERIOD_COPY.completedOnTarget),
	confirm: z.literal(FOCUS_PERIOD_COPY.confirm),
	create: z.literal(FOCUS_PERIOD_COPY.create),
	cycle: z.literal(FOCUS_PERIOD_COPY.cycle),
	dateComparison: z.literal(FOCUS_PERIOD_COPY.dateComparison),
	dependencies: z.literal(FOCUS_PERIOD_COPY.dependencies),
	empty: z.literal(FOCUS_PERIOD_COPY.empty),
	endDate: z.literal(FOCUS_PERIOD_COPY.endDate),
	focusPeriod: z.literal(FOCUS_PERIOD_COPY.focusPeriod),
	followUpWork: z.literal(FOCUS_PERIOD_COPY.followUpWork),
	inStartSnapshot: z.literal(FOCUS_PERIOD_COPY.inStartSnapshot),
	keep: z.literal(FOCUS_PERIOD_COPY.keep),
	loading: z.literal(FOCUS_PERIOD_COPY.loading),
	members: z.literal(FOCUS_PERIOD_COPY.members),
	move: z.literal(FOCUS_PERIOD_COPY.move),
	movedEarlier: z.literal(FOCUS_PERIOD_COPY.movedEarlier),
	movedLater: z.literal(FOCUS_PERIOD_COPY.movedLater),
	nextPeriod: z.literal(FOCUS_PERIOD_COPY.nextPeriod),
	openSourceRecord: z.literal(FOCUS_PERIOD_COPY.openSourceRecord),
	periodEvaluation: z.literal(FOCUS_PERIOD_COPY.periodEvaluation),
	planned: z.literal(FOCUS_PERIOD_COPY.planned),
	preview: z.literal(FOCUS_PERIOD_COPY.preview),
	purpose: z.literal(FOCUS_PERIOD_COPY.purpose),
	purposeRequired: z.literal(FOCUS_PERIOD_COPY.purposeRequired),
	remove: z.literal(FOCUS_PERIOD_COPY.remove),
	removed: z.literal(FOCUS_PERIOD_COPY.removed),
	resolved: z.literal(FOCUS_PERIOD_COPY.resolved),
	send: z.literal(FOCUS_PERIOD_COPY.send),
	skip: z.literal(FOCUS_PERIOD_COPY.skip),
	startDate: z.literal(FOCUS_PERIOD_COPY.startDate),
	stillOpenWork: z.literal(FOCUS_PERIOD_COPY.stillOpenWork),
	tryNext: z.literal(FOCUS_PERIOD_COPY.tryNext),
	windowMustBeOneToEightWeeks: z.literal(
		FOCUS_PERIOD_COPY.windowMustBeOneToEightWeeks
	),
	work: z.literal(FOCUS_PERIOD_COPY.work),
});

export const focusPeriodViewSchema = z.object({
	closeScope: focusPeriodScopeSchema.nullable(),
	comparison: closeComparisonSchema.nullable(),
	copy: focusPeriodCopySchema,
	counterparts: z.object({
		dailyFocus: z.literal(false),
		milestone: z.literal(false),
		projectRelease: z.literal(false),
	}),
	dateComparison: dateComparisonSchema.nullable(),
	dependencies: focusPeriodDependenciesSchema,
	eligibleWork: z.array(eligibleWorkSchema),
	endDate: calendarDaySchema,
	evaluation: periodEvaluationSchema.nullable(),
	id: z.string().min(1),
	members: z.array(focusPeriodWorkSchema),
	optional: z.literal(true),
	planningWrites: z.object({
		stage: z.literal(false),
		status: z.literal(false),
	}),
	purpose: z.string().min(1),
	startDate: calendarDaySchema,
	startScope: focusPeriodScopeSchema.nullable(),
	status: z.enum(FOCUS_PERIOD_STATUSES),
	stillOpenWork: stillOpenWorkSchema,
});

export type FocusPeriodView = z.infer<typeof focusPeriodViewSchema>;

export function focusPeriodCatalog() {
	return {
		copy: FOCUS_PERIOD_COPY,
		counterparts: FOCUS_PERIOD_COUNTERPARTS,
		dependencies: {
			copy: {
				dependencies: FOCUS_PERIOD_COPY.dependencies,
				openSourceRecord: FOCUS_PERIOD_COPY.openSourceRecord,
			},
			optional: true as const,
			writable: false as const,
		},
		kind: "focus-period" as const,
		maxDays: FOCUS_PERIOD_MAX_DAYS,
		minDays: FOCUS_PERIOD_MIN_DAYS,
		optional: true as const,
		planningWrites: FOCUS_PERIOD_PLANNING_WRITES,
	};
}
