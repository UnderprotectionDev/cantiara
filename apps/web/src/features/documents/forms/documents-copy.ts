export const DOCUMENT_TYPES = [
	"General",
	"PRD",
	"Plan",
	"Spec",
	"Research Note",
	"Persona",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

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

export const DOCUMENTS_COPY = {
	addDocumentTemplate: "Add Document Template",
	body: "Body",
	changeStatus: "Change status",
	close: "Close",
	compare: "Compare",
	convertInBulk: "Convert in bulk",
	convertToRecord: "Convert to record",
	convertToTechnicalDiagram: "Convert to Technical Diagram",
	convertToTemplate: "Convert to template",
	couldNotRender: "Could not render this block.",
	createDocument: "Create Document",
	createFromTemplate: "Create from template",
	document: "Document",
	documentTemplate: "Document Template",
	editableSource: "Editable source",
	general: "General",
	importedIndependentCopy: "Imported Independent Copy",
	liveWorkBlock: "Live Work block",
	name: "Name",
	noDocuments: "No Documents yet.",
	openSourceRecord: "Open source record",
	persona: "Persona",
	personalReview: "Personal Review",
	pinEvidence: "Version-pinned evidence",
	placeholders: "Placeholders",
	plan: "Plan",
	prd: "PRD",
	preview: "Preview",
	readOnlyLiveSection: "Read-only live section",
	researchNote: "Research Note",
	restore: "Restore",
	save: "Save",
	selectDocument: "Select a Document",
	skeleton: "Skeleton",
	spec: "Spec",
	title: "Title",
	toolbar: {
		alignCenter: "Align center",
		alignJustify: "Justify",
		alignLeft: "Align left",
		alignRight: "Align right",
		applyLink: "Apply",
		blockquote: "Quote",
		bold: "Bold",
		bulletList: "Bullet list",
		code: "Code",
		heading: "Heading",
		heading1: "Heading 1",
		heading2: "Heading 2",
		heading3: "Heading 3",
		highlight: "Highlight",
		inlineCode: "Inline code",
		italic: "Italic",
		latex: "LaTeX",
		link: "Link",
		mermaid: "Mermaid",
		orderedList: "Numbered list",
		paragraph: "Paragraph",
		redo: "Redo",
		strike: "Strikethrough",
		subscript: "Subscript",
		superscript: "Superscript",
		table: "Table",
		underline: "Underline",
		undo: "Undo",
	},
	type: "Type",
	version: "Version",
	versions: "Versions",
} as const;

export function documentScopeFor(
	projectId: string | null
): { kind: "personal-wiki" } | { kind: "project"; projectId: string } {
	if (projectId) {
		return { kind: "project", projectId };
	}
	return { kind: "personal-wiki" };
}

export const PERSONAL_REVIEW_KIND = "personal-review" as const;
