import { expect, test } from "vitest";

import { hasSilentMeta } from "./silent-query-meta";

test("silent meta skips the main-flow toast", () => {
	expect(hasSilentMeta({ silent: true })).toBe(true);
	expect(hasSilentMeta({ silent: false })).toBe(false);
	expect(hasSilentMeta(undefined)).toBe(false);
	expect(hasSilentMeta({})).toBe(false);
});
