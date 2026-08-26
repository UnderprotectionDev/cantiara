import { expect, test } from "vitest";

import { MUTATION_COPY, presentAtomicWriteUi } from "./mutation";

test("a staged multi-step write can still Cancel", () => {
	expect(presentAtomicWriteUi("pre-barrier")).toEqual({
		cancelAvailable: true,
		label: MUTATION_COPY.cancel,
	});
});

test("after the commit barrier the UI shows Finalizing and Cancel is not available", () => {
	expect(presentAtomicWriteUi("post-barrier")).toEqual({
		cancelAvailable: false,
		label: MUTATION_COPY.finalizing,
	});
});
