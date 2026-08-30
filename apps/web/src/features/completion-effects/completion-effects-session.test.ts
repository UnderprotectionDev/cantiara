import { defaultCompletionEffectPreference } from "@cantiara/auth/completion-effects-model";
import { afterEach, expect, test } from "vitest";

import {
	clearCompletionEffectsPresentation,
	closeMutationStatusFromRpc,
	getCompletionEffectsClientSession,
	reportCloseOutcome,
	requestReopenConfirmationFromNotice,
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

test("keeps Work completed when effects are off and starts reopen confirmation without undoing close", () => {
	const shown = reportCloseOutcome(
		defaultCompletionEffectPreference(),
		{
			closeCycleId: "notice-off",
			closureResult: "Completed",
			mutationStatus: "committed",
			workId: "work-1",
		},
		2000,
		{ drawingBudgetHeld: true, reduceMotion: false }
	);
	expect(shown.feedback).toBe("base-notice");
	expect(shown.session.notice).toBe("Work completed");
	expect(shown.session.workStatus).toBe("Closed");
	expect(
		requestReopenConfirmationFromNotice().reopenConfirmationRequested
	).toBe(true);
	expect(getCompletionEffectsClientSession().workStatus).toBe("Closed");
});

test("clears the visible layer on surface change while keeping the client wait", () => {
	const enabled = { ...defaultCompletionEffectPreference(), enabled: true };
	reportCloseOutcome(
		enabled,
		{
			closeCycleId: "surface-a",
			closureResult: "Completed",
			mutationStatus: "committed",
			workId: "work-1",
		},
		4000,
		{ drawingBudgetHeld: true, reduceMotion: false }
	);
	const waitUntil = getCompletionEffectsClientSession().decorativeWaitUntilMs;
	expect(clearCompletionEffectsPresentation().notice).toBeNull();
	expect(getCompletionEffectsClientSession().decorativeWaitUntilMs).toBe(
		waitUntil
	);
});
