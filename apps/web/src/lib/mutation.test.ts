import { expect, test } from "vitest";

import { presentAtomicWriteUi } from "./mutation";

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
