export function retryOnceFor<T extends object>(
	target: T,
	retriedTargets: WeakSet<T>,
	retry: () => void
): (() => void) | undefined {
	if (retriedTargets.has(target)) {
		return;
	}

	return () => {
		if (retriedTargets.has(target)) {
			return;
		}
		retriedTargets.add(target);
		retry();
	};
}
