import { z } from "zod";

export const DOCUMENTS_COPY = {
	archive: "Archive",
	archived: "Archived",
	body: "Body",
	card: "Card",
	couldNotRender: "Could not render this block.",
	createDocument: "Create Document",
	createFolder: "Create folder",
	crossScopeParent: "A parent must be in the same ownership scope.",
	depthExceeded: "This placement would exceed three Document levels.",
	document: "Document",
	editableSource: "Editable source",
	folder: "Folder",
	general: "General",
	noDocuments: "No Documents yet.",
	noFolder: "No folder",
	noParent: "No parent",
	parentDocument: "Parent Document",
	persona: "Persona",
	plan: "Plan",
	prd: "PRD",
	researchNote: "Research Note",
	save: "Save",
	selectDocument: "Select a Document",
	spec: "Spec",
	title: "Title",
	type: "Type",
	unarchive: "Unarchive",
} as const;

export const DOCUMENT_MAX_DEPTH = 3;

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

export type DocumentRejectionReason =
	| "cycle"
	| "cross-scope-parent"
	| "depth-exceeded"
	| "document-not-found"
	| "folder-not-found"
	| "invalid-command"
	| "parent-not-found"
	| "project-not-found"
	| "title-required"
	| "unknown-document-type";

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
