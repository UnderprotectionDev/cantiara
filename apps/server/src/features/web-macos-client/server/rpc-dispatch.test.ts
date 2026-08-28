/**
 * Client Shell seam — unmatched RPC still issues a Support reference.
 * docs/specs/03-web-macos-client/spec.md
 */
import { RPCHandler } from "@orpc/server/fetch";
import { expect, test } from "vitest";

import { appRouter } from "../../../routes";
import { unmatchedRpcEnvelope } from "./rpc-dispatch";

const SUPPORT_REFERENCE = /^CANT-[0-9A-F]{8}$/;

test("Tags suggest is a mounted RPC procedure", async () => {
	const handler = new RPCHandler(appRouter);
	const result = await handler.handle(
		new Request("http://127.0.0.1/rpc/tags/suggest", {
			body: JSON.stringify({ json: { projectId: "project_1" } }),
			headers: { "content-type": "application/json" },
			method: "POST",
		}),
		{ context: {}, prefix: "/rpc" }
	);

	expect(result.matched).toBe(true);
	expect(result.response?.status).not.toBe(404);
});

test("an unmatched RPC envelope carries a secret-free Support reference", () => {
	const envelope = unmatchedRpcEnvelope();

	expect(envelope.status).toBe(404);
	expect(envelope.json.message).toBe(
		"Restart the API so new procedures are registered."
	);
	expect(envelope.json.data.reason).toBe(
		"Restart the API so new procedures are registered."
	);
	expect(envelope.json.data.written).toBe(false);
	expect(envelope.json.data.retryBound).toBe("once");
	expect(envelope.json.data.supportReference).toMatch(SUPPORT_REFERENCE);
	expect(envelope.json.code).toBe("NOT_FOUND");
});
