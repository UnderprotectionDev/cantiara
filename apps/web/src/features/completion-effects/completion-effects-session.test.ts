import { defaultCompletionEffectPreference } from "@cantiara/auth/completion-effects-model";
import { afterEach, expect, test } from "vitest";

import {
	closeMutationStatusFromRpc,
	getCompletionEffectsClientSession,
	reportCloseOutcome,
	resetCompletionEffectsClientSession,
} from "./completion-effects-session";

afterEach(() => {
	resetCompletionEffectsClientSession();
});

test("maps close RPC replay and stale outcomes without treating them as a new close", () => {
	expect(closeMutationStatusFromRpc("replayed")).toBe("replayed");
	expect(closeMutationStatusFromRpc("stale")).toBe("conflict");
	expect(closeMutationStatusFromRpc("rejected")).toBe("rejected");
});

test("keeps Completion Effects wait on this visible client session only", () => {
	const enabled = { ...defaultCompletionEffectPreference(), enabled: true };
	const first = reportCloseOutcome(
		enabled,
		{
			closeCycleId: "tab-a",
			closureResult: "Completed",
			mutationStatus: "committed",
			workId: "work-1",
		},
		1000
	);
	expect(first.feedback).toBe("effect");
	expect(getCompletionEffectsClientSession().lastCloseCycleId).toBe("tab-a");
	expect(
		reportCloseOutcome(
			enabled,
			{
				closeCycleId: "tab-a",
				closureResult: "Completed",
				mutationStatus: "replayed",
				workId: "work-1",
			},
			1010
		).feedback
	).toBe("none");
});
