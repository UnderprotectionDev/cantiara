import { expect, test } from "vitest";

import { ROADMAP_COPY, ROADMAP_HORIZONS } from "./roadmap-copy";

const FORBIDDEN_PATTERN =
	/Show on Roadmap|Initiative|Parked|Theme record|Kanban column|sprint/i;

test("English Roadmap copy uses Roadmap, Now, Next, Later", () => {
	expect(ROADMAP_COPY.roadmap).toBe("Roadmap");
	expect(ROADMAP_COPY.now).toBe("Now");
	expect(ROADMAP_COPY.next).toBe("Next");
	expect(ROADMAP_COPY.later).toBe("Later");
	expect(ROADMAP_COPY.productDirection).toBe("Product direction");
	expect(ROADMAP_COPY.allWorkTypes).toBe("All Work types");
	expect(ROADMAP_COPY.unplaced).toBe("No horizon");
	expect(ROADMAP_COPY.openSourceRecord).toBe("Open source record");
	expect(ROADMAP_HORIZONS).toEqual(["Now", "Next", "Later"]);
	expect(JSON.stringify(ROADMAP_COPY)).not.toMatch(FORBIDDEN_PATTERN);
});
