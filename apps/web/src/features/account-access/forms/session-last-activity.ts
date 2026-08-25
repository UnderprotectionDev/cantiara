import { formatDateTime } from "@cantiara/auth/account-preferences-format";
import type { AccountPreferencesInput } from "@cantiara/auth/account-preferences-model";

export function sessionLastActivityDisplay(
	isoInstant: string,
	preferences: AccountPreferencesInput
): string {
	return formatDateTime(new Date(isoInstant), preferences);
}
