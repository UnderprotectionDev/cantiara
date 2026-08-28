import { expect, test } from "vitest";

import { draftsListPresentation } from "./drafts-list-presentation";

test("Drafts list is loading until the query returns, not empty", () => {
	expect(
		draftsListPresentation({
			data: undefined,
			isError: false,
			isPending: true,
		})
	).toEqual({ kind: "loading" });
});

test("Drafts empty copy is only after a successful empty list", () => {
	expect(
		draftsListPresentation({
			data: [],
			isError: false,
			isPending: false,
		})
	).toEqual({ kind: "empty" });
});

test("Drafts keep visible rows while the list refetches", () => {
	const drafts = [{ form: { title: "Intake" }, id: "draft-1" }];
	expect(
		draftsListPresentation({
			data: drafts,
			isError: false,
			isPending: true,
		})
	).toEqual({ drafts, kind: "list" });
});

test("Drafts list failure is not an empty surface", () => {
	expect(
		draftsListPresentation({
			data: undefined,
			isError: true,
			isPending: false,
		})
	).toEqual({ kind: "failed" });
});
