import { z } from "zod";

export const DOCUMENTS_COPY = {
	addDocumentTemplate: "Add Document Template",
	body: "Body",
	convertToTemplate: "Convert to template",
	couldNotRender: "Could not render this block.",
	createDocument: "Create Document",
	createFromTemplate: "Create from template",
	document: "Document",
	documentTemplate: "Document Template",
	editableSource: "Editable source",
	forbiddenTemplatePayload:
		"A Document Template cannot carry history, relations, publish, archive, or Work Template fields.",
	general: "General",
	name: "Name",
	noDocuments: "No Documents yet.",
	persona: "Persona",
	personalReview: "Personal Review",
	placeholders: "Placeholders",
	plan: "Plan",
	prd: "PRD",
	researchNote: "Research Note",
	save: "Save",
	selectDocument: "Select a Document",
	skeleton: "Skeleton",
	spec: "Spec",
	title: "Title",
	type: "Type",
} as const;

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

export const DOCUMENT_TYPES = [
	"General",
	"PRD",
	"Plan",
	"Spec",
	"Research Note",
	"Persona",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

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

export interface DocumentView {
	body: string;
	id: string;
	liveFilePath: null;
	revision: number;
	scope: DocumentScope;
	title: string;
	type: DocumentType;
}

export type DocumentRejectionReason =
	| "invalid-command"
	| "project-not-found"
	| "title-required"
	| "unknown-document-type"
	| "document-not-found"
	| "template-not-found"
	| "name-required"
	| "forbidden-payload";

export type DocumentWriteOutcome =
	| { document: DocumentView; status: "committed" }
	| { document: DocumentView; status: "replayed" }
	| { reason: DocumentRejectionReason; status: "rejected" }
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
	liveBound: false;
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
	  };

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
