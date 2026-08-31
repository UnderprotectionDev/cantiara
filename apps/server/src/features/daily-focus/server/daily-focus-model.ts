import { z } from "zod";

export const DAILY_FOCUS_COPY = {
	add: "Add",
	dailyFocus: "Daily Focus",
	empty: "No Work in Daily Focus for this day.",
	loading: "Loading…",
	openSourceRecord: "Open source record",
	remove: "Remove",
	selectedDay: "Selected day",
	whatHappenedToday: "What happened today?",
	work: "Work",
} as const;

export const DAILY_FOCUS_PLANNING_WRITES = {
	backlogOrder: false,
	priority: false,
	stage: false,
	status: false,
} as const;

export const WHAT_HAPPENED_TODAY_CONTRACT = {
	createsDocument: false,
	editable: false,
	rewritesSourceTimestamps: false,
} as const;

export const WHAT_HAPPENED_TODAY_KIND_COPY = {
	"decision-recorded": "Decision",
	"milestone-reached": "Milestone",
	"production-incident-resolved": "Production Incident",
	"project-release-published": "Project Release",
	"work-abandoned": "Abandoned",
	"work-completed": "Completed",
	"work-reopened": "Reopened",
} as const;

export const WHAT_HAPPENED_TODAY_KINDS = [
	"work-completed",
	"work-abandoned",
	"work-reopened",
	"decision-recorded",
	"milestone-reached",
	"project-release-published",
	"production-incident-resolved",
] as const;

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

const dailyFocusCopySchema = z.object({
	add: z.literal(DAILY_FOCUS_COPY.add),
	dailyFocus: z.literal(DAILY_FOCUS_COPY.dailyFocus),
	empty: z.literal(DAILY_FOCUS_COPY.empty),
	loading: z.literal(DAILY_FOCUS_COPY.loading),
	openSourceRecord: z.literal(DAILY_FOCUS_COPY.openSourceRecord),
	remove: z.literal(DAILY_FOCUS_COPY.remove),
	selectedDay: z.literal(DAILY_FOCUS_COPY.selectedDay),
	whatHappenedToday: z.literal(DAILY_FOCUS_COPY.whatHappenedToday),
	work: z.literal(DAILY_FOCUS_COPY.work),
});

export const whatHappenedTodayKindSchema = z.enum(WHAT_HAPPENED_TODAY_KINDS);

export const whatHappenedTodayRowSchema = z.object({
	id: z.string().min(1),
	kind: whatHappenedTodayKindSchema,
	kindLabel: z.enum([
		WHAT_HAPPENED_TODAY_KIND_COPY["decision-recorded"],
		WHAT_HAPPENED_TODAY_KIND_COPY["milestone-reached"],
		WHAT_HAPPENED_TODAY_KIND_COPY["production-incident-resolved"],
		WHAT_HAPPENED_TODAY_KIND_COPY["project-release-published"],
		WHAT_HAPPENED_TODAY_KIND_COPY["work-abandoned"],
		WHAT_HAPPENED_TODAY_KIND_COPY["work-completed"],
		WHAT_HAPPENED_TODAY_KIND_COPY["work-reopened"],
	]),
	occurredAt: z.string().datetime(),
	occurredAtDisplay: z.string().min(1),
	openSourceRecord: z.literal(DAILY_FOCUS_COPY.openSourceRecord),
	projectId: z.string().min(1),
	projectName: z.string().min(1),
	sourceHref: z.string().min(1),
	sourceId: z.string().min(1),
	sourceKey: z.string().min(1),
	sourceKind: z.literal("work"),
	sourceTitle: z.string().min(1),
});

export type WhatHappenedTodayRow = z.infer<typeof whatHappenedTodayRowSchema>;

export const whatHappenedTodaySchema = z.object({
	createsDocument: z.literal(false),
	editable: z.literal(false),
	rewritesSourceTimestamps: z.literal(false),
	rows: z.array(whatHappenedTodayRowSchema),
});

export type WhatHappenedToday = z.infer<typeof whatHappenedTodaySchema>;

export const dailyFocusViewSchema = z.object({
	calendarDay: calendarDaySchema,
	copy: dailyFocusCopySchema,
	eligibleWork: z.array(dailyFocusWorkSchema),
	members: z.array(dailyFocusWorkSchema),
	planningWrites: z.object({
		backlogOrder: z.literal(false),
		priority: z.literal(false),
		stage: z.literal(false),
		status: z.literal(false),
	}),
	whatHappenedToday: whatHappenedTodaySchema,
});

export type DailyFocusView = z.infer<typeof dailyFocusViewSchema>;

export function workSourceHref(projectId: string, workId: string): string {
	return `/projects/${projectId}?work=${encodeURIComponent(workId)}#work`;
}

export function nextCalendarDay(day: string): string {
	const [year, month, date] = day.split("-").map(Number);
	const utc = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) + 1));
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

export function dailyFocusCatalog() {
	return {
		copy: DAILY_FOCUS_COPY,
		kind: "daily-focus" as const,
		planningWrites: DAILY_FOCUS_PLANNING_WRITES,
		shared: false,
		whatHappenedToday: {
			...WHAT_HAPPENED_TODAY_CONTRACT,
			kinds: WHAT_HAPPENED_TODAY_KINDS,
		},
	};
}
