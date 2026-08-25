import type { AccountPreferencesInput } from "@cantiara/auth/account-preferences";
import { formatDateTime } from "@cantiara/auth/account-preferences";

export function sessionLastActivityDisplay(
	isoInstant: string,
	preferences: AccountPreferencesInput
): string {
	return formatDateTime(new Date(isoInstant), preferences);
}
