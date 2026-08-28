import Papa from "papaparse";

import {
	CSV_PREVIEW_MAX_ROWS,
	EXTERNAL_SURFACE_AUDIENCE,
	type ExternalSurfaceAudience,
	FILE_ATTACHMENT_COPY,
	FILE_KIND,
	type FileKind,
	PREVIEW_MODE,
	type PreviewMode,
	TEXT_PREVIEW_MAX_CHARS,
} from "./file-attachments-model";

export function previewModeFor(kind: string): PreviewMode {
	if (kind === FILE_KIND.image) {
		return PREVIEW_MODE.visual;
	}
	if (kind === FILE_KIND.pdf) {
		return PREVIEW_MODE.paged;
	}
	if (kind === FILE_KIND.csv) {
		return PREVIEW_MODE.csvRows;
	}
	if (kind === FILE_KIND.text) {
		return PREVIEW_MODE.plainText;
	}
	if (kind === FILE_KIND.audio || kind === FILE_KIND.video) {
		return PREVIEW_MODE.playback;
	}
	return PREVIEW_MODE.downloadOnly;
}

export function playbackContractFor(kind: string): {
	autoplay: false;
	fullscreen: boolean;
	loopOptional: boolean;
	speed: boolean;
} | null {
	if (kind === FILE_KIND.audio || kind === FILE_KIND.video) {
		return {
			autoplay: false,
			fullscreen: true,
			loopOptional: true,
			speed: true,
		};
	}
	return null;
}

export function fileCanEnterExternalSurface(input: {
	audience: ExternalSurfaceAudience;
	kind: string;
}):
	| { allowed: true }
	| {
			allowed: false;
			reason: typeof FILE_ATTACHMENT_COPY.unscannedZip;
	  } {
	if (
		input.kind === FILE_KIND.zip &&
		(input.audience === EXTERNAL_SURFACE_AUDIENCE.linkLimited ||
			input.audience === EXTERNAL_SURFACE_AUDIENCE.public)
	) {
		return {
			allowed: false,
			reason: FILE_ATTACHMENT_COPY.unscannedZip,
		};
	}
	return { allowed: true };
}

export function isolatedContentHeaders(input: {
	disposition: "inline" | "attachment";
	filename: string;
	mimeType: string;
}): Headers {
	const filename = input.filename.replaceAll('"', "");
	const headers = new Headers();
	headers.set("Content-Type", input.mimeType);
	headers.set(
		"Content-Disposition",
		`${input.disposition}; filename="${filename}"`
	);
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Cache-Control", "private, no-store");
	headers.set(
		"Content-Security-Policy",
		"default-src 'none'; img-src 'self'; media-src 'self'; sandbox"
	);
	return headers;
}

export function boundedCsvRows(bytes: Uint8Array): string[][] {
	const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
	const parsed = Papa.parse<string[]>(text, {
		preview: CSV_PREVIEW_MAX_ROWS,
		skipEmptyLines: true,
	});
	return parsed.data.filter((row) => Array.isArray(row));
}

export function safePlainTextExcerpt(bytes: Uint8Array): string {
	const text = new TextDecoder("utf-8", { fatal: false })
		.decode(bytes)
		.replaceAll("\u0000", "");
	if (text.length <= TEXT_PREVIEW_MAX_CHARS) {
		return text;
	}
	return text.slice(0, TEXT_PREVIEW_MAX_CHARS);
}

export function previewUsesOriginalAsGalleryThumbnail(_kind: FileKind): false {
	return false;
}
