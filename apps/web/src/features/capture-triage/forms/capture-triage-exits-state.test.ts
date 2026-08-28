import { expect, test } from "vitest";

import {
	convertFinalizeFailedLine,
	convertTargetOptions,
	convertTargetScopeLine,
	mergeUndoPreviewLines,
	otherProjectGroups,
} from "./capture-triage-exits-state";

test("Convert targets are Work, Document, and File Attachment", () => {
	expect(
		convertTargetOptions({
			document: "Document",
			fileAttachment: "File Attachment",
			work: "Work",
		})
	).toEqual([
		{ id: "work", label: "Work" },
		{ id: "document", label: "Document" },
		{ id: "file-attachment", label: "File Attachment" },
	]);
});

test("convert preview names Workspace or Project Capture Inbox as the target scope", () => {
	expect(
		convertTargetScopeLine({
			heading: "Workspace Capture Inbox",
			projectId: null,
		})
	).toBe("Workspace Capture Inbox");
	expect(
		convertTargetScopeLine({
			heading: "Project Capture Inbox",
			projectId: "proj-cantiara",
			projectName: "Atlas",
		})
	).toBe("Project Capture Inbox Atlas");
});

test("failed capture promotion explains a secret-free retry", () => {
	expect(
		convertFinalizeFailedLine({
			reason: "This file type is not accepted.",
			retryBound: "once",
			supportReference: "CANT-0F1E2D3C",
			written: false,
		})
	).toBe(
		"This file type is not accepted. Data was not written. You can retry once. Support reference CANT-0F1E2D3C"
	);
});

test("merge undo preview lists original Inbox fields and only this merge's binds", () => {
	expect(
		mergeUndoPreviewLines({
			bindsToRemove: [
				{
					fields: { originMessage: "Crash on save" },
					relation: "evidence",
					targetId: "work-1",
				},
			],
			copy: { evidence: "Evidence", origin: "Origin" },
			restoredItem: {
				attachmentRef: "staging-shot",
				body: "Crash on save",
				capturedAt: "2026-08-26T12:00:00.000Z",
				link: "https://example.com/bug",
				origin: "https://example.com/bug",
			},
		})
	).toEqual([
		{ id: "body", text: "Crash on save" },
		{ id: "link", text: "https://example.com/bug" },
		{ id: "attachment", text: "staging-shot" },
		{ id: "capturedAt", text: "2026-08-26T12:00:00.000Z" },
		{ id: "origin", text: "https://example.com/bug" },
		{ id: "bind-work-1", text: "Evidence work-1" },
	]);
});

test("other-Project matches stay under named Project groups", () => {
	const other = {
		basis: { excerpt: "Login button does nothing", kind: "text" },
		id: "work-other",
		projectId: "proj-other",
		projectName: "Other App",
		title: "Same crash elsewhere",
	};
	const research = {
		basis: { excerpt: "https://example.com/bug", kind: "link" },
		id: "work-research",
		projectId: "proj-research",
		projectName: "Research App",
		title: "Linked crash",
	};
	expect(otherProjectGroups([research, other])).toEqual([
		{ matches: [other], projectName: "Other App" },
		{ matches: [research], projectName: "Research App" },
	]);
});
