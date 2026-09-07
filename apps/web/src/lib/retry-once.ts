export function retryOnce(retry: () => void): () => void {
	let retried = false;

	return () => {
		if (retried) {
			return;
		}
		retried = true;
		retry();
	};
}

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
