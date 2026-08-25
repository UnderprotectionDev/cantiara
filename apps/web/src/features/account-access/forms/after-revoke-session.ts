export const AFTER_CURRENT_REVOKE_PATH = "/login" as const;

export function afterRevokeSession(
	wasCurrent: boolean
): typeof AFTER_CURRENT_REVOKE_PATH | null {
	return wasCurrent ? AFTER_CURRENT_REVOKE_PATH : null;
}
