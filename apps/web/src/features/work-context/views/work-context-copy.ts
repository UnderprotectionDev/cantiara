import type { StarterConfiguration } from "../../project-shell/forms/project-shell-copy";
import type { WorkType } from "../../work-lifecycle/forms/work-lifecycle-copy";

export const WORK_CONTEXT_COPY = {
	add: "Add",
	addContext: "Add Context",
	affectedReleases: "Affected Releases",
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
	visibleSections: Array<{
		action: { kind: "add" | "link"; label: "Add" | "Link" };
		empty: boolean;
		emptyState: typeof WORK_CONTEXT_COPY.emptySection | null;
		items: Array<{
			kind: string;
			openSourceRecord: boolean;
			opensWorkSurface: false;
			reason?: string;
			recordStatus?: string;
			sourceId?: string;
			status: "live" | "broken";
			visibleName?: string;
		}>;
		name: PreparedSection;
	}>;
	whyChain: {
		empty: boolean;
		emptyState: typeof WORK_CONTEXT_COPY.emptySection | null;
		label: typeof WORK_CONTEXT_COPY.whyAmIDoingThisWork;
		steps: Array<{
			openSourceRecord: boolean;
			opensWorkSurface: false;
			reason?: string;
			role: string;
			sourceId?: string;
			visibleName?: string;
		}>;
	};
	workType: WorkType;
	writes: {
		bodyCopy: false;
		contextRecord: false;
		relation: false;
	};
}

export function presentWorkContextCard(input: {
	revealedSections?: readonly string[];
	starterConfiguration: StarterConfiguration;
	workType: WorkType;
}): WorkContextCardView {
	const preparedSections = [
		...PREPARED_LAYOUTS[input.workType],
	] as PreparedSection[];
	const revealed = new Set(input.revealedSections ?? []);
	const visiblePreparedSections = preparedSections.filter((section) =>
		revealed.has(section)
	);
	const addSections = new Set<string>([
		WORK_CONTEXT_COPY.currentSituation,
		WORK_CONTEXT_COPY.description,
		WORK_CONTEXT_COPY.expectedOutcome,
		WORK_CONTEXT_COPY.observedExpectedBehavior,
		WORK_CONTEXT_COPY.problemOpportunity,
		WORK_CONTEXT_COPY.researchQuestion,
	]);
	return {
		addContext: {
			label: WORK_CONTEXT_COPY.addContext,
			remainingSections: preparedSections.filter(
				(section) => !revealed.has(section)
			),
		},
		effects: {
			close: false,
			completenessScore: false,
			health: false,
			priority: false,
			processGate: false,
			releaseScope: false,
			status: false,
		},
		gates: {
			create: false,
			statusTransition: false,
		},
		initiallyVisibleFields: INITIALLY_VISIBLE_FIELDS,
		preparedSections,
		starterConfiguration: input.starterConfiguration,
		visiblePreparedSections,
		visibleSections: visiblePreparedSections.map((name) => {
			const add = addSections.has(name);
			return {
				action: add
					? { kind: "add" as const, label: WORK_CONTEXT_COPY.add }
					: { kind: "link" as const, label: WORK_CONTEXT_COPY.link },
				empty: true,
				emptyState: WORK_CONTEXT_COPY.emptySection,
				items: [],
				name,
			};
		}),
		whyChain: {
			empty: true,
			emptyState: WORK_CONTEXT_COPY.emptySection,
			label: WORK_CONTEXT_COPY.whyAmIDoingThisWork,
			steps: [],
		},
		workType: input.workType,
		writes: {
			bodyCopy: false,
			contextRecord: false,
			relation: false,
		},
	};
}

export function revealPreparedSection(
	card: WorkContextCardView,
	section: string
): WorkContextCardView {
	if (!card.addContext.remainingSections.some((item) => item === section)) {
		return card;
	}
	return presentWorkContextCard({
		revealedSections: [...card.visiblePreparedSections, section],
		starterConfiguration: card.starterConfiguration,
		workType: card.workType,
	});
}
