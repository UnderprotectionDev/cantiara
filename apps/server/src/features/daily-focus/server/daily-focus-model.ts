import { z } from "zod";

export const DAILY_FOCUS_COPY = {
	accept: "Accept",
	add: "Add",
	candidates: "Candidates",
	candidatesEmpty: "No Candidates for this day.",
	candidatesRule:
		"Work appears here when Target date is this day through the next 7 days, or Reappear date is on or before this day.",
	dailyFocus: "Daily Focus",
	empty: "No Work in Daily Focus for this day.",
	loading: "Loading…",
	reappearDateArrived: "Reappear date has arrived",
	reject: "Reject",
	remove: "Remove",
	selectedDay: "Selected day",
	targetDateNear: "Target date is near",
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

export const dailyFocusViewSchema = z.object({
	calendarDay: calendarDaySchema,
	candidateCounterparts: z.object({
		backlogMembership: z.literal(false),
		calendarEvent: z.literal(false),
		focusPeriod: z.literal(false),
	}),
	candidates: z.array(dailyFocusCandidateSchema),
	copy: z.object({
		accept: z.literal(DAILY_FOCUS_COPY.accept),
		add: z.literal(DAILY_FOCUS_COPY.add),
		candidates: z.literal(DAILY_FOCUS_COPY.candidates),
		candidatesEmpty: z.literal(DAILY_FOCUS_COPY.candidatesEmpty),
		candidatesRule: z.literal(DAILY_FOCUS_COPY.candidatesRule),
		dailyFocus: z.literal(DAILY_FOCUS_COPY.dailyFocus),
		empty: z.literal(DAILY_FOCUS_COPY.empty),
		loading: z.literal(DAILY_FOCUS_COPY.loading),
		reappearDateArrived: z.literal(DAILY_FOCUS_COPY.reappearDateArrived),
		reject: z.literal(DAILY_FOCUS_COPY.reject),
		remove: z.literal(DAILY_FOCUS_COPY.remove),
		selectedDay: z.literal(DAILY_FOCUS_COPY.selectedDay),
		targetDateNear: z.literal(DAILY_FOCUS_COPY.targetDateNear),
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
		candidateCounterparts: CANDIDATE_COUNTERPARTS,
		copy: DAILY_FOCUS_COPY,
		kind: "daily-focus" as const,
		planningWrites: DAILY_FOCUS_PLANNING_WRITES,
		shared: false,
	};
}
