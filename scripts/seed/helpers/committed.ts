interface CommittedOutcome {
	status: string;
}

export function assertCommitted<T extends CommittedOutcome>(
	outcome: T,
	label: string
): asserts outcome is T & { status: "committed" } {
	if (outcome.status !== "committed") {
		throw new Error(
			`${label}: expected committed outcome, got ${JSON.stringify(outcome)}`
		);
	}
}
