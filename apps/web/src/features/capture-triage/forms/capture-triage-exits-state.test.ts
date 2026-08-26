import { expect, test } from "vitest";

import {
	convertTargetOptions,
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
