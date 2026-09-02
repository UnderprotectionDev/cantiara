import { z } from "zod";

export const FOCUS_PERIOD_COPY = {
	active: "Active",
	add: "Add",
	alreadyInAnActivePeriod:
		"Work is already in an active Focus Period. Use Move.",
	blockedBy: "Blocked by",
	blocks: "Blocks",
	cancel: "Cancel",
	canceled: "Canceled",
	close: "Close",
	closed: "Closed",
	create: "Create Focus Period",
	cycle: "These records wait on each other.",
	dependencies: "Dependencies",
	empty: "No Focus Period yet.",
	endDate: "End date",
	focusPeriod: "Focus Period",
	loading: "Loading…",
	members: "Work",
	move: "Move",
	openSourceRecord: "Open source record",
	planned: "Planned",
	purpose: "Purpose",
	purposeRequired: "Purpose is required.",
	remove: "Remove",
	resolved: "Resolved",
	startDate: "Start date",
	stillOpenWork: "Still-open Work",
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

export const stillOpenWorkSchema = z.object({
	autoRollover: z.literal(false),
	opened: z.boolean(),
	stillOpen: z.array(focusPeriodWorkSchema),
});

export const focusPeriodViewSchema = z.object({
	closeScope: focusPeriodScopeSchema.nullable(),
	copy: z.object({
		active: z.literal(FOCUS_PERIOD_COPY.active),
		add: z.literal(FOCUS_PERIOD_COPY.add),
		alreadyInAnActivePeriod: z.literal(
			FOCUS_PERIOD_COPY.alreadyInAnActivePeriod
		),
		blockedBy: z.literal(FOCUS_PERIOD_COPY.blockedBy),
		blocks: z.literal(FOCUS_PERIOD_COPY.blocks),
		cancel: z.literal(FOCUS_PERIOD_COPY.cancel),
		canceled: z.literal(FOCUS_PERIOD_COPY.canceled),
		close: z.literal(FOCUS_PERIOD_COPY.close),
		closed: z.literal(FOCUS_PERIOD_COPY.closed),
		create: z.literal(FOCUS_PERIOD_COPY.create),
		cycle: z.literal(FOCUS_PERIOD_COPY.cycle),
		dependencies: z.literal(FOCUS_PERIOD_COPY.dependencies),
		empty: z.literal(FOCUS_PERIOD_COPY.empty),
		endDate: z.literal(FOCUS_PERIOD_COPY.endDate),
		focusPeriod: z.literal(FOCUS_PERIOD_COPY.focusPeriod),
		loading: z.literal(FOCUS_PERIOD_COPY.loading),
		members: z.literal(FOCUS_PERIOD_COPY.members),
		move: z.literal(FOCUS_PERIOD_COPY.move),
		openSourceRecord: z.literal(FOCUS_PERIOD_COPY.openSourceRecord),
		planned: z.literal(FOCUS_PERIOD_COPY.planned),
		purpose: z.literal(FOCUS_PERIOD_COPY.purpose),
		purposeRequired: z.literal(FOCUS_PERIOD_COPY.purposeRequired),
		remove: z.literal(FOCUS_PERIOD_COPY.remove),
		resolved: z.literal(FOCUS_PERIOD_COPY.resolved),
		startDate: z.literal(FOCUS_PERIOD_COPY.startDate),
		stillOpenWork: z.literal(FOCUS_PERIOD_COPY.stillOpenWork),
		windowMustBeOneToEightWeeks: z.literal(
			FOCUS_PERIOD_COPY.windowMustBeOneToEightWeeks
		),
		work: z.literal(FOCUS_PERIOD_COPY.work),
	}),
	counterparts: z.object({
		dailyFocus: z.literal(false),
		milestone: z.literal(false),
		projectRelease: z.literal(false),
	}),
	dependencies: focusPeriodDependenciesSchema,
	eligibleWork: z.array(eligibleWorkSchema),
	endDate: calendarDaySchema,
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
