export const WEB_CAPTURE_COPY = {
	browser: "Browser",
	device: "Device",
	extensionLinks: "Extension links",
	lastUse: "Last use",
	originUrl: "Origin URL",
	pairingCode: "Pairing code",
	permissionDeclined: "Wide page read was declined. The clip was not widened.",
	reauthorize: "Re-authorize this extension to send again.",
	searchInbox: "Search Inbox",
	send: "Send",
	sensitivePage:
		"This page may be sensitive. The clip uses the current tab only.",
	targetInbox: "Target Inbox",
	unpaired: "Pair this extension to send to Capture Inbox.",
	webCapture: "Web Capture",
	wideReadPermission:
		"Wide page read would include the full page. Declining keeps the selected clip.",
	workspaceCaptureInbox: "Workspace Capture Inbox",
} as const;

export const TOKEN_STORAGE_KEY = "extension-link-token";

function trimTrailingSlash(url: string): string {
	if (url.endsWith("/")) {
		return url.slice(0, -1);
	}
	return url;
}

export function serverUrl(): string {
	const fromEnv = import.meta.env.WXT_SERVER_URL;
	if (typeof fromEnv === "string" && fromEnv.length > 0) {
		return trimTrailingSlash(fromEnv);
	}
	return "http://localhost:3000";
}

export function clipperFamilyFromUserAgent(
	userAgent: string
): "chromium" | "firefox" | "safari" | "unknown" {
	if (userAgent.includes("Firefox") && !userAgent.includes("Seamonkey")) {
		return "firefox";
	}
	if (
		userAgent.includes("Safari") &&
		!userAgent.includes("Chrome") &&
		!userAgent.includes("Chromium") &&
		!userAgent.includes("Edg")
	) {
		return "safari";
	}
	if (
		userAgent.includes("Chrome") ||
		userAgent.includes("Chromium") ||
		userAgent.includes("Edg") ||
		userAgent.includes("Brave") ||
		userAgent.includes("Arc")
	) {
		return "chromium";
	}
	return "unknown";
}

export function clipperBrowserFromUserAgent(userAgent: string): string {
	if (userAgent.includes("Edg")) {
		return "Edge";
	}
	if (userAgent.includes("Brave")) {
		return "Brave";
	}
	if (userAgent.includes("Firefox")) {
		return "Firefox";
	}
	if (
		userAgent.includes("Safari") &&
		!userAgent.includes("Chrome") &&
		!userAgent.includes("Chromium")
	) {
		return "Safari";
	}
	if (userAgent.includes("Chrome") || userAgent.includes("Chromium")) {
		return "Chrome";
	}
	return "Unknown";
}

export function clipperDeviceFromUserAgent(userAgent: string): string {
	if (userAgent.includes("iPhone")) {
		return "iPhone";
	}
	if (userAgent.includes("iPad")) {
		return "iPad";
	}
	if (userAgent.includes("Android")) {
		return "Android";
	}
	if (userAgent.includes("Mac")) {
		return "Mac";
	}
	if (userAgent.includes("Win")) {
		return "Windows";
	}
	if (userAgent.includes("Linux")) {
		return "Linux";
	}
	return "Unknown device";
}

export function sendPayloadFor(clip: {
	kind: string;
	originUrl: string;
	screenshot?: string;
	selectedImage?: string;
	selectedText?: string;
}) {
	let body = "";
	if (clip.kind === "selected-text") {
		body = clip.selectedText ?? "";
	} else if (clip.kind === "url") {
		body = clip.originUrl;
	}
	return {
		attachmentRef: clip.selectedImage || clip.screenshot || null,
		body,
		kind: "capture-inbox-item" as const,
		link: clip.originUrl,
		origin: clip.originUrl,
	};
}
