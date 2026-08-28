import { Prisma } from "@cantiara/db";

const MAX_RETRIES = 3;

function isRetryableWrite(error: unknown): boolean {
	const code =
		typeof error === "object" && error !== null
			? (error as { code?: unknown }).code
			: undefined;
	const text = String(error);
	return (
		(error instanceof Prisma.PrismaClientKnownRequestError ||
			code !== undefined) &&
		(code === "P2034" || code === "P2002" || text.includes("P2002"))
	);
}

/**
 * Prisma recommends retrying Serializable transaction failures (P2034).
 * Callers must only use this for transactions whose work is idempotent and
 * has no external side effects.
 */
export async function withPrismaWriteRetry<T>(
	operation: () => Promise<T>,
	maxRetries = MAX_RETRIES
): Promise<T> {
	for (let attempt = 0; ; attempt += 1) {
		try {
			// biome-ignore lint/performance/noAwaitInLoops: retries must be sequential.
			return await operation();
		} catch (error) {
			if (!isRetryableWrite(error) || attempt >= maxRetries) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
		}
	}
}
