import { expect, test } from "vitest";

import { sessionTableRows } from "./session-table-rows";

test("Sessions does not call map on a missing list", () => {
	expect(sessionTableRows(undefined)).toEqual([]);
	expect(sessionTableRows(null)).toEqual([]);
	expect(sessionTableRows({})).toEqual([]);
});

test("Sessions renders only well-formed session rows", () => {
	expect(
		sessionTableRows([
			{
				current: true,
				device: "Mac",
				id: "sess_1",
				lastActivity: "2026-08-27T09:00:00.000Z",
			},
			{ id: "broken" },
		])
	).toEqual([
		{
			current: true,
			device: "Mac",
			id: "sess_1",
			lastActivity: "2026-08-27T09:00:00.000Z",
		},
	]);
});
