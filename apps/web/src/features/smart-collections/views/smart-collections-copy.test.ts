import { expect, test } from "vitest";

import { SMART_COLLECTIONS_COPY } from "./smart-collections-copy";

const FREE_QUERY_PATTERN = /advanced query|query language|JQL|Lucene|SQL/i;
const SCORE_PATTERN = /score|coverage|readiness|dashboard/i;

test("English UI uses Smart Collection presentation labels", () => {
	expect(SMART_COLLECTIONS_COPY.smartCollection).toBe("Smart Collection");
	expect(SMART_COLLECTIONS_COPY.subscribe).toBe("Subscribe");
	expect(SMART_COLLECTIONS_COPY.notifyOnLeave).toBe("Notify on leave");
	expect(SMART_COLLECTIONS_COPY.turnOnSubscribeFirst).toBe(
		"Turn on Subscribe first."
	);
	expect(SMART_COLLECTIONS_COPY.addCondition).toBe("Add condition");
	expect(SMART_COLLECTIONS_COPY.gallery).toBe("Gallery");
	expect(SMART_COLLECTIONS_COPY.list).toBe("List");
	expect(SMART_COLLECTIONS_COPY.table).toBe("Table");
	expect(SMART_COLLECTIONS_COPY.namedView).toBe("Named view");
	expect(SMART_COLLECTIONS_COPY.defaultNamedView).toBe("Default");
	expect(SMART_COLLECTIONS_COPY.newWork).toBe("New work");
	expect(SMART_COLLECTIONS_COPY.none).toBe("None");
	expect(SMART_COLLECTIONS_COPY.purpose).toBe("Purpose");
	expect(SMART_COLLECTIONS_COPY.unsavedChanges).toBe("Unsaved changes");
	expect(SMART_COLLECTIONS_COPY.save).toBe("Save");
	expect(SMART_COLLECTIONS_COPY.saveAs).toBe("Save as");
	expect(SMART_COLLECTIONS_COPY.revert).toBe("Revert");
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
