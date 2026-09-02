import { expect, test } from "vitest";

import {
	DOCUMENT_TYPES,
	DOCUMENTS_COPY,
	documentScopeFor,
} from "./documents-copy";

const DISCOVERY_COPY_PATTERN =
	/All Documents|Smart Collection|Trash|Unpublish/i;

test("English Document labels stay Document and the six type names", () => {
	expect(DOCUMENTS_COPY.document).toBe("Document");
	expect(DOCUMENTS_COPY.archive).toBe("Archive");
	expect(DOCUMENTS_COPY.archived).toBe("Archived");
	expect(DOCUMENTS_COPY.unarchive).toBe("Unarchive");
	expect(DOCUMENTS_COPY.folder).toBe("Folder");
	expect(DOCUMENTS_COPY.parentDocument).toBe("Parent Document");
	expect(DOCUMENTS_COPY.createFolder).toBe("Create folder");
	expect(JSON.stringify(DOCUMENTS_COPY)).not.toMatch(DISCOVERY_COPY_PATTERN);
	expect(DOCUMENTS_COPY.createDocument).toBe("Create Document");
	expect(DOCUMENTS_COPY.couldNotRender).toBe("Could not render this block.");
	expect(DOCUMENTS_COPY.editableSource).toBe("Editable source");
	expect(DOCUMENTS_COPY.toolbar.mermaid).toBe("Mermaid");
	expect(DOCUMENTS_COPY.toolbar.latex).toBe("LaTeX");
	expect(DOCUMENTS_COPY.toolbar.undo).toBe("Undo");
	expect(DOCUMENTS_COPY.toolbar.redo).toBe("Redo");
	expect(DOCUMENTS_COPY.toolbar.heading1).toBe("Heading 1");
	expect(DOCUMENTS_COPY.toolbar.paragraph).toBe("Paragraph");
	expect(DOCUMENTS_COPY.toolbar.bulletList).toBe("Bullet list");
	expect(DOCUMENTS_COPY.toolbar.orderedList).toBe("Numbered list");
	expect(DOCUMENTS_COPY.toolbar.blockquote).toBe("Quote");
	expect(DOCUMENTS_COPY.toolbar.strike).toBe("Strikethrough");
	expect(DOCUMENTS_COPY.toolbar.inlineCode).toBe("Inline code");
	expect(DOCUMENTS_COPY.toolbar.underline).toBe("Underline");
	expect(DOCUMENTS_COPY.toolbar.highlight).toBe("Highlight");
	expect(DOCUMENTS_COPY.toolbar.link).toBe("Link");
	expect(DOCUMENTS_COPY.toolbar.applyLink).toBe("Apply");
	expect(DOCUMENTS_COPY.toolbar.superscript).toBe("Superscript");
	expect(DOCUMENTS_COPY.toolbar.subscript).toBe("Subscript");
	expect(DOCUMENTS_COPY.toolbar.alignLeft).toBe("Align left");
	expect(DOCUMENTS_COPY.toolbar.alignCenter).toBe("Align center");
	expect(DOCUMENTS_COPY.toolbar.alignRight).toBe("Align right");
	expect(DOCUMENTS_COPY.toolbar.alignJustify).toBe("Justify");
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
