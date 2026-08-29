import type { StarterConfiguration } from "../../project-shell/server/project-shell-model";
import type { WorkType } from "../../work-lifecycle/server/work-lifecycle-model";

export const WORK_CONTEXT_COPY = {
	add: "Add",
	addContext: "Add Context",
	affectedReleases: "Affected Releases",
	copyContextAsMarkdown: "Copy Context as Markdown",
	currentSituation: "Current Situation",
	decisions: "Decisions",
	dependencies: "Dependencies",
	description: "Description",
	emptySection: "Nothing here yet.",
	evidence: "Evidence",
	evidenceAndDecisions: "Evidence & Decisions",
	expectedOutcome: "Expected Outcome",
	githubAndTests: "GitHub & Tests",
	includedWork: "Included Work",
	link: "Link",
	observedExpectedBehavior: "Observed/Expected Behavior",
	openSourceRecord: "Open source record",
	planning: "Planning",
	primarySourceIsInTheApp: "Primary source is in the app",
	problemOpportunity: "Problem/Opportunity",
	relatedWork: "Related Work",
	researchQuestion: "Research Question",
	risksAndOpenQuestions: "Risks & Open Questions",
	sourcesAndEvidence: "Sources & Evidence",
	status: "Status",
	targetRelease: "Target Release",
	title: "Title",
	type: "Type",
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
			status: "broken";
			visibleName?: string;
	  };

export interface RelatedLiveSource {
	kind: string;
	other: LiveSource;
	relationType: string;
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
	copyContext: {
		label: typeof WORK_CONTEXT_COPY.copyContextAsMarkdown;
		writes: {
			contextRecord: false;
			relation: false;
			shareObject: false;
			snapshot: false;
		};
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

export interface CopyContextSource {
	href?: string;
	kind?: string;
	reason?: string;
	role?: string;
	sourceId?: string;
	visibleName?: string;
}

export interface CopyWorkContextInput {
	activeBlockers?: readonly CopyContextSource[];
	attachmentBytes?: string;
	checklist?: ReadonlyArray<{ completed: boolean; title: string }>;
	description?: string | null;
	githubAndExternal?: readonly CopyContextSource[];
	inaccessibleFields?: Record<string, string>;
	key: string;
	primarySpec?: CopyContextSource | null;
	producedAt: string;
	relatedUncertainty?: readonly CopyContextSource[];
	secrets?: Record<string, unknown>;
	status: string;
	title: string;
	type: string;
	whyChain?: readonly CopyContextSource[];
}

export interface WorkContextCopyView {
	markdown: string;
	producedAt: string;
	widensAccess: false;
	writes: {
		contextRecord: false;
		relation: false;
		shareObject: false;
		snapshot: false;
	};
}

export interface PresentWorkContextCardInput {
	description?: string | null;
	expectedOutcome?: string | null;
	includedWork?: readonly LiveSource[];
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
