import { getProject } from "../../project-shell/server/project-shell";
import type { StarterConfiguration } from "../../project-shell/server/project-shell-model";
import {
	listRelations,
	type PresentedEnd,
	type PresentedRelation,
} from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	getWork,
	getWorkScope,
} from "../../work-lifecycle/server/work-lifecycle";
import type { WorkType } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	INITIALLY_VISIBLE_FIELDS,
	type LiveSource,
	PREPARED_LAYOUTS,
	type PreparedSection,
	type PresentWorkContextCardInput,
	type RelatedLiveSource,
	type VisibleSectionView,
	WHY_CHAIN_ROLES,
	type WhyChainStep,
	WORK_CONTEXT_COPY,
	type WorkContextCardView,
} from "./work-context-model";

const OWN_FIELD_SECTION: Record<WorkType, PreparedSection> = {
	Bug: WORK_CONTEXT_COPY.observedExpectedBehavior,
	Feature: WORK_CONTEXT_COPY.problemOpportunity,
	Improvement: WORK_CONTEXT_COPY.currentSituation,
	Research: WORK_CONTEXT_COPY.researchQuestion,
	Task: WORK_CONTEXT_COPY.description,
};

const ADD_SECTIONS = new Set<string>([
	WORK_CONTEXT_COPY.currentSituation,
	WORK_CONTEXT_COPY.description,
	WORK_CONTEXT_COPY.expectedOutcome,
	WORK_CONTEXT_COPY.observedExpectedBehavior,
	WORK_CONTEXT_COPY.problemOpportunity,
	WORK_CONTEXT_COPY.researchQuestion,
]);

const EVIDENCE_KINDS = new Set([
	"Diagram Version",
	"Document",
	"Experiment/Validation",
	"Feedback",
	"File Attachment",
	"Session Test",
	"Source",
	"User Research Session",
]);

const TEST_KINDS = new Set([
	"GitHub PR",
	"Session Test",
	"Test Gap",
	"Test Session",
]);

export function presentWorkContextCard(
	input: PresentWorkContextCardInput
): WorkContextCardView {
	const preparedSections = [
		...PREPARED_LAYOUTS[input.workType],
	] as PreparedSection[];
	const revealed = new Set(input.revealedSections ?? []);
	const visiblePreparedSections = preparedSections.filter((section) =>
		revealed.has(section)
	);
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
		visibleSections: visiblePreparedSections.map((name) =>
			presentVisibleSection(name, input)
		),
		whyChain: presentWhyChain(input),
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

export async function loadWorkContextCard(
	prisma: Parameters<typeof getWork>[0],
	query: {
		revealedSections?: readonly string[];
		viewerWorkspaceId: string;
		workId: string;
	}
): Promise<WorkContextCardView | null> {
	const work = await getWork(prisma, query.workId);
	if (!work) {
		return null;
	}
	const project = await getProject(prisma, work.projectId);
	if (!project) {
		return null;
	}
	const scope = await getWorkScope(prisma, work.id);
	const relations = await listRelations(prisma, {
		record: { id: work.id, kind: "Work" },
		viewerWorkspaceId: query.viewerWorkspaceId,
	});
	const relatedSources: RelatedLiveSource[] = [];
	const originWorkIds: string[] = [];
	let projectGoal: LiveSource | null = null;
	for (const relation of relations) {
		const other = otherEnd(relation, work.id);
		const live = liveSourceFromEnd(other);
		relatedSources.push({
			kind: other.kind,
			other: live,
			relationType: relation.type,
		});
		if (
			relation.type === RELATIONS_COPY.origin &&
			other.status === "resolved" &&
			other.kind === "Work"
		) {
			originWorkIds.push(other.id);
		}
		if (
			relation.type === RELATIONS_COPY.contributesToGoal &&
			other.kind === "Project Goal" &&
			projectGoal === null
		) {
			projectGoal = live;
		}
	}
	const originWorks = await Promise.all(
		originWorkIds.map((id) => getWork(prisma, id))
	);
	const researchOriginIds = new Set(
		originWorks.flatMap((origin) =>
			origin?.type === "Research" ? [origin.id] : []
		)
	);
	const originResearch =
		relatedSources.find(
			(item) =>
				item.relationType === RELATIONS_COPY.origin &&
				item.other.status === "live" &&
				researchOriginIds.has(item.other.sourceId)
		)?.other ?? null;
	const includedIn = scope?.includedIn
		? await getWork(prisma, scope.includedIn.id)
		: null;
	return presentWorkContextCard({
		description: work.description,
		includedWork: (scope?.includedWork ?? []).map((item) => ({
			kind: "Work",
			openSourceRecord: true,
			opensWorkSurface: false,
			recordStatus: "Work",
			sourceId: item.id,
			status: "live",
			visibleName: item.title,
		})),
		originResearch,
		primaryFeature: includedIn
			? {
					kind: "Work",
					openSourceRecord: true,
					opensWorkSurface: false,
					recordStatus: includedIn.status,
					sourceId: includedIn.id,
					status: "live",
					visibleName: includedIn.title,
				}
			: null,
		primarySpec: scope?.primarySpec
			? {
					kind: "Document",
					openSourceRecord: true,
					opensWorkSurface: false,
					recordStatus: "Document",
					sourceId: scope.primarySpec.id,
					status: "live",
					visibleName: scope.primarySpec.title,
				}
			: null,
		projectGoal,
		relatedSources,
		revealedSections: query.revealedSections,
		starterConfiguration: project.starterConfiguration as StarterConfiguration,
		workId: work.id,
		workStatus: work.status,
		workType: work.type as WorkType,
	});
}

function presentWhyChain(input: PresentWorkContextCardInput): {
	empty: boolean;
	emptyState: typeof WORK_CONTEXT_COPY.emptySection | null;
	label: typeof WORK_CONTEXT_COPY.whyAmIDoingThisWork;
	steps: WhyChainStep[];
} {
	const decision = input.relatedSources?.find(
		(item) => item.kind === "Decision"
	)?.other;
	const github = input.relatedSources?.find(
		(item) => item.kind === "GitHub PR"
	)?.other;
	const steps = [
		toWhyStep(WHY_CHAIN_ROLES.projectGoal, input.projectGoal),
		toWhyStep(WHY_CHAIN_ROLES.originResearch, input.originResearch),
		toWhyStep(WHY_CHAIN_ROLES.primaryFeature, input.primaryFeature),
		toWhyStep(WHY_CHAIN_ROLES.primarySpec, input.primarySpec),
		toWhyStep(WHY_CHAIN_ROLES.decision, decision),
		toWhyStep(WHY_CHAIN_ROLES.github, github),
	].filter((step): step is WhyChainStep => step !== null);
	return {
		empty: steps.length === 0,
		emptyState: steps.length === 0 ? WORK_CONTEXT_COPY.emptySection : null,
		label: WORK_CONTEXT_COPY.whyAmIDoingThisWork,
		steps,
	};
}

function toWhyStep(
	role: WhyChainStep["role"],
	source: LiveSource | null | undefined
): WhyChainStep | null {
	if (!source) {
		return null;
	}
	if (source.status === "broken") {
		return {
			openSourceRecord: source.openSourceRecord,
			opensWorkSurface: false,
			reason: source.reason,
			role,
		};
	}
	return {
		openSourceRecord: true,
		opensWorkSurface: false,
		role,
		sourceId: source.sourceId,
		visibleName: source.visibleName,
	};
}

function presentVisibleSection(
	name: PreparedSection,
	input: PresentWorkContextCardInput
): VisibleSectionView {
	const items: LiveSource[] = [];
	const ownField = OWN_FIELD_SECTION[input.workType];
	if (
		name === ownField &&
		typeof input.description === "string" &&
		input.description.length > 0 &&
		input.workId
	) {
		items.push({
			kind: "Work",
			openSourceRecord: true,
			opensWorkSurface: false,
			recordStatus: input.workStatus ?? "Work",
			sourceId: input.workId,
			status: "live",
			visibleName: input.description,
		});
	}
	if (
		name === WORK_CONTEXT_COPY.expectedOutcome &&
		typeof input.expectedOutcome === "string" &&
		input.expectedOutcome.length > 0 &&
		input.workId
	) {
		items.push({
			kind: "Work",
			openSourceRecord: true,
			opensWorkSurface: false,
			recordStatus: input.workStatus ?? "Work",
			sourceId: input.workId,
			status: "live",
			visibleName: input.expectedOutcome,
		});
	}
	if (name === WORK_CONTEXT_COPY.includedWork) {
		items.push(...(input.includedWork ?? []));
	}
	for (const related of input.relatedSources ?? []) {
		if (
			sectionForRelated(input.workType, related.relationType, related.kind) ===
			name
		) {
			items.push(related.other);
		}
	}
	const empty = items.length === 0;
	const add = ADD_SECTIONS.has(name);
	return {
		action: add
			? { kind: "add", label: WORK_CONTEXT_COPY.add }
			: { kind: "link", label: WORK_CONTEXT_COPY.link },
		empty,
		emptyState: empty ? WORK_CONTEXT_COPY.emptySection : null,
		items,
		name,
	};
}

export function sectionForRelated(
	workType: WorkType,
	relationType: string,
	kind: string
): PreparedSection | null {
	const layout = new Set<string>(PREPARED_LAYOUTS[workType]);
	const pick = (section: PreparedSection): PreparedSection | null =>
		layout.has(section) ? section : null;
	if (kind === "Decision") {
		return (
			pick(WORK_CONTEXT_COPY.evidenceAndDecisions) ??
			pick(WORK_CONTEXT_COPY.decisions)
		);
	}
	if (kind === "Risk" || kind === "Question" || kind === "Assumption") {
		return (
			pick(WORK_CONTEXT_COPY.risksAndOpenQuestions) ??
			pick(WORK_CONTEXT_COPY.evidenceAndDecisions) ??
			pick(WORK_CONTEXT_COPY.sourcesAndEvidence) ??
			pick(WORK_CONTEXT_COPY.evidence)
		);
	}
	if (kind === "Project Release") {
		return (
			pick(WORK_CONTEXT_COPY.affectedReleases) ??
			pick(WORK_CONTEXT_COPY.targetRelease)
		);
	}
	if (TEST_KINDS.has(kind)) {
		return pick(WORK_CONTEXT_COPY.githubAndTests);
	}
	if (relationType === RELATIONS_COPY.evidence || EVIDENCE_KINDS.has(kind)) {
		return (
			pick(WORK_CONTEXT_COPY.evidenceAndDecisions) ??
			pick(WORK_CONTEXT_COPY.sourcesAndEvidence) ??
			pick(WORK_CONTEXT_COPY.evidence)
		);
	}
	if (
		relationType === RELATIONS_COPY.includes ||
		relationType === RELATIONS_COPY.includedIn
	) {
		return pick(WORK_CONTEXT_COPY.includedWork);
	}
	if (
		relationType === RELATIONS_COPY.blocks ||
		relationType === RELATIONS_COPY.blockedBy
	) {
		return pick(WORK_CONTEXT_COPY.dependencies);
	}
	if (relationType === RELATIONS_COPY.related && kind === "Work") {
		return pick(WORK_CONTEXT_COPY.relatedWork);
	}
	if (relationType === RELATIONS_COPY.origin && kind !== "Work") {
		return pick(WORK_CONTEXT_COPY.sourcesAndEvidence);
	}
	return null;
}

function otherEnd(relation: PresentedRelation, workId: string): PresentedEnd {
	return relation.from.id === workId ? relation.to : relation.from;
}

export function liveSourceFromEnd(end: PresentedEnd): LiveSource {
	if (end.status === "broken") {
		return {
			kind: end.kind,
			openSourceRecord: end.openSourceRecord,
			opensWorkSurface: false,
			reason: end.reason,
			status: "broken",
			...(end.openSourceRecord && typeof end.title === "string"
				? { visibleName: end.title }
				: {}),
		};
	}
	return {
		kind: end.kind,
		openSourceRecord: true,
		opensWorkSurface: false,
		recordStatus: end.workStatus ?? end.kind,
		sourceId: end.id,
		status: "live",
		visibleName: end.title,
	};
}
