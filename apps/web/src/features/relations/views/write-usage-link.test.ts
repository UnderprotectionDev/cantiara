import { expect, test } from "vitest";

import { isMissingProcedure } from "./is-missing-procedure";

test("a missing RPC procedure is distinct from a defined Not Found", () => {
	expect(isMissingProcedure({ message: "Not Found", status: 404 })).toBe(true);
	expect(
		isMissingProcedure({
			code: "NOT_FOUND",
			defined: true,
			message: "Not Found",
			status: 404,
		})
	).toBe(false);
	expect(isMissingProcedure({ code: "BAD_REQUEST", defined: true })).toBe(
		false
	);
});
