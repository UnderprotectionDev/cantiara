import { expect, test, vi } from "vitest";

import { retryOnce, retryOnceFor } from "./retry-once";

test("runs a retry callback at most once", () => {
	const retry = vi.fn();
	const runRetry = retryOnce(retry);

	runRetry();
	runRetry();

	expect(retry).toHaveBeenCalledOnce();
});

test("allows one retry callback for an operation target", () => {
	const retry = vi.fn();
	const target = {};
	const retriedTargets = new WeakSet<object>();

	retryOnceFor(target, retriedTargets, retry)?.();
	const secondAttempt = retryOnceFor(target, retriedTargets, retry);

	expect(retry).toHaveBeenCalledOnce();
	expect(secondAttempt).toBeUndefined();
});
