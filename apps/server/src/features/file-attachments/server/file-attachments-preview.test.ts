import { describe, expect, it } from "vitest";

import {
	CSV_PREVIEW_MAX_ROWS,
	EXTERNAL_SURFACE_AUDIENCE,
	FILE_ATTACHMENT_COPY,
	FILE_KIND,
	PREVIEW_MODE,
	TEXT_PREVIEW_MAX_CHARS,
} from "./file-attachments-model";
import {
	boundedCsvRows,
	fileCanEnterExternalSurface,
	isolatedContentHeaders,
	playbackContractFor,
	previewModeFor,
	previewUsesOriginalAsGalleryThumbnail,
	safePlainTextExcerpt,
} from "./file-attachments-preview";

describe("File Attachments preview contract", () => {
	it("maps the type matrix to isolated preview modes without autoplay or ZIP unpack", () => {
		expect(previewModeFor(FILE_KIND.image)).toBe(PREVIEW_MODE.visual);
		expect(previewModeFor(FILE_KIND.pdf)).toBe(PREVIEW_MODE.paged);
		expect(previewModeFor(FILE_KIND.csv)).toBe(PREVIEW_MODE.csvRows);
		expect(previewModeFor(FILE_KIND.text)).toBe(PREVIEW_MODE.plainText);
		expect(previewModeFor(FILE_KIND.audio)).toBe(PREVIEW_MODE.playback);
		expect(previewModeFor(FILE_KIND.video)).toBe(PREVIEW_MODE.playback);
		expect(previewModeFor(FILE_KIND.zip)).toBe(PREVIEW_MODE.downloadOnly);
		expect(playbackContractFor(FILE_KIND.video)?.autoplay).toBe(false);
		expect(previewUsesOriginalAsGalleryThumbnail(FILE_KIND.image)).toBe(false);
	});

	it("bounds CSV rows and keeps text preview as safe plain text", () => {
		const csv = Array.from(
			{ length: CSV_PREVIEW_MAX_ROWS + 5 },
			(_, index) => `a,${index}`
		).join("\n");
		expect(boundedCsvRows(new TextEncoder().encode(csv))).toHaveLength(
			CSV_PREVIEW_MAX_ROWS
		);
		const long = "x".repeat(TEXT_PREVIEW_MAX_CHARS + 20);
		expect(safePlainTextExcerpt(new TextEncoder().encode(long)).length).toBe(
			TEXT_PREVIEW_MAX_CHARS
		);
	});

	it("refuses unscanned ZIP on link-limited and public External Surfaces", () => {
		expect(
			fileCanEnterExternalSurface({
				audience: EXTERNAL_SURFACE_AUDIENCE.public,
				kind: FILE_KIND.zip,
			})
		).toEqual({
			allowed: false,
			reason: FILE_ATTACHMENT_COPY.unscannedZip,
		});
		expect(
			fileCanEnterExternalSurface({
				audience: EXTERNAL_SURFACE_AUDIENCE.linkLimited,
				kind: FILE_KIND.image,
			})
		).toEqual({ allowed: true });
	});

	it("uses product-controlled isolated headers instead of a raw object URL", () => {
		const headers = isolatedContentHeaders({
			disposition: "inline",
			filename: 'shot".png',
			mimeType: "image/png",
		});
		expect(headers.get("Content-Disposition")).toBe(
			'inline; filename="shot.png"'
		);
		expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(headers.get("Content-Security-Policy")).toContain("sandbox");
		expect(headers.get("Cache-Control")).toContain("private");
	});
});
