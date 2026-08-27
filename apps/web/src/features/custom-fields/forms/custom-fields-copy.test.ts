import { expect, test } from "vitest";

import {
	BINDABLE_RECORD_TYPES,
	CUSTOM_FIELD_COPY,
	CUSTOM_FIELD_TYPES,
} from "./custom-fields-copy";

const LOOKUP_FORMULA_PATTERN = /lookup|formula/i;
const TAG_MAINTENANCE_PATTERN =
	/parentTag|tagHierarchy|renameTag|mergeTags|tagMerge/i;

test("English Custom field catalog is the closed six types", () => {
	expect(CUSTOM_FIELD_COPY.customField).toBe("Custom field");
	expect(CUSTOM_FIELD_TYPES).toEqual([
		"Text",
		"Number",
		"Boolean",
		"Date",
		"Single select",
		"Multi select",
	]);
	expect(BINDABLE_RECORD_TYPES).toEqual([
		"Work",
		"Feedback",
		"User Research Session",
		"Risk",
		"Assumption",
		"Decision",
		"Test Handoff",
		"Test Session",
		"Planned Test Scenario",
		"Test Gap",
		"Production Incident",
		"Milestone",
		"Project Release",
	]);
	expect(JSON.stringify(CUSTOM_FIELD_COPY)).not.toMatch(LOOKUP_FORMULA_PATTERN);
	expect(JSON.stringify(CUSTOM_FIELD_TYPES)).not.toMatch(
		LOOKUP_FORMULA_PATTERN
	);
	expect(JSON.stringify(CUSTOM_FIELD_COPY)).not.toMatch(
		TAG_MAINTENANCE_PATTERN
	);
	expect(BINDABLE_RECORD_TYPES).not.toContain("Session Test");
	expect(BINDABLE_RECORD_TYPES).not.toContain("Test assessment");
	expect(BINDABLE_RECORD_TYPES).not.toContain("Document");
});
