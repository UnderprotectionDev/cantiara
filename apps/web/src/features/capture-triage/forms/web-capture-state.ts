export function pairingCodeDisplay(code: string): string {
	return code;
}

export function extensionLinkSearchInput(query: string): { query?: string } {
	const trimmed = query.trim();
	return trimmed ? { query: trimmed } : {};
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
