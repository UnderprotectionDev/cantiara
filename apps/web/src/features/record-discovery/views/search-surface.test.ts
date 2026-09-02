import { expect, test } from "vitest";

import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";
import { isSearchOpenShortcut, SEARCH_SHORTCUT_HINT } from "./search-surface";

test("Search opens in place with Ctrl+/, not as Command Palette", () => {
	expect(RECORD_DISCOVERY_COPY.search).toBe("Search");
	expect(SEARCH_SHORTCUT_HINT).toBe("Ctrl+/");
	expect(
		isSearchOpenShortcut({ ctrlKey: true, key: "/", metaKey: false })
	).toBe(true);
	expect(
		isSearchOpenShortcut({ ctrlKey: false, key: "/", metaKey: true })
	).toBe(true);
	expect(
		isSearchOpenShortcut({ ctrlKey: true, key: "k", metaKey: false })
	).toBe(false);
	expect(
		isSearchOpenShortcut({ ctrlKey: false, key: "/", metaKey: false })
	).toBe(false);
});
