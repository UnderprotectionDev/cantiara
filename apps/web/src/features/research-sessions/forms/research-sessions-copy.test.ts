import { expect, test } from "vitest";

import { RESEARCH_SESSIONS_COPY } from "./research-sessions-copy";

const LEGAL_JUDGMENT = /GDPR|lawful basis|certified compliant/i;
const CALENDAR_OR_CRM =
	/invite|attendance|CRM stage|research score|calendar event/i;

test("English Research Session labels stay Research Session and consent values", () => {
	expect(RESEARCH_SESSIONS_COPY.researchSession).toBe("Research Session");
	expect(RESEARCH_SESSIONS_COPY.notAsked).toBe("Not asked");
	expect(RESEARCH_SESSIONS_COPY.allowed).toBe("Allowed");
	expect(RESEARCH_SESSIONS_COPY.notAllowed).toBe("Not allowed");
	expect(RESEARCH_SESSIONS_COPY.notApplicable).toBe("Not applicable");
	expect(RESEARCH_SESSIONS_COPY.planned).toBe("Planned");
	expect(RESEARCH_SESSIONS_COPY.completed).toBe("Completed");
	expect(RESEARCH_SESSIONS_COPY.cancelled).toBe("Cancelled");
	expect(RESEARCH_SESSIONS_COPY.createResearchSession).toBe(
		"Create Research Session"
	);
	expect(RESEARCH_SESSIONS_COPY.consentIsNotLegalJudgment).toBe(
		"Consent is not a legal compliance judgment."
	);
	expect(JSON.stringify(RESEARCH_SESSIONS_COPY)).not.toMatch(LEGAL_JUDGMENT);
	expect(JSON.stringify(RESEARCH_SESSIONS_COPY)).not.toMatch(CALENDAR_OR_CRM);
});
