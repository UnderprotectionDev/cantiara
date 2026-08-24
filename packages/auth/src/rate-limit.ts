export interface RateLimiter {
	consume: (key: string) => boolean;
}

export function createMemoryRateLimiter(options: {
	windowMs: number;
	maxAttempts: number;
}): RateLimiter {
	const hits = new Map<string, { count: number; resetAt: number }>();

	return {
		consume(key) {
			const now = Date.now();
			const current = hits.get(key);
			if (!current || current.resetAt <= now) {
				hits.set(key, { count: 1, resetAt: now + options.windowMs });
				return true;
			}
			if (current.count >= options.maxAttempts) {
				return false;
			}
			current.count += 1;
			return true;
		},
	};
}

export function clientIpFromRequest(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		const first = forwarded.split(",")[0]?.trim();
		if (first) {
			return first;
		}
	}
	return request.headers.get("x-real-ip") ?? "unknown";
}
