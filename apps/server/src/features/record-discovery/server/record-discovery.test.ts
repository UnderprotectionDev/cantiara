/**
 * Record Discovery seam — deterministic Universal Search order,
 * authorized match context, and Search surface (not Command Palette).
 * docs/specs/33-record-discovery/spec.md and
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Arama ve ilişki).
 */
import { describe, expect, it } from "vitest";

import {
	loadSearchIndexFromRows,
	type SearchIndexRecord,
	type SearchQuery,
	searchRecords,
} from "./record-discovery";
import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";

const OPEN = "project-atlas";
const OTHER = "project-nova";
const QUERY = "north star";

const FORBIDDEN_RANKING = /click|semantic|embedding|vector|learned|AI rank/i;
const PALETTE = /Command Palette/;
const LEAKED_HIT = /Hidden north star vault|work-foreign|work-trash/;
const NORTH_STAR = /north star/i;

function record(
	partial: Partial<SearchIndexRecord> & Pick<SearchIndexRecord, "id" | "title">
): SearchIndexRecord {
	return {
		archived: false,
		authorized: true,
		body: "",
		closureResult: null,
		key: null,
		kind: RECORD_DISCOVERY_COPY.work,
		lifecycle: "active",
		metadata: "",
		projectId: OPEN,
		scope: RECORD_DISCOVERY_COPY.project,
		status: "In Progress",
		trashed: false,
		updatedAt: 1000,
		...partial,
	};
}

function search(
	index: readonly SearchIndexRecord[],
	overrides: Partial<SearchQuery> = {}
) {
	return searchRecords(index, {
		includeArchived: false,
		openProjectId: OPEN,
		text: QUERY,
		...overrides,
	});
}

function ids(
	index: readonly SearchIndexRecord[],
	overrides?: Partial<SearchQuery>
) {
	return search(index, overrides).hits.map((hit) => hit.id);
}

describe("Record Discovery Search", () => {
	it("uses English Search copy and is not the Command Palette", () => {
		expect(RECORD_DISCOVERY_COPY.search).toBe("Search");
		expect(RECORD_DISCOVERY_COPY.search).not.toBe("Command Palette");
		expect(JSON.stringify(RECORD_DISCOVERY_COPY)).not.toMatch(PALETTE);
		expect(JSON.stringify(RECORD_DISCOVERY_COPY)).not.toMatch(
			FORBIDDEN_RANKING
		);
		const result = search([
			record({ id: "work-title", title: "North star launch" }),
		]);
		expect(result.surface).toBe("Search");
	});

	it("puts title and key matches before body matches", () => {
		const index = [
			record({
				body: "The north star lives in the body only.",
				id: "work-body",
				title: "Launch notes",
				updatedAt: 9000,
			}),
			record({
				id: "work-title",
				title: "North star launch",
				updatedAt: 1000,
			}),
			record({
				id: "work-key",
				key: "ATL-north star",
				title: "Keyed item",
				updatedAt: 1000,
			}),
		];
		expect(ids(index)).toEqual(["work-key", "work-title", "work-body"]);
		const [first] = search(index).hits;
		expect(first?.recordKey).toBe("ATL-north star");
	});

	it("puts the founder’s open Project before other Projects", () => {
		const index = [
			record({
				id: "work-other",
				projectId: OTHER,
				title: "North star other",
				updatedAt: 9000,
			}),
			record({
				id: "work-open",
				title: "North star open",
				updatedAt: 1000,
			}),
		];
		expect(ids(index)).toEqual(["work-open", "work-other"]);
	});

	it("puts active records before closed, and archived only with the archive filter", () => {
		const archived = record({
			archived: true,
			id: "work-archived",
			lifecycle: "archived",
			status: "Archived",
			title: "North star archived",
			updatedAt: 9000,
		});
		const index = [
			record({
				closureResult: "Completed",
				id: "work-closed",
				lifecycle: "closed",
				status: "Closed",
				title: "North star closed",
				updatedAt: 8000,
			}),
			archived,
			record({
				id: "work-active",
				title: "North star active",
				updatedAt: 1000,
			}),
		];
		expect(ids(index)).toEqual(["work-active", "work-closed"]);
		expect(ids(index, { includeArchived: true })).toEqual([
			"work-active",
			"work-closed",
			"work-archived",
		]);
	});

	it("puts Completed close result before Abandoned", () => {
		const index = [
			record({
				closureResult: "Abandoned",
				id: "work-abandoned",
				lifecycle: "closed",
				status: "Closed",
				title: "North star abandoned",
				updatedAt: 9000,
			}),
			record({
				closureResult: "Completed",
				id: "work-completed",
				lifecycle: "closed",
				status: "Closed",
				title: "North star completed",
				updatedAt: 1000,
			}),
		];
		expect(ids(index)).toEqual(["work-completed", "work-abandoned"]);
	});

	it("breaks remaining ties by recency then stable id", () => {
		const index = [
			record({
				id: "work-old",
				title: "North star old",
				updatedAt: 1000,
			}),
			record({
				id: "work-zz",
				title: "North star twin",
				updatedAt: 5000,
			}),
			record({
				id: "work-aa",
				title: "North star twin",
				updatedAt: 5000,
			}),
		];
		expect(ids(index)).toEqual(["work-aa", "work-zz", "work-old"]);
	});

	it("repeats the same authorized order and ignores insertion order", () => {
		const index = [
			record({
				body: "Mentions the north star once.",
				id: "work-body",
				title: "Body only",
				updatedAt: 9000,
			}),
			record({
				id: "work-title",
				title: "North star title",
				updatedAt: 1000,
			}),
			record({
				id: "work-other",
				projectId: OTHER,
				title: "North star other",
				updatedAt: 8000,
			}),
		];
		const first = ids(index);
		const second = ids([...index].reverse());
		expect(first).toEqual(["work-title", "work-other", "work-body"]);
		expect(second).toEqual(first);
	});

	it("never shows Trash or unauthorized records, names, or counts", () => {
		const index = [
			record({
				authorized: false,
				id: "work-foreign",
				title: "Hidden north star vault",
			}),
			record({
				id: "work-trash",
				title: "North star trash",
				trashed: true,
			}),
			record({ id: "work-ok", title: "North star visible" }),
		];
		const result = search(index);
		expect(result.hits.map((hit) => hit.id)).toEqual(["work-ok"]);
		expect(result.total).toBe(1);
		const serialized = JSON.stringify(result.hits);
		expect(serialized).not.toMatch(LEAKED_HIT);
	});

	it("builds snippet, highlight, and match count from the accessible index", () => {
		const index = [
			record({
				body: "Preface. The north star appears twice: north star again.",
				id: "work-body",
				title: "Planning",
			}),
		];
		const [hit] = search(index).hits;
		expect(hit?.matchPlace).toBe("body");
		expect(hit?.matchCount).toBe(2);
		expect(hit?.snippetParts.some((part) => part.highlight)).toBe(true);
		expect(
			hit?.snippetParts
				.filter((part) => part.highlight)
				.map((part) => part.text.toLowerCase())
		).toEqual(["north star"]);
		expect(hit?.snippetParts.map((part) => part.text).join("")).toMatch(
			NORTH_STAR
		);
	});

	it("finds Document bodies and File Attachment metadata in the same authorized set", () => {
		const index = [
			record({
				body: "The north star is in the document body.",
				id: "doc-body",
				kind: RECORD_DISCOVERY_COPY.document,
				title: "Research notes",
			}),
			record({
				id: "file-meta",
				kind: RECORD_DISCOVERY_COPY.fileAttachment,
				metadata: "north star scan.pdf",
				title: "Scan",
			}),
			record({
				id: "work-title",
				title: "North star work",
			}),
		];
		expect(ids(index)).toEqual(["work-title", "doc-body", "file-meta"]);
	});

	it("maps Work and File Attachment rows without indexing trash", () => {
		const index = loadSearchIndexFromRows({
			fileAttachments: [
				{
					id: "file-ok",
					lifecycle: "active",
					projectId: OPEN,
					scopeKind: "project",
					title: "Deck",
					updatedAt: new Date(2000),
					versions: [{ filename: "north star.pdf" }],
				},
				{
					id: "file-trash",
					lifecycle: "trash",
					projectId: OPEN,
					scopeKind: "project",
					title: "North star trash file",
					updatedAt: new Date(9000),
					versions: [{ filename: "gone.pdf" }],
				},
			],
			works: [
				{
					archived: false,
					closureResult: null,
					description: "Body without the term",
					id: "work-ok",
					key: "ATL-1",
					projectId: OPEN,
					status: "In Progress",
					title: "North star mapped",
					trashedAt: null,
					updatedAt: new Date(1000),
				},
			],
		});
		expect(ids(index)).toEqual(["work-ok", "file-ok"]);
	});
});
