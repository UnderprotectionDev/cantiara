import { expect, test } from "vitest";

import { copyProjectStructureError } from "./copy-project-error";

test("a committed or replayed copy does not show an error", () => {
	expect(copyProjectStructureError({ status: "committed" })).toBeNull();
	expect(copyProjectStructureError({ status: "replayed" })).toBeNull();
});

test("a conflicting copy shows Conflict", () => {
	expect(copyProjectStructureError({ status: "conflict" })).toBe("Conflict");
});

test("a missing Project Name shows Project Name", () => {
	expect(
		copyProjectStructureError({
			reason: "missing-project-name",
			status: "rejected",
		})
	).toBe("Project Name");
});

test("a taken or invalid Short code shows Short code", () => {
	expect(
		copyProjectStructureError({
			reason: "short-code-taken",
			status: "rejected",
		})
	).toBe("Short code");
	expect(
		copyProjectStructureError({
			reason: "short-code-invalid",
			status: "rejected",
		})
	).toBe("Short code");
});
