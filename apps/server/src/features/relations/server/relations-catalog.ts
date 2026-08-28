export const RELATIONS_COPY = {
	archived: "Archived",
	belongsToCompany: "Belongs to Company",
	blockedBy: "Blocked by",
	blocks: "Blocks",
	confirmRelation: "Confirm relation",
	contextual: "Contextual",
	contributesToGoal: "Contributes to Goal",
	contributesToMilestone: "Contributes to Milestone",
	derived: "Derived",
	evidence: "Evidence",
	implementedBy: "Implemented by",
	implements: "Implements",
	includedIn: "Included in",
	includes: "Includes",
	inGoal: "In Goal",
	inMilestone: "In Milestone",
	inTrash: "In Trash",
	noAccess: "No access",
	noRelations: "No relations yet.",
	openSourceRecord: "Open source record",
	origin: "Origin",
	originLocation: "Origin Location",
	participant: "Participant",
	permanentlyDeleted: "Permanently deleted",
	preview: "Preview",
	primarySpec: "Primary spec",
	providesEvidence: "Provides evidence",
	redactedForSecurity: "Redacted for security",
	related: "Related",
	remove: "Remove",
	requiredForCompletion: "Required for completion",
	sourceItemGone: "Source item is gone",
	supersededBy: "Superseded by",
	supersedes: "Supersedes",
	type: "Type",
	usedIn: "Used in",
} as const;

export const BROKEN_REASONS = [
	RELATIONS_COPY.archived,
	RELATIONS_COPY.inTrash,
	RELATIONS_COPY.permanentlyDeleted,
	RELATIONS_COPY.redactedForSecurity,
	RELATIONS_COPY.noAccess,
] as const;

export type BrokenReason = (typeof BROKEN_REASONS)[number];

export const RELATION_TYPES = [
	RELATIONS_COPY.related,
	RELATIONS_COPY.origin,
	RELATIONS_COPY.evidence,
	RELATIONS_COPY.contributesToGoal,
	RELATIONS_COPY.blocks,
	RELATIONS_COPY.includes,
	RELATIONS_COPY.contributesToMilestone,
	RELATIONS_COPY.primarySpec,
	RELATIONS_COPY.supersedes,
	RELATIONS_COPY.implements,
	RELATIONS_COPY.belongsToCompany,
	RELATIONS_COPY.participant,
	RELATIONS_COPY.requiredForCompletion,
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export const GENERIC_RELATION_TYPES = [
	RELATIONS_COPY.related,
	RELATIONS_COPY.origin,
] as const;

export const RECORD_KINDS = [
	"Work",
	"Source",
	"Document",
	"Capture",
	"Feedback",
	"Technical Diagram",
	"Test Session",
	"User Research Session",
	"Test Gap",
	"Decision",
	"Risk",
	"Assumption",
	"Question",
	"Test",
	"Project Release",
	"Project Goal",
	"Milestone",
	"File Attachment",
	"Contact",
	"Company",
	"GitHub PR",
	"Diagram Version",
	"Migration Artifact",
	"Experiment/Validation",
	"Session Test",
	"Access observation",
	"Result observation",
] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];

export const MAIN_RECORD_KINDS = [
	"Work",
	"Source",
	"Document",
	"Capture",
	"Feedback",
	"Technical Diagram",
	"Test Session",
	"User Research Session",
	"Test Gap",
	"Decision",
	"Risk",
	"Assumption",
	"Question",
	"Test",
	"Project Release",
	"Project Goal",
	"Milestone",
	"File Attachment",
	"Contact",
	"Company",
	"GitHub PR",
] as const satisfies readonly RecordKind[];

export const OWNED_COMPONENT_KINDS = [
	"Session Test",
	"Access observation",
	"Result observation",
] as const satisfies readonly RecordKind[];

export const ORIGIN_SOURCE_KINDS = [
	"Source",
	"Document",
	"Capture",
	"Feedback",
	"Technical Diagram",
	"Work",
	"Test Session",
	"User Research Session",
	"Test Gap",
] as const satisfies readonly RecordKind[];

export const EVIDENCE_SOURCE_KINDS = [
	"Source",
	"Document",
	"Diagram Version",
	"Feedback",
	"User Research Session",
	"Experiment/Validation",
	"Session Test",
	"File Attachment",
] as const satisfies readonly RecordKind[];

export const EVIDENCE_TARGET_KINDS = [
	"Work",
	"Decision",
	"Risk",
	"Assumption",
	"Question",
	"Test",
	"Project Release",
	"Access observation",
	"Result observation",
] as const satisfies readonly RecordKind[];

export const SUPERSEDES_KINDS = [
	"Decision",
	"Experiment/Validation",
	"Session Test",
] as const satisfies readonly RecordKind[];

export const BLOCKER_STATES = ["Active", "Resolved"] as const;

export type BlockerState = (typeof BLOCKER_STATES)[number];

export interface RecordRef {
	id: string;
	kind: RecordKind;
	workType?: string;
}

export interface OriginLocationInput {
	componentId: string;
	ownerId: string;
	ownerKind: RecordKind;
	sourceVersion: string;
}

function isKind<T extends RecordKind>(
	value: RecordKind,
	allowed: readonly T[]
): value is T {
	return (allowed as readonly RecordKind[]).includes(value);
}

function relatedEndsAllowed(from: RecordRef, to: RecordRef): boolean {
	if (
		isKind(from.kind, MAIN_RECORD_KINDS) &&
		isKind(to.kind, MAIN_RECORD_KINDS)
	) {
		return true;
	}
	const pair = relatedSpecialPair(from.kind, to.kind);
	return pair;
}

function relatedSpecialPair(left: RecordKind, right: RecordKind): boolean {
	const diagramVersionTargets = new Set<RecordKind>([
		"Work",
		"Decision",
		"Project Release",
	]);
	const migrationTargets = new Set<RecordKind>([
		"GitHub PR",
		"Test Session",
		"Project Release",
	]);
	if (left === "Diagram Version" && diagramVersionTargets.has(right)) {
		return true;
	}
	if (right === "Diagram Version" && diagramVersionTargets.has(left)) {
		return true;
	}
	if (left === "Migration Artifact" && migrationTargets.has(right)) {
		return true;
	}
	if (right === "Migration Artifact" && migrationTargets.has(left)) {
		return true;
	}
	return false;
}

export function isOwnedComponentKind(kind: RecordKind): boolean {
	return isKind(kind, OWNED_COMPONENT_KINDS);
}

const VIEW_LABELS: Record<RelationType, { from: string; to: string }> = {
	[RELATIONS_COPY.belongsToCompany]: {
		from: RELATIONS_COPY.belongsToCompany,
		to: RELATIONS_COPY.belongsToCompany,
	},
	[RELATIONS_COPY.blocks]: {
		from: RELATIONS_COPY.blocks,
		to: RELATIONS_COPY.blockedBy,
	},
	[RELATIONS_COPY.contributesToGoal]: {
		from: RELATIONS_COPY.contributesToGoal,
		to: RELATIONS_COPY.inGoal,
	},
	[RELATIONS_COPY.contributesToMilestone]: {
		from: RELATIONS_COPY.contributesToMilestone,
		to: RELATIONS_COPY.inMilestone,
	},
	[RELATIONS_COPY.evidence]: {
		from: RELATIONS_COPY.providesEvidence,
		to: RELATIONS_COPY.evidence,
	},
	[RELATIONS_COPY.implements]: {
		from: RELATIONS_COPY.implements,
		to: RELATIONS_COPY.implementedBy,
	},
	[RELATIONS_COPY.includes]: {
		from: RELATIONS_COPY.includes,
		to: RELATIONS_COPY.includedIn,
	},
	[RELATIONS_COPY.origin]: {
		from: RELATIONS_COPY.derived,
		to: RELATIONS_COPY.origin,
	},
	[RELATIONS_COPY.participant]: {
		from: RELATIONS_COPY.participant,
		to: RELATIONS_COPY.participant,
	},
	[RELATIONS_COPY.primarySpec]: {
		from: RELATIONS_COPY.primarySpec,
		to: RELATIONS_COPY.primarySpec,
	},
	[RELATIONS_COPY.related]: {
		from: RELATIONS_COPY.related,
		to: RELATIONS_COPY.related,
	},
	[RELATIONS_COPY.requiredForCompletion]: {
		from: RELATIONS_COPY.requiredForCompletion,
		to: RELATIONS_COPY.contextual,
	},
	[RELATIONS_COPY.supersedes]: {
		from: RELATIONS_COPY.supersedes,
		to: RELATIONS_COPY.supersededBy,
	},
};

export function inverseTypeLabel(
	type: RelationType,
	viewpoint: "from" | "to"
): string {
	return VIEW_LABELS[type][viewpoint];
}

export function parseRelationType(value: string): RelationType | null {
	if ((RELATION_TYPES as readonly string[]).includes(value)) {
		return value as RelationType;
	}
	return null;
}

export function parseRecordKind(value: string): RecordKind | null {
	if ((RECORD_KINDS as readonly string[]).includes(value)) {
		return value as RecordKind;
	}
	return null;
}

const GOAL_SOURCES = new Set<RecordKind>([
	"Work",
	"Milestone",
	"Project Release",
]);
const BLOCK_SOURCES = new Set<RecordKind>(["Work", "Decision", "Question"]);
const IMPLEMENT_SOURCES = new Set<RecordKind>([
	"Work",
	"GitHub PR",
	"Project Release",
]);
const IMPLEMENT_TARGETS = new Set<RecordKind>(["Decision", "Document"]);
const PARTICIPANT_SOURCES = new Set<RecordKind>([
	"User Research Session",
	"Feedback",
]);

const END_ALLOWED: Record<
	RelationType,
	(from: RecordRef, to: RecordRef) => boolean
> = {
	[RELATIONS_COPY.belongsToCompany]: (from, to) =>
		from.kind === "Contact" && to.kind === "Company",
	[RELATIONS_COPY.blocks]: (from, to) =>
		BLOCK_SOURCES.has(from.kind) && to.kind === "Work",
	[RELATIONS_COPY.contributesToGoal]: (from, to) =>
		GOAL_SOURCES.has(from.kind) && to.kind === "Project Goal",
	[RELATIONS_COPY.contributesToMilestone]: (from, to) =>
		from.kind === "Work" && to.kind === "Milestone",
	[RELATIONS_COPY.evidence]: (from, to) =>
		isKind(from.kind, EVIDENCE_SOURCE_KINDS) &&
		isKind(to.kind, EVIDENCE_TARGET_KINDS),
	[RELATIONS_COPY.implements]: (from, to) =>
		IMPLEMENT_SOURCES.has(from.kind) && IMPLEMENT_TARGETS.has(to.kind),
	[RELATIONS_COPY.includes]: (from, to) =>
		from.kind === "Work" && from.workType === "Feature" && to.kind === "Work",
	[RELATIONS_COPY.origin]: (from, to) =>
		isKind(from.kind, ORIGIN_SOURCE_KINDS) &&
		isKind(to.kind, MAIN_RECORD_KINDS),
	[RELATIONS_COPY.participant]: (from, to) =>
		PARTICIPANT_SOURCES.has(from.kind) && to.kind === "Contact",
	[RELATIONS_COPY.primarySpec]: (from, to) =>
		from.kind === "Work" && to.kind === "Document",
	[RELATIONS_COPY.related]: relatedEndsAllowed,
	[RELATIONS_COPY.requiredForCompletion]: (from, to) =>
		(from.kind === "Work" && to.kind === "GitHub PR") ||
		(from.kind === "GitHub PR" && to.kind === "Work"),
	[RELATIONS_COPY.supersedes]: (from, to) =>
		isKind(from.kind, SUPERSEDES_KINDS) && from.kind === to.kind,
};

function ownedComponentBlocked(
	type: RelationType,
	from: RecordRef,
	to: RecordRef
): boolean {
	const owned =
		isOwnedComponentKind(from.kind) || isOwnedComponentKind(to.kind);
	if (!owned) {
		return false;
	}
	if (type === RELATIONS_COPY.evidence && from.kind === "Session Test") {
		return false;
	}
	return !(type === RELATIONS_COPY.supersedes && from.kind === "Session Test");
}

function originLocationBlocked(input: {
	from: RecordRef;
	originLocation?: OriginLocationInput;
	type: RelationType;
}): string | null {
	if (!input.originLocation) {
		return null;
	}
	if (input.type !== RELATIONS_COPY.origin) {
		return "origin-location-not-allowed";
	}
	if (
		input.from.id !== input.originLocation.ownerId ||
		input.from.kind !== input.originLocation.ownerKind
	) {
		return "owned-component-not-an-end";
	}
	return null;
}

export function validateRelationEnds(input: {
	from: RecordRef;
	originLocation?: OriginLocationInput;
	to: RecordRef;
	type: RelationType;
}): { reason: string; status: "rejected" } | { status: "ok" } {
	if (input.from.id === input.to.id && input.from.kind === input.to.kind) {
		return { reason: "same-end", status: "rejected" };
	}
	if (ownedComponentBlocked(input.type, input.from, input.to)) {
		return { reason: "owned-component-not-an-end", status: "rejected" };
	}
	const locationReason = originLocationBlocked(input);
	if (locationReason) {
		return { reason: locationReason, status: "rejected" };
	}
	if (END_ALLOWED[input.type](input.from, input.to)) {
		return { status: "ok" };
	}
	return { reason: "ends-not-allowed", status: "rejected" };
}

export function catalogTypes() {
	return RELATION_TYPES.map((type) => ({
		genericUi: (GENERIC_RELATION_TYPES as readonly string[]).includes(type),
		inverse: inverseTypeLabel(type, "from"),
		type,
	}));
}
