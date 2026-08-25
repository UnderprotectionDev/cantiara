export const TAURI_CALLBACK_URL = "cantiara://auth/callback";

export const TAURI_ONE_TIME_CODE_SECONDS = 5 * 60;

const TAURI_WEBVIEW_ORIGINS = [
	"tauri://localhost",
	"http://tauri.localhost",
	"https://tauri.localhost",
] as const;

export function productTrustedOrigins(webOrigin: string): string[] {
	return [webOrigin, TAURI_CALLBACK_URL, ...TAURI_WEBVIEW_ORIGINS];
}

export function productCorsOrigins(webOrigin: string): string[] {
	return [webOrigin, ...TAURI_WEBVIEW_ORIGINS];
}

export function isTauriCallbackURL(url: string): boolean {
	return url === TAURI_CALLBACK_URL || url.startsWith(`${TAURI_CALLBACK_URL}?`);
}

export function tauriDeepLinkWithCode(code: string): string {
	const deepLink = new URL(TAURI_CALLBACK_URL);
	deepLink.searchParams.set("code", code);
	return deepLink.toString();
}

export function oneTimeCodeFromDeepLink(url: string): string | null {
	if (!isTauriCallbackURL(url)) {
		return null;
	}
	try {
		const deepLink = new URL(url);
		const keys = [...deepLink.searchParams.keys()];
		if (keys.length !== 1 || keys[0] !== "code") {
			return null;
		}
		const code = deepLink.searchParams.get("code");
		return code && code.length > 0 ? code : null;
	} catch {
		return null;
	}
}
