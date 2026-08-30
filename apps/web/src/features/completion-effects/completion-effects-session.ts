import {
	type CloseMutationStatus,
	type CloseOutcomeInput,
	type CompletionEffectPreference,
	closeOutcomeToAcceptance,
	idleCompletionEffectsClientSession,
	observeCloseAcceptance,
} from "@cantiara/auth/completion-effects-model";

let session = idleCompletionEffectsClientSession();
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

export function reportCloseOutcome(
	preference: Pick<CompletionEffectPreference, "enabled">,
	input: CloseOutcomeInput,
	nowMs: number
) {
	const next = observeCloseAcceptance(
		preference,
		session,
		closeOutcomeToAcceptance(input),
		nowMs
	);
	({ session } = next);
	emit();
	return next;
}

export function resetCompletionEffectsClientSession() {
	session = idleCompletionEffectsClientSession();
	emit();
}
