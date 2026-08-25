export const SESSION_IDLE_SECONDS = 60 * 60 * 12;

export const SESSION_ABSOLUTE_SECONDS = 60 * 60 * 24 * 30;

export const SESSION_UPDATE_AGE_SECONDS = 60;

export const UNKNOWN_DEVICE = "Unknown device";

export function isPastAbsoluteLifetime(
	createdAt: Date,
	now: Date = new Date()
): boolean {
	return now.getTime() - createdAt.getTime() > SESSION_ABSOLUTE_SECONDS * 1000;
}

export function isPastIdleExpiry(
	expiresAt: Date,
	now: Date = new Date()
): boolean {
	return now.getTime() >= expiresAt.getTime();
}

export function isExpiredSessionLifetime(input: {
	createdAt: Date;
	expiresAt: Date;
	now: Date;
}): boolean {
	return (
		isPastAbsoluteLifetime(input.createdAt, input.now) ||
		isPastIdleExpiry(input.expiresAt, input.now)
	);
}

export function deviceFromUserAgent(
	userAgent: string | null | undefined
): string {
	if (!userAgent) {
		return UNKNOWN_DEVICE;
	}
	if (userAgent.includes("iPhone")) {
		return "iPhone";
	}
	if (userAgent.includes("iPad")) {
		return "iPad";
	}
	if (userAgent.includes("Android")) {
		return "Android";
	}
	if (userAgent.includes("Macintosh")) {
		return "Mac";
	}
	if (userAgent.includes("Windows")) {
		return "Windows";
	}
	if (userAgent.includes("Linux")) {
		return "Linux";
	}
	return UNKNOWN_DEVICE;
}
