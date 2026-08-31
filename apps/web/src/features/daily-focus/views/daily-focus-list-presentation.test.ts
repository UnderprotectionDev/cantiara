import { expect, test } from "vitest";

import { dailyFocusListPresentation } from "./daily-focus-list-presentation";

test("Daily Focus list is empty, loading, failed, or members", () => {
	expect(
		dailyFocusListPresentation({
			data: undefined,
			isError: false,
			isPending: true,
		})
	).toEqual({ kind: "loading" });
	expect(
		dailyFocusListPresentation({
			data: undefined,
			isError: true,
			isPending: false,
		})
	).toEqual({ kind: "failed" });
	expect(
		dailyFocusListPresentation({
			data: [],
			isError: false,
			isPending: false,
		})
	).toEqual({ kind: "empty" });
	const members = [{ id: "work-1", title: "Intake checkout" }];
	expect(
		dailyFocusListPresentation({
			data: members,
			isError: false,
			isPending: false,
		})
	).toEqual({ kind: "list", members });
});
