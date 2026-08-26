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
