import { expect, test, vi } from "vitest";

import { retryOnceFor } from "./retry-once";

test("allows one retry callback for an operation target", () => {
	const retry = vi.fn();
	const target = {};
	const retriedTargets = new WeakSet<object>();

	retryOnceFor(target, retriedTargets, retry)?.();
	const secondAttempt = retryOnceFor(target, retriedTargets, retry);

	expect(retry).toHaveBeenCalledOnce();
	expect(secondAttempt).toBeUndefined();
});
