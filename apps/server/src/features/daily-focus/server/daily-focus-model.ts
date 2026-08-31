import { z } from "zod";

import {
	CLOSURE_RESULT,
	WORK_STATUS,
} from "../../work-lifecycle/server/work-lifecycle-model";

export const DAILY_FOCUS_COPY = {
	abandoned: "Abandoned",
	accept: "Accept",
	add: "Add",
	candidates: "Candidates",
	candidatesEmpty: "No Candidates for this day.",
	candidatesRule:
		"Work appears here when Target date is this day through the next 7 days, or Reappear date is on or before this day.",
	closeFocus: "Close focus",
	completed: "Completed",
	dailyFocus: "Daily Focus",
	deferred: "Deferred",
	empty: "No Work in Daily Focus for this day.",
	loading: "Loading…",
	openSourceRecord: "Open source record",
	reappearDateArrived: "Reappear date has arrived",
	reject: "Reject",
	remove: "Remove",
	selectedDay: "Selected day",
	stillOpen: "Still open",
	targetDateNear: "Target date is near",
	whatHappenedToday: "What happened today?",
	work: "Work",
} as const;

export const CANDIDATE_LIMIT = 5;
export const TARGET_DATE_NEAR_DAYS = 7;

export const CANDIDATE_COUNTERPARTS = {
	backlogMembership: false,
	calendarEvent: false,
	focusPeriod: false,
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

export const CANDIDATE_REASON = {
	reappearDate: DAILY_FOCUS_COPY.reappearDateArrived,
	targetDate: DAILY_FOCUS_COPY.targetDateNear,
} as const;

export const dailyFocusCandidateSchema = dailyFocusWorkSchema.extend({
	reason: z.union([
		z.literal(CANDIDATE_REASON.reappearDate),
		z.literal(CANDIDATE_REASON.targetDate),
	]),
});

export type DailyFocusCandidate = z.infer<typeof dailyFocusCandidateSchema>;

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
	candidateCounterparts: z.object({
		backlogMembership: z.literal(false),
		calendarEvent: z.literal(false),
		focusPeriod: z.literal(false),
	}),
	candidates: z.array(dailyFocusCandidateSchema),
	copy: z.object({
		abandoned: z.literal(DAILY_FOCUS_COPY.abandoned),
		accept: z.literal(DAILY_FOCUS_COPY.accept),
		add: z.literal(DAILY_FOCUS_COPY.add),
		candidates: z.literal(DAILY_FOCUS_COPY.candidates),
		candidatesEmpty: z.literal(DAILY_FOCUS_COPY.candidatesEmpty),
		candidatesRule: z.literal(DAILY_FOCUS_COPY.candidatesRule),
		closeFocus: z.literal(DAILY_FOCUS_COPY.closeFocus),
		completed: z.literal(DAILY_FOCUS_COPY.completed),
		dailyFocus: z.literal(DAILY_FOCUS_COPY.dailyFocus),
		deferred: z.literal(DAILY_FOCUS_COPY.deferred),
		empty: z.literal(DAILY_FOCUS_COPY.empty),
		loading: z.literal(DAILY_FOCUS_COPY.loading),
		openSourceRecord: z.literal(DAILY_FOCUS_COPY.openSourceRecord),
		reappearDateArrived: z.literal(DAILY_FOCUS_COPY.reappearDateArrived),
		reject: z.literal(DAILY_FOCUS_COPY.reject),
		remove: z.literal(DAILY_FOCUS_COPY.remove),
		selectedDay: z.literal(DAILY_FOCUS_COPY.selectedDay),
		stillOpen: z.literal(DAILY_FOCUS_COPY.stillOpen),
		targetDateNear: z.literal(DAILY_FOCUS_COPY.targetDateNear),
		whatHappenedToday: z.literal(DAILY_FOCUS_COPY.whatHappenedToday),
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
	whatHappenedToday: whatHappenedTodaySchema,
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
		candidateCounterparts: CANDIDATE_COUNTERPARTS,
		closeFocus: {
			optional: true,
			ritual: DAILY_FOCUS_CLOSE_RITUAL,
			writes: DAILY_FOCUS_CLOSE_WRITES,
		},
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
