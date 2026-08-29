import type { StarterConfiguration } from "../../project-shell/forms/project-shell-copy";
import type { WorkType } from "../../work-lifecycle/forms/work-lifecycle-copy";

export const WORK_CONTEXT_COPY = {
	activeBlockers: "Active blockers",
	add: "Add",
	addContext: "Add Context",
	addCustomSection: "Add custom section",
	affectedReleases: "Affected Releases",
	archive: "Archive",
	checklist: "Checklist",
	confirm: "Confirm",
	copyContextAsMarkdown: "Copy Context as Markdown",
	currentSituation: "Current Situation",
	decisions: "Decisions",
	dependencies: "Dependencies",
	description: "Description",
	emptySection: "Nothing here yet.",
	evidence: "Evidence",
	evidenceAndDecisions: "Evidence & Decisions",
	evidenceRole: "Evidence Role",
	expectedOutcome: "Expected Outcome",
	githubAndExternal: "GitHub and external links",
	githubAndTests: "GitHub & Tests",
	hide: "Hide",
	impactPreview: "Impact preview",
	includedWork: "Included Work",
	key: "Key",
	link: "Link",
	moveDown: "Move down",
	moveUp: "Move up",
	observedExpectedBehavior: "Observed/Expected Behavior",
	openSourceRecord: "Open source record",
	planning: "Planning",
	primarySourceIsInTheApp: "Primary source is in the app",
	primarySpec: "Primary spec",
	priorityFoundations: "Priority Foundations",
	problemOpportunity: "Problem/Opportunity",
	producedAt: "Produced at",
	recordType: "Record type",
	relatedUncertainty: "Related Decision, Risk, and Open Question",
	relatedWork: "Related Work",
	relation: "Relation",
	researchQuestion: "Research Question",
	risksAndOpenQuestions: "Risks & Open Questions",
	show: "Show",
	sourcesAndEvidence: "Sources & Evidence",
	status: "Status",
	targetRelease: "Target Release",
	title: "Title",
	type: "Type",
	undo: "Undo",
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
		remainingSections: string[];
	};
	configuredSections: Array<{
		hidden: boolean;
		kind: "custom" | "prepared";
		name: string;
	}>;
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
	hiddenSections: Array<{ name: string; treatedAsMissing: false }>;
	initiallyVisibleFields: typeof INITIALLY_VISIBLE_FIELDS;
	layout: {
		projectScoped: true;
		revision: number;
		workType: WorkType;
	};
	preparedSections: PreparedSection[];
	priorityFoundations: {
		claims: {
			automaticPriorityInput: false;
			automaticRank: false;
			countsAreDemand: false;
			countsArePopularity: false;
			countsAreVotes: false;
			isBacklogOrder: false;
			isPrioritizationSession: false;
			numericScore: false;
			wsjf: false;
		};
		countSets: Record<
			string,
			Array<{
				archiveVisible: boolean;
				kind: string;
				sourceId: string;
				visibleName: string;
			}>
		>;
		counts: Array<{
			id: string;
			kind: string;
			label: string;
			value: number;
		}>;
		empty: boolean;
		items: Array<{
			archiveVisible: boolean;
			kind: string;
			sourceId: string;
			visibleName: string;
		}>;
		label: typeof WORK_CONTEXT_COPY.priorityFoundations;
		openedCountId: string | null;
		openedSet: Array<{
			archiveVisible: boolean;
			kind: string;
			sourceId: string;
			visibleName: string;
		}> | null;
	};
	shareScope: {
		buildInPublic: false;
		linkSharing: false;
	};
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
		name: string;
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
		configuredSections: preparedSections.map((name) => ({
			hidden: false,
			kind: "prepared" as const,
			name,
		})),
		copyContext: {
			label: WORK_CONTEXT_COPY.copyContextAsMarkdown,
			writes: {
				contextRecord: false,
				relation: false,
				shareObject: false,
				snapshot: false,
			},
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
		hiddenSections: [],
		initiallyVisibleFields: INITIALLY_VISIBLE_FIELDS,
		layout: {
			projectScoped: true,
			revision: 1,
			workType: input.workType,
		},
		preparedSections,
		priorityFoundations: {
			claims: {
				automaticPriorityInput: false,
				automaticRank: false,
				countsAreDemand: false,
				countsArePopularity: false,
				countsAreVotes: false,
				isBacklogOrder: false,
				isPrioritizationSession: false,
				numericScore: false,
				wsjf: false,
			},
			countSets: {},
			counts: [],
			empty: true,
			items: [],
			label: WORK_CONTEXT_COPY.priorityFoundations,
			openedCountId: null,
			openedSet: null,
		},
		shareScope: {
			buildInPublic: false,
			linkSharing: false,
		},
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

export function openPriorityFoundationsCount(
	card: WorkContextCardView,
	countId: string
): WorkContextCardView {
	const set = card.priorityFoundations.countSets[countId];
	if (!set) {
		return card;
	}
	return {
		...card,
		priorityFoundations: {
			...card.priorityFoundations,
			openedCountId: countId,
			openedSet: set,
		},
	};
}
