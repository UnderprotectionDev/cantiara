import { afterEach, describe, expect, it } from "vitest";

import {
	clearDocumentEditorSession,
	getDocumentEditorSession,
	presentDocumentDisconnect,
	presentReconnectSave,
	recoveryFilename,
	rememberDocumentEditorSession,
} from "./document-session";
import { DOCUMENTS_COPY } from "./documents-copy";

const session = {
	baseRevision: 1,
	body: "unsaved buffer",
	documentId: "doc-1",
	lastSuccessfulSaveAt: new Date("2026-03-29T12:00:00.000Z"),
	title: "Payments spec",
	type: "Spec",
};

afterEach(() => {
	clearDocumentEditorSession();
});

describe("Document disconnect and reconnect", () => {
	it("stops edits after the in-memory buffer and offers Copy and Download", () => {
		const presented = presentDocumentDisconnect({
			connected: false,
			session,
		});
		expect(presented).toEqual({
			copy: DOCUMENTS_COPY.copy,
			download: DOCUMENTS_COPY.download,
			editingAllowed: false,
			filename: "Payments-spec.md",
			lastSuccessfulSaveAt: session.lastSuccessfulSaveAt,
			markdown: "unsaved buffer",
		});
		expect(DOCUMENTS_COPY.copy).toBe("Copy");
		expect(DOCUMENTS_COPY.download).toBe("Download");
		expect(DOCUMENTS_COPY.conflictDraft).toBe("Conflict Draft");
	});

	it("reconnects with one save against the last base revision", () => {
		rememberDocumentEditorSession(session);
		expect(getDocumentEditorSession()).toEqual(session);
		expect(
			presentReconnectSave({
				connected: true,
				session: getDocumentEditorSession(),
			})
		).toEqual({
			baseRevision: 1,
			payload: {
				body: "unsaved buffer",
				documentId: "doc-1",
				title: "Payments spec",
				type: "Spec",
			},
			status: "attempt",
		});
		expect(
			presentReconnectSave({
				connected: true,
				session: getDocumentEditorSession(),
			}).status
		).toBe("attempt");
		expect(recoveryFilename("Payments spec")).toBe("Payments-spec.md");
	});
});
