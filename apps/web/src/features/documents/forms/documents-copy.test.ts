import { expect, test } from "vitest";

import {
	DOCUMENT_TYPES,
	DOCUMENTS_COPY,
	documentScopeFor,
} from "./documents-copy";

test("English Document labels stay Document and the six type names", () => {
	expect(DOCUMENTS_COPY.document).toBe("Document");
	expect(DOCUMENTS_COPY.createDocument).toBe("Create Document");
	expect(DOCUMENTS_COPY.couldNotRender).toBe("Could not render this block.");
	expect(DOCUMENTS_COPY.editableSource).toBe("Editable source");
	expect(DOCUMENTS_COPY.toolbar.mermaid).toBe("Mermaid");
	expect(DOCUMENTS_COPY.toolbar.latex).toBe("LaTeX");
	expect(DOCUMENT_TYPES).toEqual([
		"General",
		"PRD",
		"Plan",
		"Spec",
		"Research Note",
		"Persona",
	]);
	expect(documentScopeFor("project-1")).toEqual({
		kind: "project",
		projectId: "project-1",
	});
	expect(documentScopeFor(null)).toEqual({ kind: "personal-wiki" });
});
