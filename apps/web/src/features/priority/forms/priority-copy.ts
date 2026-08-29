export const PRIORITY_RANKS = [
	"Very low",
	"Low",
	"Medium",
	"High",
	"Very high",
] as const;

export type PriorityRank = (typeof PRIORITY_RANKS)[number];

export const PRIORITY_COPY = {
	addPriorityMetric: "Add priority metric",
	archive: "Archive",
	backlog: "Backlog",
	close: "Close",
	createPrioritizationSession: "Create Prioritization Session",
	delete: "Delete",
	description: "Description",
	enable: "Enable",
	evidence: "Evidence",
	evidenceStrength: "Evidence strength",
	feedbackRecords: "Feedback records",
	high: "High",
	low: "Low",
	medium: "Medium",
	moveDown: "Move down",
	moveUp: "Move up",
	name: "Name",
	nameRequired: "Name is required.",
	priorityMetrics: "Priority metrics",
	rankExplanation: "Rank explanation",
	reopen: "Reopen",
	risk: "Risk",
	save: "Save",
	sessionClosed:
		"This Prioritization Session is closed. Reopen it or create a new session to reorder.",
	sessionOrder: "Session order",
	targetDate: "Target date",
	unevaluated: "Unevaluated",
	uniqueCompany: "Unique Company",
	uniqueContact: "Unique Contact",
	unknownRank: "This rank is not one of the five fixed levels.",
	veryHigh: "Very high",
	veryLow: "Very low",
} as const;

export const EMPTY_RANK_EXPLANATIONS = {
	High: "",
	Low: "",
	Medium: "",
	"Very high": "",
	"Very low": "",
} as const satisfies Record<PriorityRank, string>;

export type RankExplanations = Record<PriorityRank, string>;

export interface PriorityCriterionDefinitionView {
	description: string;
	enabled: boolean;
	id: string;
	name: string;
	preparedKind: "Evidence strength" | null;
	projectId: string;
	rankExplanations: RankExplanations;
	revision: number;
}

export interface PriorityCriterionValueView {
	criterionId: string;
	enabled: boolean;
	name: string;
	notEvaluated: boolean;
	rank: PriorityRank | null;
	rankExplanations: RankExplanations;
	revision: number;
	workId: string;
}

export interface PrioritizationSessionCardView {
	backlogRank: number;
	criterionValues: Array<{
		criterionId: string;
		name: string;
		notEvaluated: boolean;
		rank: PriorityRank | null;
	}>;
	evidence: {
		feedbackRecords: number;
		uniqueCompanies: number;
		uniqueContacts: number;
	};
	riskCount: number;
	sessionRank: number;
	targetDate: string | null;
	title: string;
	workId: string;
}

export interface PrioritizationSessionView {
	archivedAt: string | null;
	cards: PrioritizationSessionCardView[];
	closedAt: string | null;
	comparison: {
		backlogOrder: string[];
		implicitSync: false;
		sessionOrder: string[];
	};
	createdAt: string;
	id: string;
	name: string;
	projectId: string;
	revision: number;
	writes: {
		backlogOrder: false;
		criterionValues: false;
		dailyFocus: false;
		decisionRecord: false;
		focusPeriod: false;
		roadmapHorizon: false;
		sessionScore: false;
		status: false;
	};
}
