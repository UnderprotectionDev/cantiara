import {
	type CloseMutationStatus,
	type CloseOutcomeInput,
	type CompletionEffectPreference,
	type CompletionEffectsPresentation,
	clearPresentationOnSurfaceChange,
	closeOutcomeToAcceptance,
	defaultCompletionEffectsPresentation,
	drawingBudgetHeld,
	idleCompletionEffectsClientSession,
	observeCloseAcceptance,
	requestReopenFromNotice,
} from "@cantiara/auth/completion-effects-model";

let session = idleCompletionEffectsClientSession();
let lastFrameGapMs = 0;
const listeners = new Set<() => void>();

function emit() {
	for (const listener of listeners) {
		listener();
	}
}

export function getCompletionEffectsClientSession() {
	return session;
}

export function subscribeCompletionEffectsClientSession(
	onStoreChange: () => void
) {
	listeners.add(onStoreChange);
	return () => {
		listeners.delete(onStoreChange);
	};
}

export function closeMutationStatusFromRpc(
	status: "committed" | "replayed" | "rejected" | "conflict" | "stale"
): CloseMutationStatus {
	if (status === "committed") {
		return "committed";
	}
	if (status === "replayed") {
		return "replayed";
	}
	if (status === "rejected") {
		return "rejected";
	}
	return "conflict";
}

export function recordDrawingFrameGap(frameGapMs: number) {
	lastFrameGapMs = frameGapMs;
}

export function readCompletionEffectsPresentation(): CompletionEffectsPresentation {
	if (typeof window === "undefined") {
		return defaultCompletionEffectsPresentation;
	}
	return {
		drawingBudgetHeld: lastFrameGapMs > 0 && drawingBudgetHeld(lastFrameGapMs),
		reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	};
}

export function sampleDrawingBudget(onSampled: () => void) {
	let cancelled = false;
	let second = 0;
	const first = window.requestAnimationFrame((start) => {
		second = window.requestAnimationFrame((end) => {
			if (cancelled) {
				return;
			}
			recordDrawingFrameGap(end - start);
			onSampled();
		});
	});
	return () => {
		cancelled = true;
		window.cancelAnimationFrame(first);
		window.cancelAnimationFrame(second);
	};
}

export function reportCloseOutcome(
	preference: Pick<CompletionEffectPreference, "enabled">,
	input: CloseOutcomeInput,
	nowMs: number,
	presentation: CompletionEffectsPresentation = readCompletionEffectsPresentation()
) {
	const next = observeCloseAcceptance(
		preference,
		session,
		closeOutcomeToAcceptance(input),
		nowMs,
		presentation
	);
	({ session } = next);
	emit();
	return next;
}

export function requestReopenConfirmationFromNotice() {
	session = requestReopenFromNotice(session);
	emit();
	return session;
}

export function clearCompletionEffectsPresentation() {
	session = clearPresentationOnSurfaceChange(session);
	emit();
	return session;
}

export function resetCompletionEffectsClientSession() {
	session = idleCompletionEffectsClientSession();
	lastFrameGapMs = 0;
	emit();
}
