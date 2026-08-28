/**
 * File Attachments type matrix — original-byte limits, forbidden
 * types, and MIME/extension mismatch that is never silently repaired.
 */
import { describe, expect, it } from "vitest";

import { FILE_ATTACHMENT_COPY, FILE_KIND } from "./file-attachments-model";
import { classifyUpload } from "./file-attachments-types";

describe("File Attachments type matrix", () => {
	it("accepts JPEG PNG WebP GIF under 25 MB original bytes", () => {
		for (const file of [
			{
				declaredMime: "image/jpeg",
				filename: "shot.jpg",
				sniff: { ext: "jpg", mime: "image/jpeg" },
			},
			{
				declaredMime: "image/png",
				filename: "shot.png",
				sniff: { ext: "png", mime: "image/png" },
			},
			{
				declaredMime: "image/webp",
				filename: "shot.webp",
				sniff: { ext: "webp", mime: "image/webp" },
			},
			{
				declaredMime: "image/gif",
				filename: "shot.gif",
				sniff: { ext: "gif", mime: "image/gif" },
			},
		]) {
			expect(
				classifyUpload({
					byteLength: 25 * 1024 * 1024,
					...file,
				})
			).toMatchObject({ kind: FILE_KIND.image, status: "accepted" });
		}
	});

	it("rejects SVG HTML executables scripts macro-enabled office and unknown types", () => {
		const forbidden = [
			{ declaredMime: "image/svg+xml", filename: "icon.svg", sniff: null },
			{ declaredMime: "text/html", filename: "page.html", sniff: null },
			{
				declaredMime: "application/x-msdownload",
				filename: "setup.exe",
				sniff: null,
			},
			{
				declaredMime: "application/javascript",
				filename: "run.js",
				sniff: null,
			},
			{
				declaredMime: "application/vnd.ms-word.document.macroenabled.12",
				filename: "macro.docm",
				sniff: null,
			},
			{
				declaredMime: "application/octet-stream",
				filename: "unknown.bin",
				sniff: null,
			},
		];
		for (const file of forbidden) {
			expect(classifyUpload({ byteLength: 10, ...file })).toEqual({
				reason: FILE_ATTACHMENT_COPY.typeRejected,
				status: "rejected",
			});
		}
	});

	it("rejects MIME and extension mismatch without repairing it", () => {
		expect(
			classifyUpload({
				byteLength: 12,
				declaredMime: "image/jpeg",
				filename: "photo.jpg",
				sniff: { ext: "png", mime: "image/png" },
			})
		).toEqual({
			reason: FILE_ATTACHMENT_COPY.mimeMismatch,
			status: "mismatch",
		});
		expect(
			classifyUpload({
				byteLength: 12,
				declaredMime: "image/png",
				filename: "photo.jpg",
				sniff: null,
			})
		).toEqual({
			reason: FILE_ATTACHMENT_COPY.mimeMismatch,
			status: "mismatch",
		});
	});

	it("applies original-byte limits per kind", () => {
		expect(
			classifyUpload({
				byteLength: 25 * 1024 * 1024 + 1,
				declaredMime: "image/png",
				filename: "big.png",
				sniff: { ext: "png", mime: "image/png" },
			})
		).toMatchObject({ kind: FILE_KIND.image, status: "too-large" });
		expect(
			classifyUpload({
				byteLength: 50 * 1024 * 1024 + 1,
				declaredMime: "application/pdf",
				filename: "spec.pdf",
				sniff: { ext: "pdf", mime: "application/pdf" },
			})
		).toMatchObject({ kind: FILE_KIND.pdf, status: "too-large" });
		expect(
			classifyUpload({
				byteLength: 10 * 1024 * 1024 + 1,
				declaredMime: "text/plain",
				filename: "notes.txt",
				sniff: null,
			})
		).toMatchObject({ kind: FILE_KIND.text, status: "too-large" });
		expect(
			classifyUpload({
				byteLength: 250 * 1024 * 1024,
				declaredMime: "video/mp4",
				filename: "clip.mp4",
				sniff: { ext: "mp4", mime: "video/mp4" },
			})
		).toMatchObject({ kind: FILE_KIND.video, status: "accepted" });
	});
});
