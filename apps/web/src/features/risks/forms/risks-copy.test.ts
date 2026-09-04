import { expect, test } from "vitest";

import { RISKS_COPY } from "./risks-copy";

const SCORE_COPY = /priority score|wsjf|risk score|health verdict/i;
const MIXED_KIND = /Bug|Test Gap|Production Incident/;

test("English Risk labels stay Risk and the five statuses", () => {
	expect(RISKS_COPY.risk).toBe("Risk");
	expect(RISKS_COPY.open).toBe("Open");
	expect(RISKS_COPY.mitigating).toBe("Mitigating");
	expect(RISKS_COPY.occurred).toBe("Occurred");
	expect(RISKS_COPY.resolved).toBe("Resolved");
	expect(RISKS_COPY.accepted).toBe("Accepted");
	expect(RISKS_COPY.impact).toBe("Impact");
	expect(RISKS_COPY.probability).toBe("Probability");
	expect(RISKS_COPY.responseMitigation).toBe("Response/mitigation");
	expect(RISKS_COPY.createRisk).toBe("Create Risk");
	expect(JSON.stringify(RISKS_COPY)).not.toMatch(SCORE_COPY);
	expect(JSON.stringify(RISKS_COPY)).not.toMatch(MIXED_KIND);
});
