/**
 * Record Discovery seam — in-context preview without a copy record,
 * and filtered Search without Smart Collection create.
 * docs/specs/33-record-discovery/spec.md and
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Arama ve ilişki).
 */
import { describe, expect, it } from "vitest";

import {
	closeSourceRecordPreview,
	IN_CONTEXT_PREVIEW_SURFACES,
	openFullPage,
	openSourceRecordPreview,
	persistPreviewForRecentContext,
	previewActionCopy,
	restorePreviewFromRecentContext,
	sidePanelIsMandatory,
	smartCollectionFromFilteredSearch,
	sourceRecordFullPageHref,
} from "./in-context-preview";
import { searchRecords } from "./record-discovery";
import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";

const HREF = "/projects/project-atlas?work=work-north#work";
const PLACE = { focusedId: "work-north" };

function openOn(
	surface: (typeof IN_CONTEXT_PREVIEW_SURFACES)[number],
	current: Parameters<typeof openSourceRecordPreview>[0] = null
) {
	return openSourceRecordPreview(current, {
		listPlace: PLACE,
		recordId: "work-north",
		sourceHref: HREF,
		surface,
	});
}

describe("Record Discovery in-context preview", () => {
	it("uses the same Open source record label on supported surfaces and does not require a side panel", () => {
		expect(IN_CONTEXT_PREVIEW_SURFACES).toEqual([
			"Kanban",
			"Calendar",
			"Roadmap",
			"Scope Tree",
			"Smart Collection",
			"Notification Center",
		]);
		expect(RECORD_DISCOVERY_COPY.openSourceRecord).toBe("Open source record");
		expect(RECORD_DISCOVERY_COPY.openFullPage).toBe("Open full page");
		for (const surface of IN_CONTEXT_PREVIEW_SURFACES) {
			expect(previewActionCopy(surface)).toEqual({
				openFullPage: "Open full page",
				openSourceRecord: "Open source record",
				surface,
			});
			expect(sidePanelIsMandatory(surface)).toBe(false);
		}
	});

	it("opens a temporary panel without copying the record and keeps list place on close", () => {
		const opened = openOn("Kanban");
		expect(opened.createdRecord).toBe(false);
		expect(opened.savedCollection).toBe(false);
		expect(opened.persistedForRecentContext).toBe(false);
		expect(opened.session).toEqual({
			innerRecordIds: [],
			listPlace: PLACE,
			recordId: "work-north",
			sourceHref: HREF,
			surface: "Kanban",
		});
		const closed = closeSourceRecordPreview(opened.session);
		expect(closed.session).toBeNull();
		expect(closed.listPlace).toEqual(PLACE);
		expect(closed.createdRecord).toBe(false);
		expect(closed.savedCollection).toBe(false);
	});

	it("does not restore the panel or inner navigation as recent-context", () => {
		const first = openOn("Roadmap");
		const inner = openSourceRecordPreview(first.session, {
			listPlace: { focusedId: "work-related" },
			recordId: "work-related",
			sourceHref: sourceRecordFullPageHref("project-atlas", "work-related"),
			surface: "Roadmap",
		});
		expect(inner.session?.innerRecordIds).toEqual(["work-north"]);
		expect(inner.session?.recordId).toBe("work-related");
		expect(inner.listPlace).toEqual(PLACE);
		expect(persistPreviewForRecentContext(inner.session)).toEqual({
			preview: null,
		});
		expect(
			restorePreviewFromRecentContext({
				innerRecordIds: inner.session?.innerRecordIds,
				preview: inner.session,
				recordId: inner.session?.recordId,
			})
		).toBeNull();
	});

	it("does not turn a filtered Search into a Smart Collection", () => {
		const result = searchRecords(
			[
				{
					archived: false,
					authorized: true,
					body: "",
					closureResult: null,
					id: "work-north",
					key: "ATL-1",
					kind: RECORD_DISCOVERY_COPY.work,
					lifecycle: "active",
					metadata: "",
					projectId: "project-atlas",
					scope: RECORD_DISCOVERY_COPY.project,
					status: "In Progress",
					title: "North star",
					trashed: false,
					updatedAt: 1000,
				},
			],
			{
				includeArchived: false,
				openProjectId: "project-atlas",
				text: "north",
			}
		);
		expect(result.hits).toHaveLength(1);
		expect(smartCollectionFromFilteredSearch(result.query)).toEqual({
			created: false,
			membership: [],
		});
		expect(result).not.toHaveProperty("smartCollectionId");
		expect(result).not.toHaveProperty("membership");
	});

	it("offers Open full page for deep work without keeping the panel as layout", () => {
		expect(sourceRecordFullPageHref("project-atlas", "work-north")).toBe(HREF);
		const opened = openOn("Calendar");
		const fullPage = openFullPage(opened.session);
		expect(fullPage.href).toBe(HREF);
		expect(fullPage.persistPreview).toBe(false);
		expect(fullPage.session).toBeNull();
	});
});
