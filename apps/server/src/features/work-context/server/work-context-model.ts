import { z } from "zod";

import type { StarterConfiguration } from "../../project-shell/server/project-shell-model";
import type { WorkType } from "../../work-lifecycle/server/work-lifecycle-model";

export const WORK_CONTEXT_COPY = {
	activeBlockers: "Active blockers",
	add: "Add",
	addContext: "Add Context",
	addCustomSection: "Add custom section",
	affectedReleases: "Affected Releases",
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

export const CUSTOM_SECTION_RECORD_TYPES = [
	"Assumption",
	"Decision",
	"Experiment/Validation",
	"Feature",
	"Feedback",
	"GitHub PR/check",
	"Open Question",
	"Primary spec",
	"Project Goal",
	"Project Release",
	"Research",
	"Risk",
	"Session Test",
	"Source",
	"Test Gap",
	"User Research Session",
] as const;

export type CustomSectionRecordType =
	(typeof CUSTOM_SECTION_RECORD_TYPES)[number];

export const DIRECT_RELATION_TYPES = [
	"Blocked by",
	"Blocks",
	"Contributes to Goal",
	"Contributes to Milestone",
	"Derived",
	"Evidence",
	"Implements",
	"Included in",
	"Includes",
	"Origin",
	"Primary spec",
	"Provides evidence",
	"Related",
	"Supersedes",
] as const;

export type DirectRelationType = (typeof DIRECT_RELATION_TYPES)[number];

export const EVIDENCE_ROLES = [
	"Contradicts",
	"Inconclusive",
	"Provides context",
	"Supports",
	"Unspecified",
] as const;

export type EvidenceRole = (typeof EVIDENCE_ROLES)[number];

export const STATUS_CONDITIONS = [
	"Blocked",
	"Closed",
	"In Progress",
	"Not Started",
] as const;

export type StatusCondition = (typeof STATUS_CONDITIONS)[number];

export const layoutSectionConditionSchema = z.object({
	evidenceRole: z.enum(EVIDENCE_ROLES).optional(),
	recordType: z.enum(CUSTOM_SECTION_RECORD_TYPES).optional(),
	relationType: z.enum(DIRECT_RELATION_TYPES).optional(),
	status: z.enum(STATUS_CONDITIONS).optional(),
});

export type LayoutSectionCondition = z.infer<
	typeof layoutSectionConditionSchema
>;

export const layoutSectionSchema = z.object({
	condition: layoutSectionConditionSchema.optional(),
	hidden: z.boolean(),
	kind: z.enum(["custom", "prepared"]),
	name: z.string().min(1),
});

export type LayoutSection = z.infer<typeof layoutSectionSchema>;

export const workContextCardLayoutViewSchema = z.object({
	projectId: z.string().min(1),
	revision: z.number().int().positive(),
	sections: z.array(layoutSectionSchema),
	workType: z.enum(["Bug", "Feature", "Improvement", "Research", "Task"]),
});

export type WorkContextCardLayoutView = z.infer<
	typeof workContextCardLayoutViewSchema
>;

export const applyWorkContextLayoutPayloadSchema = z.object({
	projectId: z.string().min(1),
	sections: z.array(layoutSectionSchema),
	workType: z.enum(["Bug", "Feature", "Improvement", "Research", "Task"]),
});

export type ApplyWorkContextLayoutPayload = z.infer<
	typeof applyWorkContextLayoutPayloadSchema
>;

export function defaultLayoutSections(workType: WorkType): LayoutSection[] {
	return PREPARED_LAYOUTS[workType].map((name) => ({
		hidden: false,
		kind: "prepared" as const,
		name,
	}));
}

export function workContextLayoutCatalog() {
	return {
		copy: {
			addCustomSection: WORK_CONTEXT_COPY.addCustomSection,
			confirm: WORK_CONTEXT_COPY.confirm,
			evidenceRole: WORK_CONTEXT_COPY.evidenceRole,
			hide: WORK_CONTEXT_COPY.hide,
			impactPreview: WORK_CONTEXT_COPY.impactPreview,
			moveDown: WORK_CONTEXT_COPY.moveDown,
			moveUp: WORK_CONTEXT_COPY.moveUp,
			recordType: WORK_CONTEXT_COPY.recordType,
			relation: WORK_CONTEXT_COPY.relation,
			show: WORK_CONTEXT_COPY.show,
			undo: WORK_CONTEXT_COPY.undo,
		},
		evidenceRoles: EVIDENCE_ROLES,
		recordTypes: CUSTOM_SECTION_RECORD_TYPES,
		relationTypes: DIRECT_RELATION_TYPES,
		statusConditions: STATUS_CONDITIONS,
	};
}

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
	evidenceRole?: string;
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
	name: string;
}

export interface WorkContextCardView {
	addContext: {
		label: typeof WORK_CONTEXT_COPY.addContext;
		remainingSections: string[];
	};
	configuredSections: LayoutSection[];
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
	shareScope: {
		buildInPublic: false;
		linkSharing: false;
	};
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
	checklist?: ReadonlyArray<{ completed: boolean; title: string }>;
	description?: string | null;
	githubAndExternal?: readonly CopyContextSource[];
	key: string;
	primarySpec?: CopyContextSource | null;
	producedAt: string;
	relatedUncertainty?: readonly CopyContextSource[];
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
	layoutRevision?: number;
	layoutSections?: readonly LayoutSection[];
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
