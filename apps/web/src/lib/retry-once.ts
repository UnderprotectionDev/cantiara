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
