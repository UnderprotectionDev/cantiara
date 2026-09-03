import { isStaleGeneratedClientError } from "./client-shell-failure";

export function createGeneratedClientReload(reload: () => void) {
	return async function runWithGeneratedClientReload<T>(
		run: () => Promise<T>
	): Promise<T> {
		try {
			return await run();
		} catch (error) {
			if (
				process.env.NODE_ENV !== "development" ||
				!isStaleGeneratedClientError(error)
			) {
				throw error;
			}
			reload();
			return await run();
		}
	};
}
