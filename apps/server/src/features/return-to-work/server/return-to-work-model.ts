import { z } from "zod";

export const RETURN_TO_WORK_COPY = {
	empty: "No Return to Work cards from current records.",
	lastUpdated: "Last updated",
	nextConcreteStep: "Next concrete step",
	openRisk: "Open Risk",
	openSourceRecord: "Open source record",
	pendingGitHubDevelopmentSignal: "Pending GitHub development signal",
	recentlyEdited: "Recently edited",
	recentlyViewed: "Recently viewed",
	returnToWork: "Return to Work",
	save: "Save",
	upcomingDate: "Upcoming date",
} as const;

export const CARD_REASON = {
	openRisk: RETURN_TO_WORK_COPY.openRisk,
	pendingGitHubDevelopmentSignal:
		RETURN_TO_WORK_COPY.pendingGitHubDevelopmentSignal,
	recentlyEdited: RETURN_TO_WORK_COPY.recentlyEdited,
	recentlyViewed: RETURN_TO_WORK_COPY.recentlyViewed,
	upcomingDate: RETURN_TO_WORK_COPY.upcomingDate,
} as const;

export const CARD_REASONS = [
	CARD_REASON.pendingGitHubDevelopmentSignal,
	CARD_REASON.openRisk,
	CARD_REASON.upcomingDate,
	CARD_REASON.recentlyViewed,
	CARD_REASON.recentlyEdited,
] as const;

export type CardReason = (typeof CARD_REASONS)[number];

export const RETURN_TO_WORK_SESSION = {
	directed: false,
	mandatoryAgenda: false,
	writesStatus: false,
} as const;

export const RETURN_TO_WORK_RESTORES = {
	filter: false,
	scroll: false,
	sidePanel: false,
	sort: false,
	tab: false,
} as const;

export const NEXT_CONCRETE_STEP_CONTRACT = {
	autoWriteFrom: {
		date: false,
		planningMembership: false,
		priority: false,
		stage: false,
		status: false,
	},
	checklist: false,
	dailyFocus: false,
	guessesFromEvents: false,
	recordType: false,
	reminder: false,
	secondList: false,
} as const;

export const RETURN_TO_WORK_SNAPSHOT = {
	storedCardSnapshot: false,
} as const;

export const CARD_LIMIT = 8;
export const UPCOMING_CARD_LIMIT = 3;

const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const calendarDaySchema = z.string().regex(CALENDAR_DAY_PATTERN);

export const returnSourceKindSchema = z.enum([
	"github-development-signal",
	"project",
	"risk",
	"work",
]);

export type ReturnSourceKind = z.infer<typeof returnSourceKindSchema>;

export interface ReturnSourceRecord {
	editedAt: string | null;
	href: string;
	id: string;
	key: string;
	kind: ReturnSourceKind;
	openRisk: boolean;
	pendingGitHubDevelopmentSignal: boolean;
	title: string;
	upcomingDate: string | null;
	viewedAt: string | null;
}

export interface ReturnCard {
	href: string;
	id: string;
	key: string;
	kind: ReturnSourceKind;
	openSourceRecord: typeof RETURN_TO_WORK_COPY.openSourceRecord;
	title: string;
	whyShown: CardReason;
}

export function workSourceHref(projectId: string, workId: string): string {
	return `/projects/${projectId}?work=${encodeURIComponent(workId)}#work`;
}

export function projectSourceHref(projectId: string): string {
	return `/projects/${projectId}`;
}

export function returnToWorkCatalog() {
	return {
		copy: RETURN_TO_WORK_COPY,
		kind: "return-to-work" as const,
		nextConcreteStep: NEXT_CONCRETE_STEP_CONTRACT,
		restores: RETURN_TO_WORK_RESTORES,
		session: RETURN_TO_WORK_SESSION,
		snapshot: RETURN_TO_WORK_SNAPSHOT,
	};
}

function isUpcoming(date: string | null, today: string): date is string {
	return Boolean(date && CALENDAR_DAY_PATTERN.test(date) && date >= today);
}

function primaryReason(
	record: ReturnSourceRecord,
	today: string
): CardReason | null {
	if (record.pendingGitHubDevelopmentSignal) {
		return CARD_REASON.pendingGitHubDevelopmentSignal;
	}
	if (record.openRisk) {
		return CARD_REASON.openRisk;
	}
	if (isUpcoming(record.upcomingDate, today)) {
		return CARD_REASON.upcomingDate;
	}
	if (record.viewedAt) {
		return CARD_REASON.recentlyViewed;
	}
	if (record.editedAt) {
		return CARD_REASON.recentlyEdited;
	}
	return null;
}

function toCard(record: ReturnSourceRecord, whyShown: CardReason): ReturnCard {
	return {
		href: record.href,
		id: record.id,
		key: record.key,
		kind: record.kind,
		openSourceRecord: RETURN_TO_WORK_COPY.openSourceRecord,
		title: record.title,
		whyShown,
	};
}

function newestIso(left: string | null, right: string | null): number {
	return (right ?? "").localeCompare(left ?? "");
}

export function selectReturnCards(
	records: readonly ReturnSourceRecord[],
	input: { contextId: string; today: string }
): ReturnCard[] {
	const today = calendarDaySchema.parse(input.today);
	const others = records.filter((record) => record.id !== input.contextId);
	const all = [...records];
	const chosen = new Map<string, ReturnCard>();

	function take(reason: CardReason, pool: ReturnSourceRecord[], limit: number) {
		let remaining = limit;
		for (const record of pool) {
			if (chosen.size >= CARD_LIMIT || remaining <= 0) {
				return;
			}
			if (chosen.has(record.id)) {
				continue;
			}
			if (primaryReason(record, today) !== reason) {
				continue;
			}
			chosen.set(record.id, toCard(record, reason));
			remaining -= 1;
		}
	}

	const github = all
		.filter((record) => record.pendingGitHubDevelopmentSignal)
		.sort((left, right) => newestIso(left.editedAt, right.editedAt));
	const risks = all
		.filter((record) => record.openRisk)
		.sort((left, right) => newestIso(left.editedAt, right.editedAt));
	const upcoming = all
		.filter((record) => isUpcoming(record.upcomingDate, today))
		.sort((left, right) =>
			(left.upcomingDate ?? "").localeCompare(right.upcomingDate ?? "")
		);
	const viewed = others
		.filter((record) => record.viewedAt)
		.sort((left, right) => newestIso(left.viewedAt, right.viewedAt));
	const edited = others
		.filter((record) => record.editedAt)
		.sort((left, right) => newestIso(left.editedAt, right.editedAt));

	take(CARD_REASON.pendingGitHubDevelopmentSignal, github, 3);
	take(CARD_REASON.openRisk, risks, 3);
	take(CARD_REASON.upcomingDate, upcoming, UPCOMING_CARD_LIMIT);
	take(CARD_REASON.recentlyViewed, viewed, 1);
	take(CARD_REASON.recentlyEdited, edited, 1);

	return [...chosen.values()];
}

export const nextConcreteStepViewSchema = z
	.object({
		openSourceRecord: z.literal(RETURN_TO_WORK_COPY.openSourceRecord),
		sourceHref: z.string().min(1),
		sourceKey: z.string().min(1),
		sourceTitle: z.string().min(1),
		text: z.string().min(1),
		updatedAt: z.string().datetime(),
		updatedAtDisplay: z.string().min(1),
	})
	.nullable();

export const nextConcreteStepHistoryItemSchema = z.object({
	replacedAt: z.string().datetime(),
	text: z.string(),
});

export const returnCardSchema = z.object({
	href: z.string().min(1),
	id: z.string().min(1),
	key: z.string().min(1),
	kind: returnSourceKindSchema,
	openSourceRecord: z.literal(RETURN_TO_WORK_COPY.openSourceRecord),
	title: z.string().min(1),
	whyShown: z.enum(CARD_REASONS),
});

export const returnToWorkSummarySchema = z.object({
	cards: z.array(returnCardSchema),
	context: z.object({
		id: z.string().min(1),
		kind: z.enum(["project", "work"]),
		title: z.string().min(1),
	}),
	copy: z.object({
		empty: z.literal(RETURN_TO_WORK_COPY.empty),
		lastUpdated: z.literal(RETURN_TO_WORK_COPY.lastUpdated),
		nextConcreteStep: z.literal(RETURN_TO_WORK_COPY.nextConcreteStep),
		openSourceRecord: z.literal(RETURN_TO_WORK_COPY.openSourceRecord),
		returnToWork: z.literal(RETURN_TO_WORK_COPY.returnToWork),
		save: z.literal(RETURN_TO_WORK_COPY.save),
	}),
	nextConcreteStep: nextConcreteStepViewSchema,
	nextConcreteStepHistory: z.array(nextConcreteStepHistoryItemSchema),
	restores: z.object({
		filter: z.literal(false),
		scroll: z.literal(false),
		sidePanel: z.literal(false),
		sort: z.literal(false),
		tab: z.literal(false),
	}),
	session: z.object({
		directed: z.literal(false),
		mandatoryAgenda: z.literal(false),
		writesStatus: z.literal(false),
	}),
	snapshot: z.object({
		storedCardSnapshot: z.literal(false),
	}),
});

export type ReturnToWorkSummary = z.infer<typeof returnToWorkSummarySchema>;
