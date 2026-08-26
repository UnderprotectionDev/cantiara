import { expect, test } from "vitest";

import { presentAtomicWriteUi, presentReversibleWriteUi } from "./mutation";

test("a staged multi-step write can still Cancel", () => {
	expect(presentAtomicWriteUi("pre-barrier")).toEqual({
		cancelAvailable: true,
		label: "Cancel",
	});
});

test("after the commit barrier the UI shows Finalizing and Cancel is not available", () => {
	expect(presentAtomicWriteUi("post-barrier")).toEqual({
		cancelAvailable: false,
		label: "Finalizing",
	});
});

test("a reversible committed write offers Undo", () => {
	expect(presentReversibleWriteUi(true)).toEqual({
		label: "Undo",
		undoAvailable: true,
	});
});

test("a write that did not land does not offer Undo", () => {
	expect(presentReversibleWriteUi(false)).toEqual({
		label: null,
		undoAvailable: false,
	});
});
