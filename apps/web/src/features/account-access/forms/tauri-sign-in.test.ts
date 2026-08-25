import {
	oneTimeCodeFromDeepLink,
	TAURI_CALLBACK_URL,
} from "@cantiara/auth/tauri-session";
import { expect, test } from "vitest";

test("desktop deep link yields a one-time code and not a session token", () => {
	expect(
		oneTimeCodeFromDeepLink(`${TAURI_CALLBACK_URL}?code=desktop-code`)
	).toBe("desktop-code");
	expect(
		oneTimeCodeFromDeepLink(
			`${TAURI_CALLBACK_URL}?code=desktop-code&token=nope`
		)
	).toBeNull();
});
