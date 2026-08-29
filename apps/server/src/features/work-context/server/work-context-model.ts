import type { StarterConfiguration } from "../../project-shell/server/project-shell-model";
import type { WorkType } from "../../work-lifecycle/server/work-lifecycle-model";

export const WORK_CONTEXT_COPY = {
	addContext: "Add Context",
	affectedReleases: "Affected Releases",
	currentSituation: "Current Situation",
	decisions: "Decisions",
	dependencies: "Dependencies",
	description: "Description",
	evidence: "Evidence",
	evidenceAndDecisions: "Evidence & Decisions",
	expectedOutcome: "Expected Outcome",
	githubAndTests: "GitHub & Tests",
	includedWork: "Included Work",
	observedExpectedBehavior: "Observed/Expected Behavior",
	planning: "Planning",
	problemOpportunity: "Problem/Opportunity",
	relatedWork: "Related Work",
	researchQuestion: "Research Question",
	risksAndOpenQuestions: "Risks & Open Questions",
	sourcesAndEvidence: "Sources & Evidence",
	status: "Status",
	targetRelease: "Target Release",
	title: "Title",
	type: "Type",
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

export interface WorkContextCardView {
	addContext: {
		label: typeof WORK_CONTEXT_COPY.addContext;
		remainingSections: PreparedSection[];
	};
	gates: {
		create: false;
		statusTransition: false;
	};
	initiallyVisibleFields: typeof INITIALLY_VISIBLE_FIELDS;
	preparedSections: PreparedSection[];
	starterConfiguration: StarterConfiguration;
	visiblePreparedSections: PreparedSection[];
	workType: WorkType;
}

export interface PresentWorkContextCardInput {
	revealedSections?: readonly string[];
	starterConfiguration: StarterConfiguration;
	workType: WorkType;
}
