export function isMissingProcedure(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	if ("defined" in error && error.defined === true) {
		return false;
	}
	const status = "status" in error ? error.status : undefined;
	const code = "code" in error ? error.code : undefined;
	const message = "message" in error ? error.message : undefined;
	return status === 404 || code === "NOT_FOUND" || message === "Not Found";
}
