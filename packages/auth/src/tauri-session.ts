export const TAURI_CALLBACK_URL = "cantiara://auth/callback";

export const TAURI_ONE_TIME_CODE_SECONDS = 5 * 60;

const TAURI_WEBVIEW_ORIGINS = [
	"tauri://localhost",
	"http://tauri.localhost",
	"https://tauri.localhost",
] as const;

function loopbackAlias(webOrigin: string): string | null {
	try {
		const url = new URL(webOrigin);
		if (url.hostname === "localhost") {
			url.hostname = "127.0.0.1";
			return url.origin;
		}
		if (url.hostname === "127.0.0.1") {
			url.hostname = "localhost";
			return url.origin;
		}
	} catch {
		return null;
	}
	return null;
}

export function productTrustedOrigins(webOrigin: string): string[] {
	const alias = loopbackAlias(webOrigin);
	return [
		webOrigin,
		...(alias ? [alias] : []),
		TAURI_CALLBACK_URL,
		...TAURI_WEBVIEW_ORIGINS,
	];
}

export function productCorsOrigins(webOrigin: string): string[] {
	const alias = loopbackAlias(webOrigin);
	return [webOrigin, ...(alias ? [alias] : []), ...TAURI_WEBVIEW_ORIGINS];
}

export function isClipperExtensionOrigin(origin: string): boolean {
	try {
		const url = new URL(origin);
		return (
			url.protocol === "chrome-extension:" || url.protocol === "moz-extension:"
		);
	} catch {
		return false;
	}
}

export function isDevelopmentBrowserOrigin(origin: string): boolean {
	if (process.env.NODE_ENV !== "development") {
		return false;
	}
	try {
		const url = new URL(origin);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

export function allowProductCorsOrigin(
	requestOrigin: string,
	webOrigin: string
): string | undefined {
	if (productCorsOrigins(webOrigin).includes(requestOrigin)) {
		return requestOrigin;
	}
	if (isClipperExtensionOrigin(requestOrigin)) {
		return requestOrigin;
	}
	if (isDevelopmentBrowserOrigin(requestOrigin)) {
		return requestOrigin;
	}
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
