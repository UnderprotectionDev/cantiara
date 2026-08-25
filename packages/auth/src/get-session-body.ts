function isAbsent(value: unknown): boolean {
	return value === null || value === undefined;
}

export function isLoggedOutGetSessionBody(payload: unknown): boolean {
	if (isAbsent(payload)) {
		return true;
	}
	if (typeof payload !== "object") {
		return false;
	}
	const { session, user } = payload as { session?: unknown; user?: unknown };
	return isAbsent(session) && isAbsent(user);
}
