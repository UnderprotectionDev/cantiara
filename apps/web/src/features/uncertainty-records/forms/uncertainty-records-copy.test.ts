import { expect, test } from "vitest";

import { UNCERTAINTY_COPY } from "./uncertainty-records-copy";

const FUTURE_QUEUE = /Refuted Assumption Review|Based on/;

test("Open Question English UI matches the uncertainty spec", () => {
	expect(UNCERTAINTY_COPY.openQuestion).toBe("Open Question");
	expect(UNCERTAINTY_COPY.open).toBe("Open");
	expect(UNCERTAINTY_COPY.answered).toBe("Answered");
	expect(UNCERTAINTY_COPY.noLongerApplicable).toBe("No longer applicable");
	expect(UNCERTAINTY_COPY.assumption).toBe("Assumption");
	expect(JSON.stringify(UNCERTAINTY_COPY)).not.toMatch(FUTURE_QUEUE);
});
