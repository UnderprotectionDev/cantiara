import { expect, test } from "vitest";

import { VALIDATION_RECORDS_COPY } from "./validation-records-copy";

const FORBIDDEN_SURFACE =
	/survey|timed vot|continuous feedback|vote|voting|poll/i;

test("English Validation Record labels stay Validation Record, Method, and Result", () => {
	expect(VALIDATION_RECORDS_COPY.validationRecord).toBe("Validation Record");
	expect(VALIDATION_RECORDS_COPY.method).toBe("Method");
	expect(VALIDATION_RECORDS_COPY.result).toBe("Result");
	expect(VALIDATION_RECORDS_COPY.createValidationRecord).toBe(
		"Create Validation Record"
	);
	expect(VALIDATION_RECORDS_COPY.assumption).toBe("Assumption");
	expect(VALIDATION_RECORDS_COPY.openQuestion).toBe("Open Question");
	expect(VALIDATION_RECORDS_COPY.decision).toBe("Decision");
	expect(VALIDATION_RECORDS_COPY.related).toBe("Related");
	expect(JSON.stringify(VALIDATION_RECORDS_COPY)).not.toMatch(
		FORBIDDEN_SURFACE
	);
});
