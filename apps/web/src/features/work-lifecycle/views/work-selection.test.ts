import { expect, test } from "vitest";

import { nextSelectedWorkId } from "./work-selection";

test("clicking Work again closes the open record", () => {
	expect(nextSelectedWorkId(null, "work-1")).toBe("work-1");
	expect(nextSelectedWorkId("work-1", "work-1")).toBe(null);
	expect(nextSelectedWorkId("work-1", "work-2")).toBe("work-2");
});
