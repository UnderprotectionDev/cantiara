export type SequentialTriageMode = "list" | "sequential";

export interface SequentialTriageView<T extends { id: string }> {
	focused: T | null;
	mode: SequentialTriageMode;
	previousAvailable: boolean;
}

export function startSequentialFocus(
	remainingIds: readonly string[],
	fromId?: string
): string | null {
	if (remainingIds.length === 0) {
		return null;
	}
	if (fromId && remainingIds.includes(fromId)) {
		return fromId;
	}
	return remainingIds[0] ?? null;
}

export function goBackSequentialFocus(
	remainingIds: readonly string[],
	focusedId: string | null
): string | null {
	if (!focusedId) {
		return null;
	}
	const index = remainingIds.indexOf(focusedId);
	if (index > 0) {
		return remainingIds[index - 1] ?? focusedId;
	}
	return focusedId;
}

export function nextSequentialFocus(
	remainingIdsBeforeExit: readonly string[],
	consumedId: string
): string | null {
	const index = remainingIdsBeforeExit.indexOf(consumedId);
	if (index < 0) {
		return consumedId;
	}
	return remainingIdsBeforeExit[index + 1] ?? null;
}

export function sequentialTriageView<T extends { id: string }>(
	remaining: readonly T[],
	focusedId: string | null
): SequentialTriageView<T> {
	if (!focusedId) {
		return { focused: null, mode: "list", previousAvailable: false };
	}
	const index = remaining.findIndex((item) => item.id === focusedId);
	const focused = remaining[index];
	if (!focused) {
		return { focused: null, mode: "list", previousAvailable: false };
	}
	return {
		focused,
		mode: "sequential",
		previousAvailable: index > 0,
	};
}
