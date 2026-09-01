import { expect, test } from "vitest";

import { calendarListPresentation } from "./unified-calendar-list-presentation";

test("Calendar list is empty, loading, failed, or items", () => {
	expect(
		calendarListPresentation({
			data: undefined,
			isError: true,
			isPending: false,
		})
	).toEqual({ kind: "failed" });
	expect(
		calendarListPresentation({
			data: undefined,
			isError: false,
			isPending: true,
		})
	).toEqual({ kind: "loading" });
	expect(
		calendarListPresentation({ data: [], isError: false, isPending: false })
	).toEqual({ kind: "empty" });
	expect(
		calendarListPresentation({
			data: [{ id: "1" }],
			isError: false,
			isPending: false,
		})
	).toEqual({ items: [{ id: "1" }], kind: "list" });
});
