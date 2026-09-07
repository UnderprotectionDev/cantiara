import { expect, test, vi } from "vitest";

import { retryOnce } from "./retry-once";

test("runs a retry callback at most once", () => {
	const retry = vi.fn();
	const runRetry = retryOnce(retry);

	runRetry();
	runRetry();

	expect(retry).toHaveBeenCalledOnce();
});
