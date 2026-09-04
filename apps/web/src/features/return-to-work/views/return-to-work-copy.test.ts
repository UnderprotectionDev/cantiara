import { expect, test } from "vitest";

import { RETURN_TO_WORK_COPY } from "./return-to-work-copy";

const FORBIDDEN_SURFACE =
	/Daily Focus|Active Working Set|reminder|sprint|mandatory agenda|recent-tabs/;

test("English Return to Work copy is Return to Work", () => {
	expect(RETURN_TO_WORK_COPY.returnToWork).toBe("Return to Work");
	expect(RETURN_TO_WORK_COPY.nextConcreteStep).toBe("Next concrete step");
	expect(RETURN_TO_WORK_COPY.openSourceRecord).toBe("Open source record");
	expect(RETURN_TO_WORK_COPY.sinceYouLastLooked).toBe("Since you last looked");
	expect(JSON.stringify(RETURN_TO_WORK_COPY)).not.toMatch(FORBIDDEN_SURFACE);
});
