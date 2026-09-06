import { describe, expect, it } from "vitest";

import { SCREENS_COPY } from "./screens-copy";

const OUT_OF_SCOPE_COPY = /User Flow editor|Moodboard|Document/;

describe("Screens copy", () => {
	it("uses Screen English UI and keeps User Flow editor out", () => {
		expect(SCREENS_COPY.screen).toBe("Screen");
		expect(SCREENS_COPY.createScreen).toBe("Create Screen");
		expect(JSON.stringify(SCREENS_COPY)).not.toMatch(OUT_OF_SCOPE_COPY);
	});
});
