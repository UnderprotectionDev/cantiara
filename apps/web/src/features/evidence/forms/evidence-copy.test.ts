import { expect, test } from "vitest";

import { EVIDENCE_COPY } from "./evidence-copy";

test("English Evidence labels stay Bind as evidence and Convert to new record and bind", () => {
	expect(EVIDENCE_COPY.bindAsEvidenceToExistingRecord).toBe(
		"Bind as evidence to existing record"
	);
	expect(EVIDENCE_COPY.convertToNewRecordAndBind).toBe(
		"Convert to new record and bind"
	);
	expect(EVIDENCE_COPY.originLocation).toBe("Origin Location");
	expect(EVIDENCE_COPY.versionPinnedEvidence).toBe("Version-pinned evidence");
	expect(EVIDENCE_COPY.sourceElementNoLongerExists).toBe(
		"Source element no longer exists"
	);
	expect(EVIDENCE_COPY.newerVersionExists).toBe("Newer version exists");
	expect(EVIDENCE_COPY.openSourceRecord).toBe("Open source record");
	expect(EVIDENCE_COPY.supporting).toBe("Supporting");
	expect(EVIDENCE_COPY.contradicting).toBe("Contradicting");
	expect(EVIDENCE_COPY.providesContext).toBe("Provides context");
	expect(EVIDENCE_COPY.inconclusive).toBe("Inconclusive");
	expect(EVIDENCE_COPY.unspecified).toBe("Unspecified");
	expect(EVIDENCE_COPY.founderInterpretation).toBe("Founder interpretation");
	expect(EVIDENCE_COPY.evidenceRole).toBe("Evidence Role");
	expect(EVIDENCE_COPY.evidenceFlow).toBe("Evidence Flow");
});
