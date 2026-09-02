import { z } from "zod";

export const DOCUMENTS_COPY = {
	body: "Body",
	couldNotRender: "Could not render this block.",
	createDocument: "Create Document",
	document: "Document",
	editableSource: "Editable source",
	general: "General",
	launchPlan: "Launch Plan",
	noDocuments: "No Documents yet.",
	persona: "Persona",
	plan: "Plan",
	prd: "PRD",
	researchNote: "Research Note",
	retrospective: "Retrospective",
	save: "Save",
	selectDocument: "Select a Document",
	spec: "Spec",
	title: "Title",
	type: "Type",
} as const;

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
	| "document-not-found";

export type DocumentWriteOutcome =
	| { document: DocumentView; status: "committed" }
	| { document: DocumentView; status: "replayed" }
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
	types: readonly DocumentType[];
} {
	return {
		copy: DOCUMENTS_COPY,
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
