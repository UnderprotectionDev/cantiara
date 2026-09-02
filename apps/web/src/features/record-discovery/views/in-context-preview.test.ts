import { expect, test } from "vitest";

import {
	closeSourceRecordPreview,
	IN_CONTEXT_PREVIEW_SURFACES,
	openFullPage,
	openSourceRecordPreview,
	persistPreviewForRecentContext,
	restorePreviewFromRecentContext,
	smartCollectionFromFilteredSearch,
	sourceRecordFullPageHref,
} from "./in-context-preview";
import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";

const HREF = "/projects/p1?work=work-1#work";

test("Open source record is a temporary panel, not a copy, collection, or recent-context", () => {
	expect(RECORD_DISCOVERY_COPY.openSourceRecord).toBe("Open source record");
	expect(RECORD_DISCOVERY_COPY.openFullPage).toBe("Open full page");
	expect(IN_CONTEXT_PREVIEW_SURFACES).toContain("Kanban");
	expect(IN_CONTEXT_PREVIEW_SURFACES).toContain("Notification Center");
	const opened = openSourceRecordPreview(null, {
		listPlace: { focusedId: "work-1" },
		recordId: "work-1",
		sourceHref: sourceRecordFullPageHref("p1", "work-1"),
		surface: "Calendar",
	});
	expect(opened.createdRecord).toBe(false);
	expect(opened.savedCollection).toBe(false);
	expect(opened.session?.sourceHref).toBe(HREF);
	expect(closeSourceRecordPreview(opened.session).listPlace).toEqual({
		focusedId: "work-1",
	});
	expect(persistPreviewForRecentContext(opened.session)).toEqual({
		preview: null,
	});
	expect(restorePreviewFromRecentContext(opened.session)).toBeNull();
	expect(smartCollectionFromFilteredSearch("status:open")).toEqual({
		created: false,
		membership: [],
	});
	expect(openFullPage(opened.session)).toEqual({
		href: HREF,
		persistPreview: false,
		session: null,
	});
});
