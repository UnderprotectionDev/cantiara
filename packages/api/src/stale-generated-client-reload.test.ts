import { describe, expect, it } from "bun:test";

import {
	CLIENT_SHELL_COPY,
	isStaleGeneratedClientError,
	toMainFlowFailureError,
} from "./client-shell-failure";
import { createGeneratedClientReload } from "./stale-generated-client-reload";

const UNKNOWN_INCLUDE = /Unknown field/;

describe("generated Prisma client reload", () => {
	it("retries a stale generated-client write once after dropping the in-memory client", async () => {
		const previous = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";
		let reloads = 0;
		let attempts = 0;
		const run = createGeneratedClientReload(() => {
			reloads += 1;
		});

		const result = await run(() => {
			attempts += 1;
			if (attempts === 1) {
				return Promise.reject(
					new Error(
						"Unknown argument `resolvedAt`. Available options are marked with ?."
					)
				);
			}
			return Promise.resolve("saved");
		});

		process.env.NODE_ENV = previous;
		expect(result).toBe("saved");
		expect(attempts).toBe(2);
		expect(reloads).toBe(1);
	});

	it("does not retry a failure that is not a stale generated client", async () => {
		const previous = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";
		let reloads = 0;
		const run = createGeneratedClientReload(() => {
			reloads += 1;
		});

		await expect(
			run(() => Promise.reject(new Error("payload mismatch")))
		).rejects.toThrow("payload mismatch");
		process.env.NODE_ENV = previous;
		expect(reloads).toBe(0);
	});

	it("does not retry stale generated-client errors outside development", async () => {
		const previous = process.env.NODE_ENV;
		process.env.NODE_ENV = "test";
		let reloads = 0;
		const run = createGeneratedClientReload(() => {
			reloads += 1;
		});

		await expect(
			run(() =>
				Promise.reject(
					new Error(
						"Unknown field 'originWork' for include statement on model 'Work'."
					)
				)
			)
		).rejects.toThrow(UNKNOWN_INCLUDE);
		process.env.NODE_ENV = previous;
		expect(reloads).toBe(0);
	});
});

describe("stale generated client detection", () => {
	it("treats a missing current-models gate as the restart-after-generate reason", () => {
		const error = new Error(
			"Prisma client is missing current models; restart the API after prisma generate"
		);
		expect(isStaleGeneratedClientError(error)).toBe(true);
		expect(
			toMainFlowFailureError(error, undefined, { trackingId: "CANT-DEAD0001" })
				.message
		).toBe(CLIENT_SHELL_COPY.staleGeneratedClient);
	});
});
