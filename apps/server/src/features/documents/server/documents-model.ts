import { diffLines } from "diff";
import { z } from "zod";

export const DOCUMENTS_COPY = {
	addDocumentTemplate: "Add Document Template",
	apply: "Apply",
	archive: "Archive",
	archived: "Archived",
	body: "Body",
	card: "Card",
	changeStatus: "Change status",
	close: "Close",
	compare: "Compare",
	conflictDraft: "Conflict Draft",
	convertInBulk: "Convert in bulk",
	convertToRecord: "Convert to record",
	convertToTechnicalDiagram: "Convert to Technical Diagram",
	convertToTemplate: "Convert to template",
	copy: "Copy",
	couldNotRender: "Could not render this block.",
	createDocument: "Create Document",
	createFolder: "Create folder",
	createFromConflictDraft: "Create Document",
	createFromTemplate: "Create from template",
	crossScopeParent: "A parent must be in the same ownership scope.",
	deleteConflictDraft: "Delete",
	depthExceeded: "This placement would exceed three Document levels.",
	document: "Document",
	documentTemplate: "Document Template",
	download: "Download",
	editableSource: "Editable source",
	folder: "Folder",
	forbiddenTemplatePayload:
		"A Document Template cannot carry history, relations, publish, archive, or Work Template fields.",
	general: "General",
	importedIndependentCopy: "Imported Independent Copy",
	launchPlan: "Launch Plan",
	liveWorkBlock: "Live Work block",
	name: "Name",
	noDocuments: "No Documents yet.",
	noFolder: "No folder",
	noParent: "No parent",
	openSourceRecord: "Open source record",
	parentDocument: "Parent Document",
	persona: "Persona",
	personalReview: "Personal Review",
	placeholders: "Placeholders",
	plan: "Plan",
	prd: "PRD",
	preview: "Preview",
	readOnlyLiveSection: "Read-only live section",
	researchNote: "Research Note",
	restore: "Restore",
	retrospective: "Retrospective",
	save: "Save",
	selectDocument: "Select a Document",
	skeleton: "Skeleton",
	spec: "Spec",
	title: "Title",
	type: "Type",
	unarchive: "Unarchive",
	version: "Version",
	versionPinnedEvidence: "Version-pinned evidence",
	versions: "Versions",
} as const;

export const DOCUMENT_MAX_DEPTH = 3;

export const PERSONAL_REVIEW_HEADINGS = [
	"Period",
	"What changed?",
	"What worked?",
	"What was difficult?",
	"Decisions and learnings",
	"What will I change next?",
	"Related records",
] as const;

export const PERSONAL_REVIEW_KIND = "personal-review" as const;

export function personalReviewSkeleton(): string {
	return PERSONAL_REVIEW_HEADINGS.map((heading) => `## ${heading}\n`).join(
		"\n"
	);
}

export const DOCUMENT_PLACEHOLDER_PATTERN = /\{\{([a-z][a-z0-9_]*)\}\}/g;

export function documentTemplatePlaceholders(
	skeleton: string
): readonly string[] {
	const names: string[] = [];
	const seen = new Set<string>();
	const pattern = new RegExp(DOCUMENT_PLACEHOLDER_PATTERN.source, "g");
	for (const match of skeleton.matchAll(pattern)) {
		const [, name] = match;
		if (!name || seen.has(name)) {
			continue;
		}
		seen.add(name);
		names.push(name);
	}
	return names;
}

export function applyDocumentTemplatePlaceholders(
	skeleton: string,
	values: Record<string, string>
): string {
	return skeleton.replace(
		DOCUMENT_PLACEHOLDER_PATTERN,
		(token, name: string) => values[name] ?? token
	);
}

export const FORBIDDEN_DOCUMENT_TEMPLATE_PAYLOAD_KEYS = [
	"archive",
	"history",
	"marketplace",
	"publish",
	"relations",
	"share",
	"workType",
] as const;

export const CONVERT_RECORD_KINDS = [
	"Work",
	"Decision",
	"Risk",
	"Assumption",
	"Open Question",
] as const;

export type ConvertRecordKind = (typeof CONVERT_RECORD_KINDS)[number];

export const ORIGINAL_MERMAID_OUTCOMES = [
	"independent",
	"live-reference",
] as const;

export type OriginalMermaidOutcome = (typeof ORIGINAL_MERMAID_OUTCOMES)[number];

export const TECHNICAL_DIAGRAM_TARGET_TYPES = [
	"Technical Architecture",
	"Data Model",
	"Technical Sequence",
] as const;

export type TechnicalDiagramTargetType =
	(typeof TECHNICAL_DIAGRAM_TARGET_TYPES)[number];

export const DOCUMENT_TYPES = [
	"General",
	"PRD",
	"Plan",
	"Spec",
	"Research Note",
	"Persona",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STARTER_SKELETONS = [
	{
		emptyHeadings: [
			"Context",
			"Goals",
			"Behaviors",
			"Pain Points",
			"Constraints",
			"Evidence",
			"Open Questions",
		],
		name: DOCUMENTS_COPY.persona,
		type: "Persona",
	},
	{
		emptyHeadings: [
			"Period",
			"What worked?",
			"What did not?",
			"What did we learn?",
			"Decisions",
			"Next changes",
			"Related records",
		],
		name: DOCUMENTS_COPY.retrospective,
		type: "General",
	},
	{
		emptyHeadings: [
			"Release",
			"Audience",
			"Scope",
			"Readiness",
			"Communication",
			"Launch steps",
			"Risks",
			"Observation plan",
			"Related records",
		],
		name: DOCUMENTS_COPY.launchPlan,
		type: "General",
	},
] as const;

export function emptyHeadingDocumentBody(headings: readonly string[]): string {
	return headings.map((heading) => `## ${heading}`).join("\n\n");
}

export const DOCUMENT_SCOPE_KIND = {
	personalWiki: "personal-wiki",
	project: "project",
} as const;

export const documentScopeSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal(DOCUMENT_SCOPE_KIND.project),
		projectId: z.string().min(1),
	}),
	z.object({
		kind: z.literal(DOCUMENT_SCOPE_KIND.personalWiki),
	}),
]);

export type DocumentScope = z.infer<typeof documentScopeSchema>;

export const materializeStarterSkeletonDocumentsPayloadSchema = z.object({
	projectId: z.string().min(1),
});

export type MaterializeStarterSkeletonDocumentsPayload = z.infer<
	typeof materializeStarterSkeletonDocumentsPayloadSchema
>;

export const materializeStarterSkeletonDocumentsCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: materializeStarterSkeletonDocumentsPayloadSchema,
	workspaceId: z.string().min(1),
});

export type MaterializeStarterSkeletonDocumentsCommand = z.infer<
	typeof materializeStarterSkeletonDocumentsCommandSchema
>;

export type StarterSkeletonDocumentsOutcome =
	| { documents: DocumentView[]; status: "committed" }
	| { documents: DocumentView[]; status: "replayed" }
	| { conflict: "Conflict"; status: "conflict" }
	| { reason: DocumentRejectionReason; status: "rejected" };

export const createDocumentPayloadSchema = z.object({
	body: z.string().optional(),
	scope: documentScopeSchema,
	title: z.string().optional(),
	type: z.string().optional(),
});

export type CreateDocumentPayload = z.infer<typeof createDocumentPayloadSchema>;

export const createDocumentCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createDocumentPayloadSchema,
	workspaceId: z.string().min(1),
});

export type CreateDocumentCommand = z.infer<typeof createDocumentCommandSchema>;

export const updateDocumentPayloadSchema = z.object({
	body: z.string().optional(),
	documentId: z.string().min(1),
	title: z.string().optional(),
	type: z.string().optional(),
});

export const updateDocumentCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: updateDocumentPayloadSchema,
	workspaceId: z.string().min(1),
});

export type UpdateDocumentCommand = z.infer<typeof updateDocumentCommandSchema>;

export const createDocumentFolderPayloadSchema = z.object({
	name: z.string().min(1),
	scope: documentScopeSchema,
});

export const createDocumentFolderCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createDocumentFolderPayloadSchema,
	workspaceId: z.string().min(1),
});

export type CreateDocumentFolderCommand = z.infer<
	typeof createDocumentFolderCommandSchema
>;

export const placeDocumentPayloadSchema = z.object({
	documentId: z.string().min(1),
	folderId: z.string().nullable(),
	parentId: z.string().nullable(),
});

export const placeDocumentCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: placeDocumentPayloadSchema,
	workspaceId: z.string().min(1),
});

export type PlaceDocumentCommand = z.infer<typeof placeDocumentCommandSchema>;

export const archiveDocumentCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: z.object({ documentId: z.string().min(1) }),
	workspaceId: z.string().min(1),
});

export type ArchiveDocumentCommand = z.infer<
	typeof archiveDocumentCommandSchema
>;

export interface DocumentInDocTag {
	id: string;
	name: string;
}

export interface DocumentChildCard {
	documentId: string;
	imageUrl: string | null;
	preview: string;
	title: string;
	type: DocumentType;
}

export interface DocumentView {
	archived: boolean;
	body: string;
	childCards: readonly DocumentChildCard[];
	folderId: string | null;
	id: string;
	inDocTags: readonly DocumentInDocTag[];
	liveFilePath: null;
	parentId: string | null;
	revision: number;
	scope: DocumentScope;
	title: string;
	type: DocumentType;
}

export interface DocumentFolderView {
	id: string;
	name: string;
	revision: number;
	scope: DocumentScope;
}

export interface DocumentVersionView {
	body: string;
	documentId: string;
	id: string;
	revision: number;
	title: string;
	type: DocumentType;
}

export type DocumentVersionHunkKind = "added" | "removed" | "unchanged";

export interface DocumentVersionHunk {
	kind: DocumentVersionHunkKind;
	text: string;
}

export interface DocumentVersionCompare {
	hunks: readonly DocumentVersionHunk[];
	left: DocumentVersionView;
	right: DocumentVersionView;
}

export interface DocumentConflictDraftView {
	body: string;
	documentId: string;
	documentRevision: number;
	id: string;
	rejectedBaseRevision: number;
	title: string;
	type: DocumentType;
}

export type ConflictDraftHunkChoice = "current" | "draft";

export interface DocumentConflictDraftCompare {
	current: DocumentView;
	draft: DocumentConflictDraftView;
	hunks: readonly DocumentVersionHunk[];
}

export const conflictDraftHunkChoiceSchema = z.enum(["current", "draft"]);

export function mergeConflictDraftHunks(
	currentBody: string,
	draftBody: string,
	choices: readonly ConflictDraftHunkChoice[]
): string | null {
	const hunks = presentDocumentVersionDiff(currentBody, draftBody);
	if (choices.length !== hunks.length) {
		return null;
	}
	let merged = "";
	for (const [index, hunk] of hunks.entries()) {
		if (hunk.kind === "unchanged") {
			merged += hunk.text;
			continue;
		}
		if (hunk.kind === "removed" && choices[index] === "current") {
			merged += hunk.text;
		}
		if (hunk.kind === "added" && choices[index] === "draft") {
			merged += hunk.text;
		}
	}
	return merged;
}

export const applyConflictDraftPayloadSchema = z.object({
	documentId: z.string().min(1),
	hunkChoices: z.array(conflictDraftHunkChoiceSchema).min(1),
	title: z.string().optional(),
});

export const applyConflictDraftCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: applyConflictDraftPayloadSchema,
	workspaceId: z.string().min(1),
});

export type ApplyConflictDraftCommand = z.infer<
	typeof applyConflictDraftCommandSchema
>;

export const spawnDocumentFromConflictDraftPayloadSchema = z.object({
	body: z.string().optional(),
	documentId: z.string().min(1),
	title: z.string().optional(),
});

export const spawnDocumentFromConflictDraftCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: spawnDocumentFromConflictDraftPayloadSchema,
	workspaceId: z.string().min(1),
});

export type SpawnDocumentFromConflictDraftCommand = z.infer<
	typeof spawnDocumentFromConflictDraftCommandSchema
>;

export const deleteConflictDraftPayloadSchema = z.object({
	documentId: z.string().min(1),
});

export const deleteConflictDraftCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: deleteConflictDraftPayloadSchema,
	workspaceId: z.string().min(1),
});

export type DeleteConflictDraftCommand = z.infer<
	typeof deleteConflictDraftCommandSchema
>;

export type DocumentConflictDraftWriteOutcome =
	| { document: DocumentView; status: "committed" }
	| { document: DocumentView; status: "replayed" }
	| { reason: DocumentRejectionReason; status: "rejected" }
	| { conflict: "Conflict"; status: "conflict" };

export type SpawnDocumentFromConflictDraftOutcome =
	| { document: DocumentView; status: "committed" }
	| { document: DocumentView; status: "replayed" }
	| { reason: DocumentRejectionReason; status: "rejected" }
	| { conflict: "Conflict"; status: "conflict" };

export const restoreDocumentPayloadSchema = z.object({
	documentId: z.string().min(1),
	versionRevision: z.number().int().positive(),
});

export const restoreDocumentCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: restoreDocumentPayloadSchema,
	workspaceId: z.string().min(1),
});

export type RestoreDocumentCommand = z.infer<
	typeof restoreDocumentCommandSchema
>;

export type DocumentRejectionReason =
	| "invalid-command"
	| "project-not-found"
	| "title-required"
	| "unknown-document-type"
	| "document-not-found"
	| "conflict-draft-not-found"
	| "template-not-found"
	| "name-required"
	| "forbidden-payload"
	| "version-not-found"
	| "live-section-cycle"
	| "preview-required"
	| "preview-mismatch"
	| "partial-success-forbidden"
	| "unsupported-record-type"
	| "list-required"
	| "target-not-found"
	| "broken-mermaid"
	| "cycle"
	| "cross-scope-parent"
	| "depth-exceeded"
	| "folder-not-found"
	| "parent-not-found";

export type DocumentHierarchyPreview =
	| {
			depth: number;
			folderId: string | null;
			parentId: string | null;
			status: "ok";
	  }
	| { reason: DocumentRejectionReason; status: "blocked" };

export type DocumentArchivePreview =
	| {
			childTitles: readonly string[];
			documentId: string;
			status: "ok";
	  }
	| { reason: DocumentRejectionReason; status: "blocked" };

export type DocumentFolderWriteOutcome =
	| { folder: DocumentFolderView; status: "committed" }
	| { folder: DocumentFolderView; status: "replayed" }
	| { reason: DocumentRejectionReason; status: "rejected" }
	| { conflict: "Conflict"; status: "conflict" };

export type DocumentWriteOutcome =
	| { document: DocumentView; status: "committed" }
	| { document: DocumentView; status: "replayed" }
	| { reason: DocumentRejectionReason; status: "rejected" }
	| {
			conflict: typeof DOCUMENTS_COPY.conflictDraft;
			document: DocumentView;
			draft: DocumentConflictDraftView;
			status: "conflict";
	  }
	| { conflict: "Conflict"; status: "conflict" };

export const createDocumentTemplatePayloadSchema = z
	.object({
		documentType: z.string().optional(),
		name: z.string().optional(),
		scope: documentScopeSchema,
		skeleton: z.string().optional(),
	})
	.passthrough();

export const createDocumentTemplateCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createDocumentTemplatePayloadSchema,
	workspaceId: z.string().min(1),
});

export type CreateDocumentTemplateCommand = z.infer<
	typeof createDocumentTemplateCommandSchema
>;

export const updateDocumentTemplatePayloadSchema = z
	.object({
		documentType: z.string().optional(),
		name: z.string().optional(),
		skeleton: z.string().optional(),
		templateId: z.string().min(1),
	})
	.passthrough();

export const updateDocumentTemplateCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: updateDocumentTemplatePayloadSchema,
	workspaceId: z.string().min(1),
});

export type UpdateDocumentTemplateCommand = z.infer<
	typeof updateDocumentTemplateCommandSchema
>;

export const convertDocumentToTemplatePayloadSchema = z
	.object({
		documentId: z.string().min(1),
		name: z.string().optional(),
	})
	.passthrough();

export const convertDocumentToTemplateCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: convertDocumentToTemplatePayloadSchema,
	workspaceId: z.string().min(1),
});

export type ConvertDocumentToTemplateCommand = z.infer<
	typeof convertDocumentToTemplateCommandSchema
>;

export const instantiateDocumentFromTemplatePayloadSchema = z
	.object({
		placeholderValues: z.record(z.string(), z.string()).optional(),
		preparedKind: z.literal(PERSONAL_REVIEW_KIND).optional(),
		scope: documentScopeSchema.optional(),
		templateId: z.string().optional(),
		title: z.string().optional(),
	})
	.passthrough();

export const instantiateDocumentFromTemplateCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: instantiateDocumentFromTemplatePayloadSchema,
	workspaceId: z.string().min(1),
});

export type InstantiateDocumentFromTemplateCommand = z.infer<
	typeof instantiateDocumentFromTemplateCommandSchema
>;

export interface DocumentTemplateView {
	documentType: DocumentType;
	id: string;
	name: string;
	placeholders: readonly string[];
	revision: number;
	scope: DocumentScope;
	skeleton: string;
}

export interface ConvertDocumentToTemplatePreview {
	name: string;
	placeholders: readonly string[];
	skeleton: string;
	sourceDocumentId: string;
	sourceRevision: number;
	sourceTitle: string;
}

export type ConvertDocumentToTemplatePreviewOutcome =
	| { preview: ConvertDocumentToTemplatePreview; status: "ok" }
	| { reason: DocumentRejectionReason; status: "rejected" };

export type DocumentTemplateWriteOutcome =
	| { status: "committed"; template: DocumentTemplateView }
	| { status: "replayed"; template: DocumentTemplateView }
	| { reason: DocumentRejectionReason; status: "rejected" }
	| { conflict: "Conflict"; status: "conflict" };

export interface DocumentLiveFiles {
	writeMarkdown: (path: string, contents: string) => void;
}

export function createMemoryLiveFiles(): DocumentLiveFiles & {
	writes: readonly { contents: string; path: string }[];
} {
	const writes: { contents: string; path: string }[] = [];
	return {
		writeMarkdown(path, contents) {
			writes.push({ contents, path });
		},
		writes,
	};
}

export function isDocumentType(value: string): value is DocumentType {
	return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function presentDocumentVersionDiff(
	leftBody: string,
	rightBody: string
): DocumentVersionHunk[] {
	return diffLines(leftBody, rightBody).map((part) => ({
		kind: hunkKind(part),
		text: part.value,
	}));
}

function hunkKind(part: {
	added?: boolean;
	removed?: boolean;
}): DocumentVersionHunkKind {
	if (part.added) {
		return "added";
	}
	if (part.removed) {
		return "removed";
	}
	return "unchanged";
}

export function documentsCatalog(): {
	copy: typeof DOCUMENTS_COPY;
	personalReview: {
		headings: typeof PERSONAL_REVIEW_HEADINGS;
		kind: typeof PERSONAL_REVIEW_KIND;
		name: typeof DOCUMENTS_COPY.personalReview;
		skeleton: string;
	};
	types: readonly DocumentType[];
} {
	return {
		copy: DOCUMENTS_COPY,
		personalReview: {
			headings: PERSONAL_REVIEW_HEADINGS,
			kind: PERSONAL_REVIEW_KIND,
			name: DOCUMENTS_COPY.personalReview,
			skeleton: personalReviewSkeleton(),
		},
		types: DOCUMENT_TYPES,
	};
}

export type DocumentFenceLanguage = string;

export type DocumentBodyProcessorResult =
	| { ok: true }
	| { error: string; ok: false };

export interface DocumentBodyProcessors {
	latex: (source: string) => DocumentBodyProcessorResult;
	mermaid: (source: string) => DocumentBodyProcessorResult;
}

export type DocumentLiveSurface =
	| "live-work"
	| "live-collection"
	| "live-section"
	| "live-diagram"
	| "live-diagram-view"
	| "inline-reference";

export type LiveResolutionStatus = "ok" | "broken";

export interface DocumentBrokenTarget {
	kind: DocumentLiveSurface;
	reason: string;
	resolution: "broken";
	sourceRecordId: string;
}

export interface DocumentLiveWorkFields {
	actions: {
		changeStatus: typeof DOCUMENTS_COPY.changeStatus;
		close: typeof DOCUMENTS_COPY.close;
		openSourceRecord: typeof DOCUMENTS_COPY.openSourceRecord;
	};
	id: string;
	key: string;
	kind: "live-work";
	label: typeof DOCUMENTS_COPY.liveWorkBlock;
	plannedStart: string | null;
	priority: string | null;
	projectId: string;
	resolution: "ok";
	revision: number;
	targetDate: string | null;
	title: string;
	type: string;
	workStatus: string;
}

export interface DocumentLiveCollectionFields {
	id: string;
	kind: "live-collection";
	membershipRuleId: string;
	name: string;
	openSourceRecord: typeof DOCUMENTS_COPY.openSourceRecord;
	presentationId: string;
	resolution: "ok";
}

export interface DocumentLiveSectionFields {
	heading: string;
	kind: "live-section";
	label: typeof DOCUMENTS_COPY.readOnlyLiveSection;
	openSourceRecord: typeof DOCUMENTS_COPY.openSourceRecord;
	resolution: "ok";
	sectionId: string;
	sourceDocumentId: string;
	sourceTitle: string;
	text: string;
	updatedAt: string;
}

export interface DocumentLiveDiagramFields {
	authorityMode: typeof DOCUMENTS_COPY.importedIndependentCopy | null;
	canvas: false;
	id: string;
	kind: "live-diagram" | "live-diagram-view";
	openSourceRecord: typeof DOCUMENTS_COPY.openSourceRecord;
	readOnly: true;
	resolution: "ok";
	title: string;
}

export interface DocumentInlineReferenceFields {
	kind: "inline-reference";
	openSourceRecord: typeof DOCUMENTS_COPY.openSourceRecord;
	recordKind: string;
	resolution: "ok";
	sourceRecordId: string;
	title: string;
}

export type DocumentBodyBlock =
	| { kind: "markdown"; text: string }
	| { kind: "fenced-code"; language: string; source: string }
	| {
			error?: string;
			kind: "mermaid";
			source: string;
			status: "ok" | "error";
	  }
	| {
			error?: string;
			kind: "latex";
			source: string;
			status: "ok" | "error";
	  }
	| { kind: "live-marker"; language: string; source: string }
	| DocumentBrokenTarget
	| DocumentLiveWorkFields
	| DocumentLiveCollectionFields
	| DocumentLiveSectionFields
	| DocumentLiveDiagramFields
	| DocumentInlineReferenceFields;

export interface DocumentBodyPresentation {
	blocks: readonly DocumentBodyBlock[];
	source: string;
}

const MERMAID_START =
	/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart)\b/;
const FIRST_LINE = /\r?\n/;
const FENCE_OPEN = /^```([^\n`]*)$/;
const LATEX_BLOCK = /\$\$([\s\S]+?)\$\$/g;
const LATEX_INLINE = /(?<!\$)\$(?!\$)([^$\n]+)\$(?!\$)/g;

function defaultMermaid(source: string): DocumentBodyProcessorResult {
	const line = source.trim().split(FIRST_LINE, 1)[0] ?? "";
	if (MERMAID_START.test(line)) {
		return { ok: true };
	}
	return { error: DOCUMENTS_COPY.couldNotRender, ok: false };
}

function defaultLatex(source: string): DocumentBodyProcessorResult {
	if (source.trim().length === 0) {
		return { error: DOCUMENTS_COPY.couldNotRender, ok: false };
	}
	return { ok: true };
}

export function defaultDocumentBodyProcessors(): DocumentBodyProcessors {
	return {
		latex: defaultLatex,
		mermaid: defaultMermaid,
	};
}

export function presentDocumentBody(
	body: string,
	processors: DocumentBodyProcessors = defaultDocumentBodyProcessors()
): DocumentBodyPresentation {
	const blocks: DocumentBodyBlock[] = [];
	const lines = body.split("\n");
	let markdownLines: string[] = [];
	let fenceLanguage: string | null = null;
	let fenceLines: string[] = [];

	const flushMarkdown = () => {
		if (markdownLines.length === 0) {
			return;
		}
		pushMarkdown(blocks, markdownLines.join("\n"), processors);
		markdownLines = [];
	};

	for (const line of lines) {
		if (fenceLanguage === null) {
			const open = FENCE_OPEN.exec(line);
			if (open) {
				flushMarkdown();
				fenceLanguage = open[1]?.trim() ?? "";
				fenceLines = [];
				continue;
			}
			markdownLines.push(line);
			continue;
		}
		if (line.startsWith("```")) {
			blocks.push(
				presentFence(fenceLanguage, fenceLines.join("\n"), processors)
			);
			fenceLanguage = null;
			fenceLines = [];
			continue;
		}
		fenceLines.push(line);
	}
	if (fenceLanguage !== null) {
		blocks.push(presentFence(fenceLanguage, fenceLines.join("\n"), processors));
	}
	flushMarkdown();
	return { blocks, source: body };
}

function presentFence(
	language: string,
	source: string,
	processors: DocumentBodyProcessors
): DocumentBodyBlock {
	const lang = language.toLowerCase();
	if (lang.startsWith("live-")) {
		return { kind: "live-marker", language: lang, source };
	}
	if (lang === "mermaid") {
		return processedBlock("mermaid", source, processors.mermaid(source));
	}
	if (lang === "latex" || lang === "math") {
		return processedBlock("latex", source, processors.latex(source));
	}
	return { kind: "fenced-code", language, source };
}

function processedBlock(
	kind: "mermaid" | "latex",
	source: string,
	result: DocumentBodyProcessorResult
): DocumentBodyBlock {
	if (result.ok) {
		return { kind, source, status: "ok" };
	}
	return {
		error: result.error,
		kind,
		source,
		status: "error",
	};
}

function pushMarkdown(
	blocks: DocumentBodyBlock[],
	text: string,
	processors: DocumentBodyProcessors
): void {
	if (text.length === 0) {
		return;
	}
	let cursor = 0;
	const latexPattern = new RegExp(
		`${LATEX_BLOCK.source}|${LATEX_INLINE.source}`,
		"g"
	);
	const matches = [...text.matchAll(latexPattern)];
	if (matches.length === 0) {
		blocks.push({ kind: "markdown", text });
		return;
	}
	for (const match of matches) {
		const index = match.index ?? 0;
		if (index > cursor) {
			blocks.push({ kind: "markdown", text: text.slice(cursor, index) });
		}
		const source = match[1] ?? match[2] ?? "";
		blocks.push(processedBlock("latex", source, processors.latex(source)));
		cursor = index + match[0].length;
	}
	if (cursor < text.length) {
		blocks.push({ kind: "markdown", text: text.slice(cursor) });
	}
}

const INLINE_CODE = /`[^`]*`/g;
const MARKDOWN_LINK = /\[[^\]]*\]\([^)]*\)/g;
const AUTOLINK = /<https?:\/\/[^>]+>/gi;
const BARE_URL = /https?:\/\/\S+/gi;
const ESCAPED_HASH = /\\#/g;
const TAG_TOKEN = /(^|[^A-Za-z0-9_./-])#([A-Za-z][A-Za-z0-9_./-]*)/g;

export interface InDocTagResolution {
	ignored: readonly string[];
	resolved: readonly DocumentInDocTag[];
}

export function resolveInDocTags(
	body: string,
	dictionary: readonly DocumentInDocTag[]
): InDocTagResolution {
	const byName = new Map(dictionary.map((tag) => [tag.name, tag] as const));
	const resolved: DocumentInDocTag[] = [];
	const seenIds = new Set<string>();
	const ignored: string[] = [];
	const seenIgnored = new Set<string>();
	for (const token of collectInDocTokens(body)) {
		const tag = byName.get(token);
		if (!tag) {
			if (!seenIgnored.has(token)) {
				seenIgnored.add(token);
				ignored.push(token);
			}
			continue;
		}
		if (seenIds.has(tag.id)) {
			continue;
		}
		seenIds.add(tag.id);
		resolved.push({ id: tag.id, name: tag.name });
	}
	return { ignored, resolved };
}

function collectInDocTokens(body: string): string[] {
	const tokens: string[] = [];
	for (const block of presentDocumentBody(body).blocks) {
		if (block.kind !== "markdown") {
			continue;
		}
		const prose = maskNonTagRegions(block.text);
		TAG_TOKEN.lastIndex = 0;
		for (const match of prose.matchAll(TAG_TOKEN)) {
			const [, , token] = match;
			if (token) {
				tokens.push(token);
			}
		}
	}
	return tokens;
}

function maskNonTagRegions(text: string): string {
	return text
		.replace(INLINE_CODE, " ")
		.replace(MARKDOWN_LINK, " ")
		.replace(AUTOLINK, " ")
		.replace(BARE_URL, " ")
		.replace(ESCAPED_HASH, " ");
}

const MARKDOWN_IMAGE = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const SUPPORTED_IMAGE = /\.(?:gif|jpe?g|png|webp)(?:\?|#|$)/i;
const HEADING_LINE = /^#{1,6}\s+/;
const PREVIEW_LIMIT = 160;

function firstSupportedImageUrl(text: string): string | null {
	MARKDOWN_IMAGE.lastIndex = 0;
	for (const match of text.matchAll(MARKDOWN_IMAGE)) {
		const source = match[1]?.trim() ?? "";
		if (source.length > 0 && SUPPORTED_IMAGE.test(source)) {
			return source;
		}
	}
	return null;
}

function firstMeaningfulProse(text: string): string {
	MARKDOWN_IMAGE.lastIndex = 0;
	const lines = text
		.replace(MARKDOWN_IMAGE, " ")
		.replace(INLINE_CODE, " ")
		.replace(MARKDOWN_LINK, " ")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !HEADING_LINE.test(line));
	return lines[0]?.slice(0, PREVIEW_LIMIT) ?? "";
}

export function presentDocumentChildCard(input: {
	body: string;
	documentId: string;
	title: string;
	type: DocumentType;
}): DocumentChildCard {
	let imageUrl: string | null = null;
	let preview = "";
	for (const block of presentDocumentBody(input.body).blocks) {
		if (block.kind !== "markdown") {
			continue;
		}
		if (imageUrl === null) {
			imageUrl = firstSupportedImageUrl(block.text);
		}
		if (preview.length === 0) {
			preview = firstMeaningfulProse(block.text);
		}
	}
	return {
		documentId: input.documentId,
		imageUrl,
		preview: preview || `${input.title} · ${input.type}`,
		title: input.title,
		type: input.type,
	};
}
