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
	description: "Description",
	enable: "Enable",
	evidenceStrength: "Evidence strength",
	feedback: "Feedback",
	high: "High",
	horizontal: "Horizontal",
	low: "Low",
	medium: "Medium",
	name: "Name",
	nameRequired: "Name is required.",
	priorityMap: "Priority Map",
	priorityMetrics: "Priority metrics",
	rankExplanation: "Rank explanation",
	save: "Save",
	unevaluated: "Unevaluated",
	uniqueCompany: "Unique Company",
	uniqueContact: "Unique Contact",
	unknownRank: "This rank is not one of the five fixed levels.",
	vertical: "Vertical",
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
