import { expect, test } from "vitest";

import { SMART_COLLECTIONS_COPY } from "./smart-collections-copy";

const FREE_QUERY_PATTERN = /advanced query|query language|JQL|Lucene|SQL/i;

test("English UI uses Smart Collection and no free query language", () => {
	expect(SMART_COLLECTIONS_COPY.smartCollection).toBe("Smart Collection");
	expect(SMART_COLLECTIONS_COPY.create).toBe("Create Smart Collection");
	expect(SMART_COLLECTIONS_COPY.noPin).toBe(
		"Pinning is not allowed. Membership comes only from conditions."
	);
	expect(JSON.stringify(SMART_COLLECTIONS_COPY)).not.toMatch(
		FREE_QUERY_PATTERN
	);
	expect(SMART_COLLECTIONS_COPY).not.toHaveProperty("query");
});
