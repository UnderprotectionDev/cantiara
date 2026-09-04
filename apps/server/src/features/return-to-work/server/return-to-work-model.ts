import { z } from "zod";

export const RETURN_TO_WORK_COPY = {
	decisionGroup: "Decision",
	documentGroup: "Document",
	empty: "No Return to Work cards from current records.",
	githubGroup: "GitHub",
	lastUpdated: "Last updated",
	longInTheSameStatus: "Long in the same status",
	nextConcreteStep: "Next concrete step",
	openRisk: "Open Risk",
	openSourceRecord: "Open source record",
	pendingGitHubDevelopmentSignal: "Pending GitHub development signal",
	publishGroup: "Publish",
	recentlyEdited: "Recently edited",
	recentlyViewed: "Recently viewed",
	returnToWork: "Return to Work",
	riskGroup: "Risk",
	save: "Save",
	sinceYouLastLooked: "Since you last looked",
	upcomingDate: "Upcoming date",
	workGroup: "Work",
} as const;

export const CARD_REASON = {
	longInTheSameStatus: RETURN_TO_WORK_COPY.longInTheSameStatus,
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
	CARD_REASON.longInTheSameStatus,
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

export const LONG_IN_THE_SAME_STATUS_CONTRACT = {
	defaultAttentionSignal: false,
	healthScore: false,
	performanceScore: false,
	stuckVerdict: false,
	writesClosureResult: false,
	writesPlanningMembership: false,
	writesStatus: false,
} as const;

export const SINCE_YOU_LAST_LOOKED_GROUP_IDS = [
	"work",
	"decision",
	"risk",
	"document",
	"github",
	"publish",
] as const;

export type SinceYouLastLookedGroupId =
	(typeof SINCE_YOU_LAST_LOOKED_GROUP_IDS)[number];

export const SINCE_YOU_LAST_LOOKED_GROUP_LABEL = {
	decision: RETURN_TO_WORK_COPY.decisionGroup,
	document: RETURN_TO_WORK_COPY.documentGroup,
	github: RETURN_TO_WORK_COPY.githubGroup,
	publish: RETURN_TO_WORK_COPY.publishGroup,
	risk: RETURN_TO_WORK_COPY.riskGroup,
	work: RETURN_TO_WORK_COPY.workGroup,
} as const;

export const SINCE_YOU_LAST_LOOKED_CONTRACT = {
	analytics: { duration: false, visitStream: false },
	audit: { writesDenetimKaydi: false },
	externalSurface: { publishesLastVisitMark: false },
	groups: SINCE_YOU_LAST_LOOKED_GROUP_IDS,
	importanceRank: false,
	storedSummaryRecord: false,
} as const;

export const CARD_LIMIT = 8;
export const UPCOMING_CARD_LIMIT = 3;
export const LONG_STATUS_CARD_LIMIT = 3;
export const PREPARED_LONG_STATUS_COLLECTION_PREFIX =
	"prepared:long-in-the-same-status:" as const;

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
	longInTheSameStatus?: boolean;
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

export function decisionSourceHref(projectId: string): string {
	return `/projects/${projectId}#decisions`;
}

export function documentSourceHref(projectId: string): string {
	return `/projects/${projectId}#documents`;
}

export function returnToWorkCatalog() {
	return {
		copy: RETURN_TO_WORK_COPY,
		kind: "return-to-work" as const,
		longInTheSameStatus: LONG_IN_THE_SAME_STATUS_CONTRACT,
		nextConcreteStep: NEXT_CONCRETE_STEP_CONTRACT,
		restores: RETURN_TO_WORK_RESTORES,
		session: RETURN_TO_WORK_SESSION,
		sinceYouLastLooked: SINCE_YOU_LAST_LOOKED_CONTRACT,
		snapshot: RETURN_TO_WORK_SNAPSHOT,
	};
}

export interface SinceYouLastLookedEvent {
	group: SinceYouLastLookedGroupId;
	href: string;
	id: string;
	occurredAt: string;
	sourceKey: string;
	sourceTitle: string;
}

export interface SinceYouLastLookedRow {
	href: string;
	id: string;
	occurredAt: string;
	occurredAtDisplay: string;
	openSourceRecord: typeof RETURN_TO_WORK_COPY.openSourceRecord;
	sourceKey: string;
	sourceTitle: string;
}

export interface SinceYouLastLookedGroup {
	id: SinceYouLastLookedGroupId;
	items: SinceYouLastLookedRow[];
	label: (typeof SINCE_YOU_LAST_LOOKED_GROUP_LABEL)[SinceYouLastLookedGroupId];
}

export function emptySinceYouLastLookedGroups(): SinceYouLastLookedGroup[] {
	return SINCE_YOU_LAST_LOOKED_GROUP_IDS.map((id) => ({
		id,
		items: [],
		label: SINCE_YOU_LAST_LOOKED_GROUP_LABEL[id],
	}));
}

export function groupSinceYouLastLookedEvents(
	events: readonly SinceYouLastLookedEvent[],
	input: {
		formatOccurredAt: (occurredAt: string) => string;
		sinceAt: string | null;
	}
): SinceYouLastLookedGroup[] {
	const groups = emptySinceYouLastLookedGroups();
	const { formatOccurredAt, sinceAt } = input;
	if (!sinceAt) {
		return groups;
	}
	const byId = new Map(groups.map((group) => [group.id, group]));
	const sorted = [...events]
		.filter((event) => event.occurredAt > sinceAt)
		.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
	for (const event of sorted) {
		const group = byId.get(event.group);
		if (!group) {
			continue;
		}
		group.items.push({
			href: event.href,
			id: event.id,
			occurredAt: event.occurredAt,
			occurredAtDisplay: formatOccurredAt(event.occurredAt),
			openSourceRecord: RETURN_TO_WORK_COPY.openSourceRecord,
			sourceKey: event.sourceKey,
			sourceTitle: event.sourceTitle,
		});
	}
	return groups;
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
	if (record.longInTheSameStatus) {
		return CARD_REASON.longInTheSameStatus;
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
	const longStatus = all
		.filter((record) => record.longInTheSameStatus)
		.sort((left, right) => newestIso(left.editedAt, right.editedAt));
	const viewed = others
		.filter((record) => record.viewedAt)
		.sort((left, right) => newestIso(left.viewedAt, right.viewedAt));
	const edited = others
		.filter((record) => record.editedAt)
		.sort((left, right) => newestIso(left.editedAt, right.editedAt));

	take(CARD_REASON.pendingGitHubDevelopmentSignal, github, 3);
	take(CARD_REASON.openRisk, risks, 3);
	take(CARD_REASON.upcomingDate, upcoming, UPCOMING_CARD_LIMIT);
	take(CARD_REASON.longInTheSameStatus, longStatus, LONG_STATUS_CARD_LIMIT);
	take(CARD_REASON.recentlyViewed, viewed, 1);
	take(CARD_REASON.recentlyEdited, edited, 1);

	return [...chosen.values()];
}

export function positiveThresholdDays(value: number | null): number | null {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
		return null;
	}
	return value;
}

export function calendarDayDifference(fromDay: string, toDay: string): number {
	const from = Date.parse(`${fromDay}T00:00:00.000Z`);
	const to = Date.parse(`${toDay}T00:00:00.000Z`);
	if (Number.isNaN(from) || Number.isNaN(to)) {
		return 0;
	}
	return Math.round((to - from) / 86_400_000);
}

export function exceedsStatusAgeThreshold(input: {
	statusEnteredOn: string | null;
	thresholdDays: number | null;
	today: string;
}): boolean {
	if (input.thresholdDays === null || input.statusEnteredOn === null) {
		return false;
	}
	return (
		calendarDayDifference(input.statusEnteredOn, input.today) >=
		input.thresholdDays
	);
}

export function preparedLongInTheSameStatusCollectionId(
	projectId: string
): string {
	return `${PREPARED_LONG_STATUS_COLLECTION_PREFIX}${projectId}`;
}

export function parsePreparedLongInTheSameStatusProjectId(
	collectionId: string
): string | null {
	if (!collectionId.startsWith(PREPARED_LONG_STATUS_COLLECTION_PREFIX)) {
		return null;
	}
	const projectId = collectionId.slice(
		PREPARED_LONG_STATUS_COLLECTION_PREFIX.length
	);
	return projectId.length > 0 ? projectId : null;
}

export function preparedLongInTheSameStatusMembership(
	records: readonly ReturnSourceRecord[]
): Array<{
	because: typeof CARD_REASON.longInTheSameStatus;
	id: string;
	title: string;
}> {
	return records
		.filter((record) => record.kind === "work" && record.longInTheSameStatus)
		.map((record) => ({
			because: CARD_REASON.longInTheSameStatus,
			id: record.id,
			title: record.title,
		}));
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
		longInTheSameStatus: z.literal(RETURN_TO_WORK_COPY.longInTheSameStatus),
		nextConcreteStep: z.literal(RETURN_TO_WORK_COPY.nextConcreteStep),
		openSourceRecord: z.literal(RETURN_TO_WORK_COPY.openSourceRecord),
		returnToWork: z.literal(RETURN_TO_WORK_COPY.returnToWork),
		save: z.literal(RETURN_TO_WORK_COPY.save),
		sinceYouLastLooked: z.literal(RETURN_TO_WORK_COPY.sinceYouLastLooked),
	}),
	lastVisitAt: z.string().datetime().nullable(),
	longInTheSameStatus: z.object({
		defaultAttentionSignal: z.literal(false),
		healthScore: z.literal(false),
		performanceScore: z.literal(false),
		stuckVerdict: z.literal(false),
		writesClosureResult: z.literal(false),
		writesPlanningMembership: z.literal(false),
		writesStatus: z.literal(false),
	}),
	nextConcreteStep: nextConcreteStepViewSchema,
	nextConcreteStepHistory: z.array(nextConcreteStepHistoryItemSchema),
	preparedSmartCollection: z
		.object({
			members: z.array(
				z.object({
					because: z.literal(CARD_REASON.longInTheSameStatus),
					id: z.string().min(1),
					title: z.string().min(1),
				})
			),
			name: z.literal(RETURN_TO_WORK_COPY.longInTheSameStatus),
		})
		.nullable(),
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
	sinceYouLastLooked: z.object({
		analytics: z.object({
			duration: z.literal(false),
			visitStream: z.literal(false),
		}),
		audit: z.object({
			writesDenetimKaydi: z.literal(false),
		}),
		externalSurface: z.object({
			publishesLastVisitMark: z.literal(false),
		}),
		groups: z.array(
			z.object({
				id: z.enum(SINCE_YOU_LAST_LOOKED_GROUP_IDS),
				items: z.array(
					z.object({
						href: z.string().min(1),
						id: z.string().min(1),
						occurredAt: z.string().datetime(),
						occurredAtDisplay: z.string().min(1),
						openSourceRecord: z.literal(RETURN_TO_WORK_COPY.openSourceRecord),
						sourceKey: z.string().min(1),
						sourceTitle: z.string().min(1),
					})
				),
				label: z.string().min(1),
			})
		),
		importanceRank: z.literal(false),
		storedSummaryRecord: z.literal(false),
		title: z.literal(RETURN_TO_WORK_COPY.sinceYouLastLooked),
	}),
	snapshot: z.object({
		storedCardSnapshot: z.literal(false),
	}),
	statusAgeThresholdDays: z.number().int().positive().nullable(),
});

export type ReturnToWorkSummary = z.infer<typeof returnToWorkSummarySchema>;
