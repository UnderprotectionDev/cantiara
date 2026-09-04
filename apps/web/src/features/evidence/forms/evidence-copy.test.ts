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
});
