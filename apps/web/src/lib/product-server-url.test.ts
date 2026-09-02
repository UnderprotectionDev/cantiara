import { expect, test } from "vitest";

import { productServerUrl } from "./product-server-url";

test("a browser tab uses its own origin so forwarded Cloud Agent ports reach /rpc", () => {
	expect(
		productServerUrl("http://localhost:3000", {
			location: { origin: "https://3001-agent.example.test" },
		})
	).toBe("https://3001-agent.example.test");
});

test("Tauri keeps the configured API origin", () => {
	expect(
		productServerUrl("http://localhost:3000", {
			__TAURI_INTERNALS__: {},
			location: { origin: "https://tauri.localhost" },
		} as object & { location: { origin: string } })
	).toBe("http://localhost:3000");
});
