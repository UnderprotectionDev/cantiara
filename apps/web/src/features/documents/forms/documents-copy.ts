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
	body: "Body",
	couldNotRender: "Could not render this block.",
	createDocument: "Create Document",
	document: "Document",
	editableSource: "Editable source",
	general: "General",
	noDocuments: "No Documents yet.",
	persona: "Persona",
	plan: "Plan",
	prd: "PRD",
	researchNote: "Research Note",
	save: "Save",
	selectDocument: "Select a Document",
	spec: "Spec",
	title: "Title",
	type: "Type",
} as const;

export function documentScopeFor(
	projectId: string | null
): { kind: "personal-wiki" } | { kind: "project"; projectId: string } {
	if (projectId) {
		return { kind: "project", projectId };
	}
	return { kind: "personal-wiki" };
}
