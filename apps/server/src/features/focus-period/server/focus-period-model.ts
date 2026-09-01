import { z } from "zod";

export const FOCUS_PERIOD_COPY = {
	active: "Active",
	add: "Add",
	cancel: "Cancel",
	canceled: "Canceled",
	close: "Close",
	closed: "Closed",
	create: "Create Focus Period",
	empty: "No Focus Period yet.",
	endDate: "End date",
	focusPeriod: "Focus Period",
	loading: "Loading…",
	members: "Work",
	planned: "Planned",
	purpose: "Purpose",
	purposeRequired: "Purpose is required.",
	remove: "Remove",
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
		cancel: z.literal(FOCUS_PERIOD_COPY.cancel),
		canceled: z.literal(FOCUS_PERIOD_COPY.canceled),
		close: z.literal(FOCUS_PERIOD_COPY.close),
		closed: z.literal(FOCUS_PERIOD_COPY.closed),
		create: z.literal(FOCUS_PERIOD_COPY.create),
		empty: z.literal(FOCUS_PERIOD_COPY.empty),
		endDate: z.literal(FOCUS_PERIOD_COPY.endDate),
		focusPeriod: z.literal(FOCUS_PERIOD_COPY.focusPeriod),
		loading: z.literal(FOCUS_PERIOD_COPY.loading),
		members: z.literal(FOCUS_PERIOD_COPY.members),
		planned: z.literal(FOCUS_PERIOD_COPY.planned),
		purpose: z.literal(FOCUS_PERIOD_COPY.purpose),
		purposeRequired: z.literal(FOCUS_PERIOD_COPY.purposeRequired),
		remove: z.literal(FOCUS_PERIOD_COPY.remove),
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
	eligibleWork: z.array(focusPeriodWorkSchema),
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
		kind: "focus-period" as const,
		maxDays: FOCUS_PERIOD_MAX_DAYS,
		minDays: FOCUS_PERIOD_MIN_DAYS,
		optional: true as const,
		planningWrites: FOCUS_PERIOD_PLANNING_WRITES,
	};
}
