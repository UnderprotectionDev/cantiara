import { SESSIONS_PATH } from "./post-sign-in-path";

export const AFTER_CURRENT_REVOKE_PATH =
	`/login?redirect=${SESSIONS_PATH}` as const;

export function afterRevokeSession(
	wasCurrent: boolean
): typeof AFTER_CURRENT_REVOKE_PATH | null {
	return wasCurrent ? AFTER_CURRENT_REVOKE_PATH : null;
}
