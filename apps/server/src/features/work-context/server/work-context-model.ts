import type { StarterConfiguration } from "../../project-shell/server/project-shell-model";
import type { WorkType } from "../../work-lifecycle/server/work-lifecycle-model";

export const WORK_CONTEXT_COPY = {
	add: "Add",
	addContext: "Add Context",
	affectedReleases: "Affected Releases",
	archive: "Archive",
	blocker: "Blocked by",
	currentSituation: "Current Situation",
	decision: "Decision",
	decisions: "Decisions",
	dependencies: "Dependencies",
	description: "Description",
	effort: "Effort",
	emptySection: "Nothing here yet.",
	evidence: "Evidence",
	evidenceAndDecisions: "Evidence & Decisions",
	expectedOutcome: "Expected Outcome",
	feedback: "Feedback",
	githubAndTests: "GitHub & Tests",
	includedWork: "Included Work",
	link: "Link",
	milestone: "Milestone",
	observedExpectedBehavior: "Observed/Expected Behavior",
	openQuestion: "Open Question",
	openSourceRecord: "Open source record",
	planning: "Planning",
	priorityFoundations: "Priority Foundations",
	priorityMetrics: "Priority metrics",
	problemOpportunity: "Problem/Opportunity",
	projectGoal: "Project Goal",
	relatedWork: "Related Work",
	research: "Research",
	researchQuestion: "Research Question",
	risk: "Risk",
	risksAndOpenQuestions: "Risks & Open Questions",
	source: "Source",
	sourcesAndEvidence: "Sources & Evidence",
	status: "Status",
	targetDate: "Target date",
	targetRelease: "Target Release",
	title: "Title",
	type: "Type",
	uniqueCompany: "Unique Company",
	uniqueContact: "Unique Contact",
	whyAmIDoingThisWork: "Why am I doing this work?",
} as const;

export const WHY_CHAIN_ROLES = {
	decision: "Decision",
	github: "GitHub",
	originResearch: "Origin",
	primaryFeature: "Feature",
	primarySpec: "Primary spec",
	projectGoal: "Project Goal",
} as const;

export const INITIALLY_VISIBLE_FIELDS = [
	WORK_CONTEXT_COPY.title,
	WORK_CONTEXT_COPY.type,
	WORK_CONTEXT_COPY.status,
	WORK_CONTEXT_COPY.planning,
] as const;

export const PREPARED_LAYOUTS = {
	Bug: [
		WORK_CONTEXT_COPY.observedExpectedBehavior,
		WORK_CONTEXT_COPY.affectedReleases,
		WORK_CONTEXT_COPY.evidence,
		WORK_CONTEXT_COPY.githubAndTests,
	],
	Feature: [
		WORK_CONTEXT_COPY.problemOpportunity,
		WORK_CONTEXT_COPY.expectedOutcome,
		WORK_CONTEXT_COPY.evidenceAndDecisions,
		WORK_CONTEXT_COPY.risksAndOpenQuestions,
		WORK_CONTEXT_COPY.includedWork,
		WORK_CONTEXT_COPY.githubAndTests,
		WORK_CONTEXT_COPY.targetRelease,
	],
	Improvement: [
		WORK_CONTEXT_COPY.currentSituation,
		WORK_CONTEXT_COPY.expectedOutcome,
		WORK_CONTEXT_COPY.evidence,
		WORK_CONTEXT_COPY.githubAndTests,
	],
	Research: [
		WORK_CONTEXT_COPY.researchQuestion,
		WORK_CONTEXT_COPY.sourcesAndEvidence,
		WORK_CONTEXT_COPY.decisions,
		WORK_CONTEXT_COPY.relatedWork,
	],
	Task: [
		WORK_CONTEXT_COPY.description,
		WORK_CONTEXT_COPY.dependencies,
		WORK_CONTEXT_COPY.githubAndTests,
		WORK_CONTEXT_COPY.targetRelease,
	],
} as const satisfies Record<WorkType, readonly string[]>;

export type PreparedSection = (typeof PREPARED_LAYOUTS)[WorkType][number];

export type LiveSource =
	| {
			kind: string;
			openSourceRecord: true;
			opensWorkSurface: false;
			recordStatus: string;
			sourceId: string;
			status: "live";
			visibleName: string;
	  }
	| {
			kind: string;
			openSourceRecord: boolean;
			opensWorkSurface: false;
			reason: string;
			sourceId?: string;
			status: "broken";
			visibleName?: string;
	  };

export interface RelatedLiveSource {
	companyId?: string;
	companyName?: string;
	contactId?: string;
	contactName?: string;
	kind: string;
	other: LiveSource;
	relationType: string;
	workType?: WorkType;
}

export const PRIORITY_FOUNDATIONS_CLAIMS = {
	automaticPriorityInput: false,
	automaticRank: false,
	countsAreDemand: false,
	countsArePopularity: false,
	countsAreVotes: false,
	isBacklogOrder: false,
	isPrioritizationSession: false,
	numericScore: false,
	wsjf: false,
} as const;

export interface PriorityFoundationsItem {
	archiveVisible: boolean;
	kind: string;
	sourceId: string;
	visibleName: string;
}

export interface PriorityFoundationsCount {
	id: string;
	kind: string;
	label: string;
	value: number;
}

export interface PriorityFoundationsView {
	claims: typeof PRIORITY_FOUNDATIONS_CLAIMS;
	countSets: Record<string, PriorityFoundationsItem[]>;
	counts: PriorityFoundationsCount[];
	items: PriorityFoundationsItem[];
	label: typeof WORK_CONTEXT_COPY.priorityFoundations;
	openedCountId: string | null;
	openedSet: PriorityFoundationsItem[] | null;
}

export interface WhyChainStep {
	openSourceRecord: boolean;
	opensWorkSurface: false;
	reason?: string;
	role: (typeof WHY_CHAIN_ROLES)[keyof typeof WHY_CHAIN_ROLES];
	sourceId?: string;
	visibleName?: string;
}

export interface VisibleSectionView {
	action: {
		kind: "add" | "link";
		label: typeof WORK_CONTEXT_COPY.add | typeof WORK_CONTEXT_COPY.link;
	};
	empty: boolean;
	emptyState: typeof WORK_CONTEXT_COPY.emptySection | null;
	items: LiveSource[];
	name: PreparedSection;
}

export interface WorkContextCardView {
	addContext: {
		label: typeof WORK_CONTEXT_COPY.addContext;
		remainingSections: PreparedSection[];
	};
	effects: {
		close: false;
		completenessScore: false;
		health: false;
		priority: false;
		processGate: false;
		releaseScope: false;
		status: false;
	};
	gates: {
		create: false;
		statusTransition: false;
	};
	initiallyVisibleFields: typeof INITIALLY_VISIBLE_FIELDS;
	preparedSections: PreparedSection[];
	priorityFoundations: PriorityFoundationsView;
	starterConfiguration: StarterConfiguration;
	visiblePreparedSections: PreparedSection[];
	visibleSections: VisibleSectionView[];
	whyChain: {
		empty: boolean;
		emptyState: typeof WORK_CONTEXT_COPY.emptySection | null;
		label: typeof WORK_CONTEXT_COPY.whyAmIDoingThisWork;
		steps: WhyChainStep[];
	};
	workType: WorkType;
	writes: {
		bodyCopy: false;
		contextRecord: false;
		relation: false;
	};
}

export interface PresentWorkContextCardInput {
	criterionValues?: readonly {
		name: string;
		sourceId: string;
		value: string;
	}[];
	dates?: readonly { label: string; value: string }[];
	description?: string | null;
	effort?: string | null;
	expectedOutcome?: string | null;
	includedWork?: readonly LiveSource[];
	openedCountId?: string | null;
	originResearch?: LiveSource | null;
	primaryFeature?: LiveSource | null;
	primarySpec?: LiveSource | null;
	projectGoal?: LiveSource | null;
	relatedSources?: readonly RelatedLiveSource[];
	revealedSections?: readonly string[];
	starterConfiguration: StarterConfiguration;
	workId?: string;
	workStatus?: string;
	workType: WorkType;
}
