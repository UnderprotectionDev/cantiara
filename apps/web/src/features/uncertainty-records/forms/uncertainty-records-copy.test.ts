import { expect, test } from "vitest";

import { UNCERTAINTY_COPY } from "./uncertainty-records-copy";

const FUTURE_COPY = /Based on|Basis for|Refuted Assumption Review/i;

test("English Assumption labels stay Assumption and the four lives", () => {
	expect(UNCERTAINTY_COPY.assumption).toBe("Assumption");
	expect(UNCERTAINTY_COPY.open).toBe("Open");
	expect(UNCERTAINTY_COPY.confirmed).toBe("Confirmed");
	expect(UNCERTAINTY_COPY.refuted).toBe("Refuted");
	expect(UNCERTAINTY_COPY.noLongerApplicable).toBe("No longer applicable");
	expect(UNCERTAINTY_COPY.statement).toBe("Statement");
	expect(UNCERTAINTY_COPY.rationale).toBe("Rationale");
	expect(UNCERTAINTY_COPY.missingEvidence).toBe("Missing evidence");
	expect(UNCERTAINTY_COPY.createAssumption).toBe("Create Assumption");
	expect(JSON.stringify(UNCERTAINTY_COPY)).not.toMatch(FUTURE_COPY);
});

test("Open Question English UI matches the uncertainty spec", () => {
	expect(UNCERTAINTY_COPY.openQuestion).toBe("Open Question");
	expect(UNCERTAINTY_COPY.open).toBe("Open");
	expect(UNCERTAINTY_COPY.answered).toBe("Answered");
	expect(UNCERTAINTY_COPY.noLongerApplicable).toBe("No longer applicable");
	expect(UNCERTAINTY_COPY.assumption).toBe("Assumption");
	expect(UNCERTAINTY_COPY.createOpenQuestion).toBe("Create Open Question");
	expect(UNCERTAINTY_COPY.evidenceMissing).toBe("Evidence missing");
	expect(JSON.stringify(UNCERTAINTY_COPY)).not.toMatch(FUTURE_COPY);
});
