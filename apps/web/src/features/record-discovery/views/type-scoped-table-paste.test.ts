import { expect, test } from "vitest";

import {
	defaultPasteMapping,
	parseTablePaste,
} from "./type-scoped-table-paste";

test("parses tab-separated paste into headers and rows", () => {
	const parsed = parseTablePaste("Key\tTitle\nATL-1\tRenamed\n\tBrand new");
	expect(parsed.headers).toEqual(["Key", "Title"]);
	expect(parsed.rows).toEqual([
		["ATL-1", "Renamed"],
		["", "Brand new"],
	]);
	expect(defaultPasteMapping(parsed.headers)).toEqual({ key: 0, title: 1 });
});
