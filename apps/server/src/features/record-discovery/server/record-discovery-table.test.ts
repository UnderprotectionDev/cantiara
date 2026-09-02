/**
 * Record Discovery seam — type-scoped Table matrix, same-record
 * inline apply, and atomic paste.
 * docs/specs/33-record-discovery/spec.md and
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Arama ve ilişki).
 */
import { describe, expect, it } from "vitest";

import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";
import {
	applyInlineCell,
	applyTablePaste,
	openTypeTable,
	previewTablePaste,
	queryTypeTable,
	recordSurface,
	saveTableAsSmartCollection,
	type TableRecord,
} from "./record-discovery-table";

function workRow(
	partial: Partial<TableRecord> & Pick<TableRecord, "id" | "title">
): TableRecord {
	return {
		kind: RECORD_DISCOVERY_COPY.work,
		projectId: "project-atlas",
		recordKey: null,
		revision: 1,
		sessionTests: [],
		status: "In Progress",
		...partial,
	};
}

describe("Record Discovery Table", () => {
	it("uses English Table copy and does not store Smart Collection membership", () => {
		expect(RECORD_DISCOVERY_COPY.table).toBe("Table");
		expect(RECORD_DISCOVERY_COPY.saveAsSmartCollection).toBe(
			"Save as Smart Collection"
		);
		const opened = openTypeTable(RECORD_DISCOVERY_COPY.work);
		expect(opened.status).toBe("ok");
		if (opened.status !== "ok") {
			return;
		}
		expect(opened.surface).toBe("Table");
		expect(opened.kind).toBe("Work");
		const save = saveTableAsSmartCollection(opened.kind);
		expect(save.status).toBe("refused");
		expect(save.membershipStored).toBe(false);
	});

	it("refuses Table for types outside the closed matrix", () => {
		expect(openTypeTable(RECORD_DISCOVERY_COPY.document).status).toBe(
			"refused"
		);
		expect(openTypeTable(RECORD_DISCOVERY_COPY.wikiDocument).status).toBe(
			"refused"
		);
		expect(openTypeTable(RECORD_DISCOVERY_COPY.fileAttachment).status).toBe(
			"refused"
		);
		expect(openTypeTable(RECORD_DISCOVERY_COPY.screen).status).toBe("refused");
		expect(openTypeTable(RECORD_DISCOVERY_COPY.draft).status).toBe("refused");
		expect(openTypeTable(RECORD_DISCOVERY_COPY.captureInboxItem).status).toBe(
			"refused"
		);
		expect(openTypeTable("Spreadsheet row").status).toBe("refused");
	});

	it("marks Smart Collection source only where the matrix allows it", () => {
		expect(recordSurface(RECORD_DISCOVERY_COPY.work)).toEqual({
			searchAndIndex: true,
			smartCollectionSource: true,
			tableAndCellEdit: true,
		});
		expect(recordSurface(RECORD_DISCOVERY_COPY.document)).toEqual({
			searchAndIndex: true,
			smartCollectionSource: "structured-metadata",
			tableAndCellEdit: false,
		});
		expect(recordSurface(RECORD_DISCOVERY_COPY.fileAttachment)).toEqual({
			searchAndIndex: true,
			smartCollectionSource: false,
			tableAndCellEdit: false,
		});
		expect(recordSurface(RECORD_DISCOVERY_COPY.draft)).toEqual({
			searchAndIndex: false,
			smartCollectionSource: false,
			tableAndCellEdit: false,
		});
	});

	it("keeps one Table to one type, then sorts and filters the same main records", () => {
		const opened = openTypeTable(RECORD_DISCOVERY_COPY.work);
		expect(opened.status).toBe("ok");
		const mixed: TableRecord[] = [
			workRow({ id: "work-b", title: "Beta launch" }),
			workRow({
				id: "work-a",
				kind: RECORD_DISCOVERY_COPY.decision,
				title: "Alpha decision",
			}),
			workRow({ id: "work-c", recordKey: "ATL-9", title: "Gamma launch" }),
		];
		const listed = queryTypeTable(mixed, {
			filterText: "launch",
			kind: RECORD_DISCOVERY_COPY.work,
			sortDirection: "asc",
			sortField: "title",
		});
		expect(listed.kind).toBe("Work");
		expect(listed.rows.map((row) => row.id)).toEqual(["work-b", "work-c"]);
		expect(listed.rows.every((row) => row.kind === "Work")).toBe(true);
		expect(listed.rows.map((row) => row.id)).not.toContain("work-a");
	});

	it("writes an allowed cell onto the same main record, not a new row or bulk edit", () => {
		const row = workRow({ id: "work-keep", title: "Old title" });
		const written = applyInlineCell({
			field: "title",
			kind: RECORD_DISCOVERY_COPY.work,
			row,
			value: "New title",
		});
		expect(written.status).toBe("ok");
		if (written.status !== "ok") {
			return;
		}
		expect(written.row.id).toBe("work-keep");
		expect(written.row.title).toBe("New title");
		const bulk = applyInlineCell({
			field: "title",
			kind: RECORD_DISCOVERY_COPY.work,
			row,
			value: "A",
			withFields: { status: "Closed" },
		});
		expect(bulk.status).toBe("refused");
		expect(bulk.reason).toBe("inline-is-not-bulk");
		const lookup = applyInlineCell({
			field: "lookup",
			kind: RECORD_DISCOVERY_COPY.work,
			row,
			value: "other-id",
		});
		expect(lookup.status).toBe("refused");
		const formula = applyInlineCell({
			field: "formula",
			kind: RECORD_DISCOVERY_COPY.work,
			row,
			value: "1+1",
		});
		expect(formula.status).toBe("refused");
	});

	it("shows Session Tests on the Test Session owner row and refuses writing historical results from the cell", () => {
		const session: TableRecord = {
			id: "session-1",
			kind: RECORD_DISCOVERY_COPY.testSession,
			projectId: "project-atlas",
			recordKey: "TS-1",
			revision: 1,
			sessionTests: [
				{
					id: "st-login",
					result: "Passed",
					title: "Login",
				},
			],
			status: "Active",
			title: "Nightly",
		};
		const listed = queryTypeTable([session], {
			filterText: "",
			kind: RECORD_DISCOVERY_COPY.testSession,
			sortDirection: "asc",
			sortField: "title",
		});
		expect(listed.rows[0]?.sessionTests).toEqual([
			{ id: "st-login", result: "Passed", title: "Login" },
		]);
		const written = applyInlineCell({
			field: "sessionTests.st-login.result",
			kind: RECORD_DISCOVERY_COPY.testSession,
			row: session,
			value: "Failed",
		});
		expect(written.status).toBe("refused");
		expect(written.reason).toBe("historical-result-not-writable");
	});

	it("previews multi-row paste mapping and applies all-or-nothing", () => {
		const existing = [
			workRow({
				id: "work-keep",
				recordKey: "ATL-1",
				title: "Keep me",
			}),
		];
		const preview = previewTablePaste({
			existing,
			headers: ["Key", "Title"],
			kind: RECORD_DISCOVERY_COPY.work,
			mapping: { key: 0, title: 1 },
			projectId: "project-atlas",
			rows: [
				["ATL-1", "Renamed"],
				["", "Brand new"],
				["", ""],
			],
		});
		expect(preview.rows.map((row) => row.action)).toEqual([
			"update",
			"create",
			"invalid",
		]);
		const refused = applyTablePaste({
			excludedIndexes: [],
			existing,
			preview,
		});
		expect(refused.status).toBe("rejected");
		expect(refused.reason).toBe("partial-refused");
		expect(refused.records).toEqual(existing);
		const applied = applyTablePaste({
			excludedIndexes: [2],
			existing,
			preview,
		});
		expect(applied.status).toBe("ok");
		if (applied.status !== "ok") {
			return;
		}
		expect(applied.records.find((row) => row.id === "work-keep")?.title).toBe(
			"Renamed"
		);
		expect(
			applied.records.some(
				(row) => row.title === "Brand new" && row.id !== "work-keep"
			)
		).toBe(true);
		expect(applied.records).toHaveLength(2);
	});
});
