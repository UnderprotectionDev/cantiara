import { expect, test } from "vitest";

import {
	goBackSequentialFocus,
	nextSequentialFocus,
	sequentialTriageView,
	startSequentialFocus,
} from "./sequential-triage-state";

const items = [
	{ body: "First thought", id: "a" },
	{ body: "Second thought", id: "b" },
	{ body: "Third thought", id: "c" },
] as const;
const ids = items.map((item) => item.id);

test("Sequential triage starts on one remaining item", () => {
	expect(startSequentialFocus(ids)).toBe("a");
	expect(startSequentialFocus(ids, "c")).toBe("c");
	expect(startSequentialFocus([])).toBeNull();
	expect(sequentialTriageView(items, "a")).toEqual({
		focused: items[0],
		mode: "sequential",
		previousAvailable: false,
	});
});

test("the next Sequential triage focus is the following remaining item", () => {
	expect(nextSequentialFocus(ids, "a")).toBe("b");
	expect(nextSequentialFocus(ids, "c")).toBeNull();
	expect(sequentialTriageView([items[1], items[2]], "b")).toEqual({
		focused: items[1],
		mode: "sequential",
		previousAvailable: false,
	});
});

test("Sequential triage can step back or return to the list", () => {
	expect(goBackSequentialFocus(ids, "c")).toBe("b");
	expect(goBackSequentialFocus(ids, "a")).toBe("a");
	expect(sequentialTriageView(items, null)).toEqual({
		focused: null,
		mode: "list",
		previousAvailable: false,
	});
});
