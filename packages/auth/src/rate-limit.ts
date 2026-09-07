export interface RateLimiter {
	consume: (key: string) => boolean;
}

export function createMemoryRateLimiter(options: {
	maxEntries?: number;
	windowMs: number;
	maxAttempts: number;
}): RateLimiter {
	const hits = new Map<string, { count: number; resetAt: number }>();
	const maxEntries = Math.max(1, options.maxEntries ?? 10_000);

	return {
		consume(key) {
			const now = Date.now();
			const current = hits.get(key);
			if (!current || current.resetAt <= now) {
				makeRoom(hits, maxEntries, now);
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

function makeRoom(
	hits: Map<string, { count: number; resetAt: number }>,
	maxEntries: number,
	now: number
) {
	for (const [storedKey, stored] of hits) {
		if (stored.resetAt <= now) {
			hits.delete(storedKey);
		}
		if (hits.size < maxEntries) {
			return;
		}
	}
	if (hits.size >= maxEntries) {
		const oldestKey = hits.keys().next().value;
		if (oldestKey) {
			hits.delete(oldestKey);
		}
	}
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
