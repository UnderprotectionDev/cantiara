import { describe, expect, it } from "vitest";

import { SCREENS_COPY } from "./screens-copy";

const OUT_OF_SCOPE_COPY = /User Flow editor|Moodboard|Document/;

describe("Screens copy", () => {
	it("uses Screen English UI and keeps User Flow editor out", () => {
		expect(SCREENS_COPY.screen).toBe("Screen");
		expect(SCREENS_COPY.createScreen).toBe("Create Screen");
		expect(SCREENS_COPY.titleRequired).toBe("Title is required.");
		expect(SCREENS_COPY.detachLink).toBe("Detach Link");
		expect(SCREENS_COPY.convertAndBind).toBe("Convert and Bind");
		expect(SCREENS_COPY.originLocation).toBe("Origin Location");
		expect(SCREENS_COPY.openSourceRecord).toBe("Open Source Record");
		expect(SCREENS_COPY.sourceItemIsGone).toBe("Source item is gone");
		expect(SCREENS_COPY.broken).toBe("Broken");
		expect(SCREENS_COPY.button).toBe("Button");
		expect(SCREENS_COPY.moveToTrash).toBe("Move to Trash");
		expect(JSON.stringify(SCREENS_COPY)).not.toMatch(OUT_OF_SCOPE_COPY);
	});
});
