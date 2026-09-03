import { expect, test } from "vitest";

import { SMART_COLLECTIONS_COPY } from "./smart-collections-copy";

const FREE_QUERY_PATTERN = /advanced query|query language|JQL|Lucene|SQL/i;
const SCORE_PATTERN = /score|coverage|readiness|dashboard/i;

test("English UI uses Smart Collection and no free query language", () => {
	expect(SMART_COLLECTIONS_COPY.smartCollection).toBe("Smart Collection");
	expect(SMART_COLLECTIONS_COPY.addCondition).toBe("Add condition");
	expect(SMART_COLLECTIONS_COPY.noPin).toBe(
		"Pinning is not allowed. Membership comes only from conditions."
	);
	expect(SMART_COLLECTIONS_COPY.noneYet).toBe("No Smart Collection yet.");
	expect(SMART_COLLECTIONS_COPY.empty).toBe(
		"No records match these conditions."
	);
	expect(JSON.stringify(SMART_COLLECTIONS_COPY)).not.toMatch(
		FREE_QUERY_PATTERN
	);
	expect(SMART_COLLECTIONS_COPY).not.toHaveProperty("query");
	expect(SMART_COLLECTIONS_COPY.insights).toBe("Insights");
	expect(SMART_COLLECTIONS_COPY.age).toBe("Age");
	expect(SMART_COLLECTIONS_COPY.timeInStatus).toBe("Time in status");
	expect(JSON.stringify(SMART_COLLECTIONS_COPY)).not.toMatch(SCORE_PATTERN);
});
