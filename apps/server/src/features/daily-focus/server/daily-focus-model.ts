import { z } from "zod";

export const DAILY_FOCUS_COPY = {
	add: "Add",
	dailyFocus: "Daily Focus",
	empty: "No Work in Daily Focus for this day.",
	loading: "Loading…",
	remove: "Remove",
	selectedDay: "Selected day",
	work: "Work",
} as const;

export const DAILY_FOCUS_PLANNING_WRITES = {
	backlogOrder: false,
	priority: false,
	stage: false,
	status: false,
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
		add: z.literal(DAILY_FOCUS_COPY.add),
		dailyFocus: z.literal(DAILY_FOCUS_COPY.dailyFocus),
		empty: z.literal(DAILY_FOCUS_COPY.empty),
		loading: z.literal(DAILY_FOCUS_COPY.loading),
		remove: z.literal(DAILY_FOCUS_COPY.remove),
		selectedDay: z.literal(DAILY_FOCUS_COPY.selectedDay),
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

export function dailyFocusCatalog() {
	return {
		copy: DAILY_FOCUS_COPY,
		kind: "daily-focus" as const,
		planningWrites: DAILY_FOCUS_PLANNING_WRITES,
		shared: false,
	};
}
