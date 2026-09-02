import { expect, test } from "vitest";

import { handleWikiVisitorGet } from "./personal-wiki-http";

test("this shell's Wiki visitor GET is empty 404", async () => {
	const response = handleWikiVisitorGet(
		{
			body: (body: string | null, status: number) =>
				new Response(body ?? "", { status }),
			req: { url: "https://api.example/wiki/doc-secret" },
		} as never,
		{} as never
	);
	expect(response).not.toBeNull();
	expect(response?.status).toBe(404);
	expect(await response?.text()).toBe("");
});

test("non-Wiki paths are not this shell's visitor surface", () => {
	const response = handleWikiVisitorGet(
		{
			body: (body: string | null, status: number) =>
				new Response(body ?? "", { status }),
			req: { url: "https://api.example/rpc/documents/get" },
		} as never,
		{} as never
	);
	expect(response).toBeNull();
});
