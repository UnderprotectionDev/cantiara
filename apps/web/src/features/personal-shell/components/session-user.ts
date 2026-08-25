export function sessionUser(
	session: unknown
): { email?: string | null; name?: string | null } | null {
	if (!session || typeof session !== "object" || !("user" in session)) {
		return null;
	}
	const { user } = session as { user?: unknown };
	if (!user || typeof user !== "object") {
		return null;
	}
	return user as { email?: string | null; name?: string | null };
}
