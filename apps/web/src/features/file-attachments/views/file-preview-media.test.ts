import { expect, test, vi } from "vitest";

import { fetchProductMedia } from "./file-preview-media";

test("File Attachment preview fetch sends the product session", async () => {
	const fetchImpl = vi.fn(
		async () => new Response(new Blob(["png"]), { status: 200 })
	);
	await fetchProductMedia(
		"http://localhost:3000/api/file-attachments/a/versions/b/preview",
		fetchImpl as unknown as typeof fetch
	);
	expect(fetchImpl).toHaveBeenCalledWith(
		"http://localhost:3000/api/file-attachments/a/versions/b/preview",
		expect.objectContaining({ credentials: "include" })
	);
});
