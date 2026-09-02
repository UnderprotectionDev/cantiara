/**
 * Record Discovery seam — deterministic Universal Search order,
 * prepared type indexes, authorized match context, and Search surface
 * (not Command Palette).
 * docs/specs/33-record-discovery/spec.md and
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Arama ve ilişki).
 */
import { describe, expect, it } from "vitest";

import {
	browsePreparedIndex,
	loadSearchIndexFromRows,
	PREPARED_INDEX_LABELS,
	SEARCH_EXCLUDED_KINDS,
	SEARCH_SECRET_FIELDS,
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
const SMART_COLLECTION = /Smart Collection/;
const TRASH_OR_DELETED = /Trash|deleted/i;
const INDEX_LEAK = /Hidden vault|work-foreign/;
const EXCLUDED_ROW_IDS =
	/draft-1|capture-1|surface-1|gh-1|sk_north_star|tok_northstar/;

function record(
	partial: Partial<SearchIndexRecord> & Pick<SearchIndexRecord, "id" | "title">
): SearchIndexRecord {
	return {
		archived: false,
		authorized: true,
		body: "",
		closureResult: null,
		diagramAuthorityMode: null,
		folder: null,
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
		recordType:
			partial.recordType ?? partial.kind ?? RECORD_DISCOVERY_COPY.work,
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

	it("keeps forbidden kinds, secrets, SQL bodies, trash, and unauthorized records out of Search", () => {
		const sql = "CREATE TABLE north_star_secret_schema (id uuid);";
		const token = "tok_northstar_9f3";
		const password = "pw-north-star";
		const secret = "sk_north_star";
		const index = [
			record({ id: "work-ok", title: "North star visible" }),
			record({
				id: "draft-north",
				kind: RECORD_DISCOVERY_COPY.draft,
				title: "North star draft",
				updatedAt: 9000,
			}),
			record({
				body: "north star capture body",
				id: "capture-north",
				kind: RECORD_DISCOVERY_COPY.captureInboxItem,
				title: "North star capture",
			}),
			record({
				body: token,
				id: "surface-north",
				kind: RECORD_DISCOVERY_COPY.externalSurface,
				title: "North star surface",
			}),
			record({
				id: "github-north",
				kind: RECORD_DISCOVERY_COPY.githubExternalRecord,
				title: "North star GitHub issue",
			}),
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
			record({
				archived: true,
				id: "work-archived",
				lifecycle: "archived",
				status: RECORD_DISCOVERY_COPY.archived,
				title: "North star archived",
				updatedAt: 8000,
			}),
			record({
				id: "diagram-sql",
				kind: RECORD_DISCOVERY_COPY.technicalDiagram,
				title: "Schema diagram",
			}),
			record({
				body: `${secret} ${password} ${token}`,
				id: "secret-work",
				kind: RECORD_DISCOVERY_COPY.externalSurface,
				title: "Credentials",
			}),
		];
		const leakedValues = [
			sql,
			token,
			password,
			secret,
			"draft-north",
			"capture-north",
		];
		const defaultResult = search(index);
		expect(defaultResult.hits.map((hit) => hit.id)).toEqual(["work-ok"]);
		const serialized = JSON.stringify(defaultResult);
		for (const leaked of leakedValues) {
			expect(serialized).not.toContain(leaked);
		}
		expect(ids(index, { includeArchived: true })).toEqual([
			"work-ok",
			"work-archived",
		]);
		expect(ids(index, { includeArchived: true })).not.toContain("work-trash");
		expect(ids(index, { text: token })).toEqual([]);
		expect(ids(index, { text: password })).toEqual([]);
		expect(ids(index, { text: secret })).toEqual([]);
		expect(ids(index, { text: sql })).toEqual([]);
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

	it("finds Migration Artifact names on the owning Technical Diagram, not generated SQL", () => {
		expect(SEARCH_EXCLUDED_KINDS).toEqual([
			RECORD_DISCOVERY_COPY.captureInboxItem,
			RECORD_DISCOVERY_COPY.draft,
			RECORD_DISCOVERY_COPY.externalSurface,
			RECORD_DISCOVERY_COPY.githubExternalRecord,
		]);
		expect(SEARCH_SECRET_FIELDS).toEqual([
			RECORD_DISCOVERY_COPY.secret,
			RECORD_DISCOVERY_COPY.shareToken,
			RECORD_DISCOVERY_COPY.linkPassword,
		]);
		const sql = "CREATE TABLE north_star_secret_schema (id uuid);";
		const index = loadSearchIndexFromRows({
			fileAttachments: [],
			technicalDiagrams: [
				{
					archived: false,
					generatedSql: sql,
					id: "diagram-1",
					projectId: OPEN,
					title: "Payments schema",
					trashedAt: null,
					updatedAt: new Date(2000),
					userFacingNames: ["north star migration"],
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
		expect(index.map((row) => row.id)).toEqual(
			expect.arrayContaining(["diagram-1", "work-ok"])
		);
		expect(index).toHaveLength(2);
		expect(JSON.stringify(index)).not.toContain(sql);
		expect(ids(index)).toEqual(["work-ok", "diagram-1"]);
		expect(ids(index, { text: "north star migration" })).toEqual(["diagram-1"]);
		expect(ids(index, { text: sql })).toEqual([]);
		expect(JSON.stringify(search(index).hits)).not.toMatch(EXCLUDED_ROW_IDS);
	});
});

describe("Record Discovery prepared type indexes", () => {
	it("lists the closed zero-setup All … catalog, not stored queries or setup-required views", () => {
		expect(PREPARED_INDEX_LABELS).toEqual([
			RECORD_DISCOVERY_COPY.allWork,
			RECORD_DISCOVERY_COPY.allDocuments,
			RECORD_DISCOVERY_COPY.allDecisions,
			RECORD_DISCOVERY_COPY.allRisks,
			RECORD_DISCOVERY_COPY.allResearchSessions,
			RECORD_DISCOVERY_COPY.allTests,
			RECORD_DISCOVERY_COPY.allDesigns,
			RECORD_DISCOVERY_COPY.allTechnicalDiagrams,
			RECORD_DISCOVERY_COPY.allProjectReleases,
			RECORD_DISCOVERY_COPY.allSources,
			RECORD_DISCOVERY_COPY.allFiles,
		]);
		expect(PREPARED_INDEX_LABELS).toEqual([
			"All Work",
			"All Documents",
			"All Decisions",
			"All Risks",
			"All Research Sessions",
			"All Tests",
			"All Designs",
			"All Technical Diagrams",
			"All Project Releases",
			"All Sources",
			"All Files",
		]);
		const result = browsePreparedIndex(
			[record({ id: "work-ok", title: "Launch" })],
			{ index: RECORD_DISCOVERY_COPY.allWork }
		);
		expect(result.setupRequired).toBe(false);
		expect(result.storedQuery).toBe(false);
		expect(result.surface).toBe("All Work");
		expect(result.surface).not.toBe("Search");
		expect(result.openSourceRecord).toBe("Open source record");
		expect(JSON.stringify(result)).not.toMatch(SMART_COLLECTION);
		expect(JSON.stringify(RECORD_DISCOVERY_COPY)).not.toMatch(PALETTE);
	});

	it("collects existing Work without taking ownership out of Project or Wiki scope", () => {
		const index = [
			record({
				id: "work-atlas",
				projectId: OPEN,
				title: "Atlas launch",
			}),
			record({
				id: "doc-wiki",
				kind: RECORD_DISCOVERY_COPY.document,
				projectId: null,
				recordType: RECORD_DISCOVERY_COPY.document,
				scope: RECORD_DISCOVERY_COPY.personalWiki,
				title: "Wiki note",
			}),
			record({
				id: "work-wiki-scope-kept",
				projectId: null,
				scope: RECORD_DISCOVERY_COPY.personalWiki,
				title: "Misplaced",
			}),
		];
		const result = browsePreparedIndex(index, {
			index: RECORD_DISCOVERY_COPY.allWork,
		});
		expect(result.rows.map((row) => row.id)).toEqual([
			"work-atlas",
			"work-wiki-scope-kept",
		]);
		expect(result.rows[0]?.scope).toBe("Project");
		expect(result.rows[0]?.projectId).toBe(OPEN);
		expect(result.rows[1]?.scope).toBe("Personal Wiki");
		expect(result.rows.every((row) => row.openSourceRecord)).toBe(true);
	});

	it("keeps archived records findable with the archive filter, not as deleted", () => {
		const archived = record({
			archived: true,
			id: "work-archived",
			lifecycle: "archived",
			status: "Archived",
			title: "Archived launch",
		});
		const index = [
			record({ id: "work-active", title: "Active launch" }),
			archived,
			record({
				id: "work-trash",
				title: "Trashed launch",
				trashed: true,
			}),
		];
		expect(
			browsePreparedIndex(index, {
				index: RECORD_DISCOVERY_COPY.allWork,
			}).rows.map((row) => row.id)
		).toEqual(["work-active"]);
		const withArchive = browsePreparedIndex(index, {
			includeArchived: true,
			index: RECORD_DISCOVERY_COPY.allWork,
		});
		expect(withArchive.rows.map((row) => row.id)).toEqual([
			"work-active",
			"work-archived",
		]);
		expect(
			withArchive.rows.find((row) => row.id === "work-archived")?.status
		).toBe("Archived");
		expect(JSON.stringify(withArchive.rows)).not.toMatch(TRASH_OR_DELETED);
	});

	it("shows each File Attachment once even when versions exist", () => {
		const index = loadSearchIndexFromRows({
			fileAttachments: [
				{
					folder: "Decks",
					id: "file-deck",
					lifecycle: "active",
					projectId: OPEN,
					scopeKind: "project",
					title: "Pitch",
					updatedAt: new Date(2000),
					versions: [
						{ filename: "pitch-v1.pdf" },
						{ filename: "pitch-v2.pdf" },
					],
				},
			],
			works: [],
		});
		const result = browsePreparedIndex(index, {
			index: RECORD_DISCOVERY_COPY.allFiles,
		});
		expect(result.rows.map((row) => row.id)).toEqual(["file-deck"]);
		expect(result.rows[0]?.recordType).toBe("File Attachment");
		expect(result.rows[0]?.metadata).toBe("pitch-v2.pdf");
	});

	it("keeps All Tests subtypes and All Technical Diagrams types plus authority mode distinct", () => {
		const index = [
			record({
				id: "test-case",
				kind: RECORD_DISCOVERY_COPY.plannedTestCase,
				recordType: RECORD_DISCOVERY_COPY.plannedTestCase,
				title: "Login case",
			}),
			record({
				id: "test-handoff",
				kind: RECORD_DISCOVERY_COPY.testHandoff,
				recordType: RECORD_DISCOVERY_COPY.testHandoff,
				title: "QA handoff",
			}),
			record({
				id: "test-session",
				kind: RECORD_DISCOVERY_COPY.testSession,
				recordType: RECORD_DISCOVERY_COPY.testSession,
				title: "Nightly session",
			}),
			record({
				id: "session-test",
				kind: RECORD_DISCOVERY_COPY.sessionTest,
				recordType: RECORD_DISCOVERY_COPY.sessionTest,
				title: "Case 12 run",
			}),
			record({
				id: "test-gap",
				kind: RECORD_DISCOVERY_COPY.testGap,
				recordType: RECORD_DISCOVERY_COPY.testGap,
				title: "Missing path",
			}),
			record({
				id: "test-assessment",
				kind: RECORD_DISCOVERY_COPY.testAssessment,
				recordType: RECORD_DISCOVERY_COPY.testAssessment,
				title: "Release assessment",
			}),
			record({
				diagramAuthorityMode: RECORD_DISCOVERY_COPY.productAuthoredModel,
				id: "diag-arch",
				kind: RECORD_DISCOVERY_COPY.technicalArchitecture,
				recordType: RECORD_DISCOVERY_COPY.technicalArchitecture,
				title: "System map",
			}),
			record({
				diagramAuthorityMode: RECORD_DISCOVERY_COPY.repositoryDerivedView,
				id: "diag-data",
				kind: RECORD_DISCOVERY_COPY.dataModel,
				recordType: RECORD_DISCOVERY_COPY.dataModel,
				title: "Schema",
			}),
			record({
				diagramAuthorityMode: RECORD_DISCOVERY_COPY.externalSourceLink,
				id: "diag-seq",
				kind: RECORD_DISCOVERY_COPY.technicalSequence,
				recordType: RECORD_DISCOVERY_COPY.technicalSequence,
				title: "Checkout sequence",
			}),
		];
		const tests = browsePreparedIndex(index, {
			index: RECORD_DISCOVERY_COPY.allTests,
		});
		expect(tests.rows.map((row) => row.title)).toEqual([
			"Case 12 run",
			"Login case",
			"Missing path",
			"Nightly session",
			"QA handoff",
			"Release assessment",
		]);
		expect(new Set(tests.rows.map((row) => row.recordType))).toEqual(
			new Set([
				"Planned Test Case",
				"Test Handoff",
				"Test Session",
				"Session Test",
				"Test Gap",
				"Test assessment",
			])
		);
		const diagrams = browsePreparedIndex(index, {
			index: RECORD_DISCOVERY_COPY.allTechnicalDiagrams,
		});
		expect(diagrams.rows.map((row) => row.title)).toEqual([
			"Checkout sequence",
			"Schema",
			"System map",
		]);
		expect(diagrams.rows.map((row) => row.recordType)).toEqual([
			"Technical Sequence",
			"Data Model",
			"Technical Architecture",
		]);
		expect(diagrams.rows.map((row) => row.diagramAuthorityMode)).toEqual([
			"External Source Link",
			"Repository-derived View",
			"Product-authored Model",
		]);
	});

	it("browses Document and File indexes by scope, type, folder, and metadata without replacing Search", () => {
		const index = [
			record({
				folder: "Research",
				id: "doc-research",
				kind: RECORD_DISCOVERY_COPY.document,
				projectId: OPEN,
				recordType: RECORD_DISCOVERY_COPY.persona,
				title: "Buyer persona",
			}),
			record({
				folder: "Inbox",
				id: "doc-inbox",
				kind: RECORD_DISCOVERY_COPY.document,
				projectId: null,
				recordType: RECORD_DISCOVERY_COPY.document,
				scope: RECORD_DISCOVERY_COPY.personalWiki,
				title: "Scratch",
			}),
			record({
				folder: "Research",
				id: "file-scan",
				kind: RECORD_DISCOVERY_COPY.fileAttachment,
				metadata: "north-star-scan.pdf",
				recordType: RECORD_DISCOVERY_COPY.fileAttachment,
				title: "Scan",
			}),
			record({ id: "work-ok", title: "Work stays out" }),
		];
		const documents = browsePreparedIndex(index, {
			folder: "Research",
			index: RECORD_DISCOVERY_COPY.allDocuments,
			recordType: RECORD_DISCOVERY_COPY.persona,
			scope: RECORD_DISCOVERY_COPY.project,
		});
		expect(documents.surface).toBe("All Documents");
		expect(documents.rows.map((row) => row.id)).toEqual(["doc-research"]);
		expect(documents.folders).toEqual(["Inbox", "Research"]);
		const files = browsePreparedIndex(index, {
			folder: "Research",
			index: RECORD_DISCOVERY_COPY.allFiles,
			metadata: "pdf",
		});
		expect(files.surface).toBe("All Files");
		expect(files.rows.map((row) => row.id)).toEqual(["file-scan"]);
		expect(files.surface).not.toBe("Search");
		expect(
			searchRecords(index, {
				includeArchived: false,
				openProjectId: OPEN,
				text: "Buyer",
			}).surface
		).toBe("Search");
	});

	it("never shows unauthorized or Trash records from an index", () => {
		const index = [
			record({
				authorized: false,
				id: "work-foreign",
				title: "Hidden vault",
			}),
			record({
				id: "work-ok",
				title: "Visible launch",
			}),
		];
		const result = browsePreparedIndex(index, {
			index: RECORD_DISCOVERY_COPY.allWork,
		});
		expect(result.rows.map((row) => row.id)).toEqual(["work-ok"]);
		expect(JSON.stringify(result)).not.toMatch(INDEX_LEAK);
	});
});
