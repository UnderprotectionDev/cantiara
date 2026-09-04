import { expect, test } from "vitest";

import { DECISIONS_COPY } from "./decisions-copy";

const VOTING_COPY = /vote|voting|score|winner|alternative set/i;

test("English Decision labels stay Decision, Valid, and Withdrawn", () => {
	expect(DECISIONS_COPY.decision).toBe("Decision");
	expect(DECISIONS_COPY.valid).toBe("Valid");
	expect(DECISIONS_COPY.withdrawn).toBe("Withdrawn");
	expect(DECISIONS_COPY.withdraw).toBe("Withdraw");
	expect(DECISIONS_COPY.decisionText).toBe("Decision text");
	expect(DECISIONS_COPY.rationale).toBe("Rationale");
	expect(DECISIONS_COPY.createDecision).toBe("Create Decision");
	expect(DECISIONS_COPY.openCurrentDecision).toBe("Open current decision");
	expect(DECISIONS_COPY.allDecisions).toBe("All Decisions");
	expect(DECISIONS_COPY.supersedeAnotherDecision).toBe(
		"Supersede another decision"
	);
	expect(JSON.stringify(DECISIONS_COPY)).not.toMatch(VOTING_COPY);
});
