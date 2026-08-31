import { z } from "zod";

import {
	CLOSURE_RESULT,
	WORK_STATUS,
} from "../../work-lifecycle/server/work-lifecycle-model";

export const DAILY_FOCUS_COPY = {
	abandoned: "Abandoned",
	add: "Add",
	closeFocus: "Close focus",
	completed: "Completed",
	dailyFocus: "Daily Focus",
	deferred: "Deferred",
	empty: "No Work in Daily Focus for this day.",
	loading: "Loading…",
	openSourceRecord: "Open source record",
	remove: "Remove",
	selectedDay: "Selected day",
	stillOpen: "Still open",
	work: "Work",
} as const;

export const DAILY_FOCUS_PLANNING_WRITES = {
	backlogOrder: false,
	priority: false,
	stage: false,
	status: false,
} as const;

export const DAILY_FOCUS_CLOSE_WRITES = {
	calendarDay: false,
	membership: false,
	status: false,
	summaryRecord: false,
} as const;

export const DAILY_FOCUS_CLOSE_RITUAL = {
	completionEffect: false,
	mandatory: false,
	score: false,
	streak: false,
	verdict: false,
	zeroWorkTarget: false,
} as const;

export const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const calendarDaySchema = z.string().regex(CALENDAR_DAY_PATTERN);

export const dailyFocusWorkSchema = z.object({
	id: z.string().min(1),
	key: z.string().min(1),
	projectId: z.string().min(1),
	projectName: z.string().min(1),
	title: z.string().min(1),
});

export type DailyFocusWork = z.infer<typeof dailyFocusWorkSchema>;

export const dailyFocusViewSchema = z.object({
	calendarDay: calendarDaySchema,
	copy: z.object({
		abandoned: z.literal(DAILY_FOCUS_COPY.abandoned),
		add: z.literal(DAILY_FOCUS_COPY.add),
		closeFocus: z.literal(DAILY_FOCUS_COPY.closeFocus),
		completed: z.literal(DAILY_FOCUS_COPY.completed),
		dailyFocus: z.literal(DAILY_FOCUS_COPY.dailyFocus),
		deferred: z.literal(DAILY_FOCUS_COPY.deferred),
		empty: z.literal(DAILY_FOCUS_COPY.empty),
		loading: z.literal(DAILY_FOCUS_COPY.loading),
		openSourceRecord: z.literal(DAILY_FOCUS_COPY.openSourceRecord),
		remove: z.literal(DAILY_FOCUS_COPY.remove),
		selectedDay: z.literal(DAILY_FOCUS_COPY.selectedDay),
		stillOpen: z.literal(DAILY_FOCUS_COPY.stillOpen),
		work: z.literal(DAILY_FOCUS_COPY.work),
	}),
	eligibleWork: z.array(dailyFocusWorkSchema),
	members: z.array(dailyFocusWorkSchema),
	planningWrites: z.object({
		backlogOrder: z.literal(false),
		priority: z.literal(false),
		stage: z.literal(false),
		status: z.literal(false),
	}),
});

export type DailyFocusView = z.infer<typeof dailyFocusViewSchema>;

export const dailyFocusCloseItemSchema = dailyFocusWorkSchema.extend({
	closureResult: z.string().nullable(),
	openSourceRecord: z.literal(true),
	reappearDate: z.string().nullable(),
	status: z.string().min(1),
});

export type DailyFocusCloseItem = z.infer<typeof dailyFocusCloseItemSchema>;

export const dailyFocusCloseViewSchema = z.object({
	calendarDay: calendarDaySchema,
	copy: dailyFocusViewSchema.shape.copy,
	groups: z.object({
		abandoned: z.array(dailyFocusCloseItemSchema),
		completed: z.array(dailyFocusCloseItemSchema),
		reappearDeferred: z.array(dailyFocusCloseItemSchema),
		stillOpen: z.array(dailyFocusCloseItemSchema),
	}),
	ritual: z.object({
		completionEffect: z.literal(false),
		mandatory: z.literal(false),
		score: z.literal(false),
		streak: z.literal(false),
		verdict: z.literal(false),
		zeroWorkTarget: z.literal(false),
	}),
	writes: z.object({
		calendarDay: z.literal(false),
		membership: z.literal(false),
		status: z.literal(false),
		summaryRecord: z.literal(false),
	}),
});

export type DailyFocusCloseView = z.infer<typeof dailyFocusCloseViewSchema>;

export function groupCloseFocusWork(
	members: readonly DailyFocusCloseItem[],
	calendarDay: string
): DailyFocusCloseView["groups"] {
	const abandoned: DailyFocusCloseItem[] = [];
	const completed: DailyFocusCloseItem[] = [];
	const reappearDeferred: DailyFocusCloseItem[] = [];
	const stillOpen: DailyFocusCloseItem[] = [];
	for (const member of members) {
		if (
			member.status === WORK_STATUS.closed &&
			member.closureResult === CLOSURE_RESULT.completed
		) {
			completed.push(member);
			continue;
		}
		if (
			member.status === WORK_STATUS.closed &&
			member.closureResult === CLOSURE_RESULT.abandoned
		) {
			abandoned.push(member);
			continue;
		}
		if (member.reappearDate !== null && member.reappearDate > calendarDay) {
			reappearDeferred.push(member);
			continue;
		}
		stillOpen.push(member);
	}
	return { abandoned, completed, reappearDeferred, stillOpen };
}

export function dailyFocusCatalog() {
	return {
		closeFocus: {
			optional: true,
			ritual: DAILY_FOCUS_CLOSE_RITUAL,
			writes: DAILY_FOCUS_CLOSE_WRITES,
		},
		copy: DAILY_FOCUS_COPY,
		kind: "daily-focus" as const,
		planningWrites: DAILY_FOCUS_PLANNING_WRITES,
		shared: false,
	};
}
