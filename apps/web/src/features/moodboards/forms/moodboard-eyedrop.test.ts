import { expect, test } from "vitest";

import {
	hexFromImageData,
	hexFromRgbBytes,
	visualEyedropSrc,
} from "./moodboard-eyedrop";

test("eyedrop from a visual pixel uses the sampled RGB, not a screen picker", () => {
	expect(hexFromRgbBytes(139, 90, 43)).toBe("#8B5A2B");
	const pixels = Uint8ClampedArray.from([255, 0, 0, 255, 139, 90, 43, 255]);
	expect(hexFromImageData(pixels, 2, 1, 0)).toBe("#8B5A2B");
	expect(hexFromImageData(pixels, 2, 3, 0)).toBeNull();
});

test("eyedrop source is the File Attachment version or the external-link visual", () => {
	expect(
		visualEyedropSrc({
			fileAttachmentId: "file-1",
			fileAttachmentVersionId: "ver-1",
			kind: "File Attachment",
		})
	).toBe("/api/file-attachments/file-1/versions/ver-1");
	expect(
		visualEyedropSrc({
			kind: "External link",
			url: "https://example.com/metal.png",
		})
	).toBe("https://example.com/metal.png");
});
