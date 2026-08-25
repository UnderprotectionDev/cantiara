import { expect, test } from "vitest";

import {
	oneTimeCodeFromDeepLink,
	productCorsOrigins,
	productTrustedOrigins,
	TAURI_CALLBACK_URL,
	tauriDeepLinkWithCode,
} from "./tauri-session";

test("the Tauri deep link carries only the one-time code", () => {
	const url = tauriDeepLinkWithCode("one-time-code-value");
	expect(url.startsWith(`${TAURI_CALLBACK_URL}?`)).toBe(true);
	expect(oneTimeCodeFromDeepLink(url)).toBe("one-time-code-value");
});

test("a Tauri deep link with a session or GitHub token is rejected", () => {
	expect(
		oneTimeCodeFromDeepLink(`${TAURI_CALLBACK_URL}?code=abc&token=session`)
	).toBeNull();
	expect(
		oneTimeCodeFromDeepLink(`${TAURI_CALLBACK_URL}?code=abc&access_token=gho_x`)
	).toBeNull();
});

test("product origins include the Tauri callback and webview without forking session policy", () => {
	expect(productTrustedOrigins("http://localhost:3001")).toEqual(
		expect.arrayContaining([
			"http://localhost:3001",
			TAURI_CALLBACK_URL,
			"tauri://localhost",
		])
	);
	expect(productCorsOrigins("http://localhost:3001")).not.toContain(
		TAURI_CALLBACK_URL
	);
});
