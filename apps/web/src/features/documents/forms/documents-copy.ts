export const DOCUMENT_TYPES = [
	"General",
	"PRD",
	"Plan",
	"Spec",
	"Research Note",
	"Persona",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENTS_COPY = {
	archive: "Archive",
	archived: "Archived",
	body: "Body",
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
	unarchive: "Unarchive",
} as const;

export function documentScopeFor(
	projectId: string | null
): { kind: "personal-wiki" } | { kind: "project"; projectId: string } {
	if (projectId) {
		return { kind: "project", projectId };
	}
	return { kind: "personal-wiki" };
}
