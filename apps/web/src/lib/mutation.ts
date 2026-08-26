export const MUTATION_COPY = {
	cancel: "Cancel",
	conflict: "Conflict",
	currentValue: "Current value",
	finalizing: "Finalizing",
	retry: "Retry",
	undo: "Undo",
} as const;

export function newIdempotencyKey(): string {
	return crypto.randomUUID();
}

export function withHumanMutationEnvelope<TPayload>(input: {
	baseRevision: number;
	idempotencyKey?: string;
	payload: TPayload;
}): {
	baseRevision: number;
	idempotencyKey: string;
	payload: TPayload;
} {
	return {
		baseRevision: input.baseRevision,
		idempotencyKey: input.idempotencyKey ?? newIdempotencyKey(),
		payload: input.payload,
	};
}

export function presentAtomicWriteUi(phase: "pre-barrier" | "post-barrier"): {
	cancelAvailable: boolean;
	label: typeof MUTATION_COPY.cancel | typeof MUTATION_COPY.finalizing;
} {
	if (phase === "pre-barrier") {
		return { cancelAvailable: true, label: MUTATION_COPY.cancel };
	}
	return { cancelAvailable: false, label: MUTATION_COPY.finalizing };
}

export function presentReversibleWriteUi(written: boolean): {
	label: typeof MUTATION_COPY.undo | null;
	undoAvailable: boolean;
} {
	if (!written) {
		return { label: null, undoAvailable: false };
	}
	return { label: MUTATION_COPY.undo, undoAvailable: true };
}
