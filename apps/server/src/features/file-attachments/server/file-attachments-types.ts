import {
	FILE_ATTACHMENT_COPY,
	FILE_KIND,
	FILE_KIND_LIMITS,
	type FileKind,
} from "./file-attachments-model";

export interface FileSniff {
	ext: string;
	mime: string;
}

export type FileClassifyResult =
	| {
			declaredMime: string;
			ext: string;
			kind: FileKind;
			status: "accepted";
	  }
	| {
			reason: typeof FILE_ATTACHMENT_COPY.mimeMismatch;
			status: "mismatch";
	  }
	| {
			reason: typeof FILE_ATTACHMENT_COPY.typeRejected;
			status: "rejected";
	  }
	| {
			kind: FileKind;
			limit: number;
			status: "too-large";
	  };

const IMAGE_EXTS = new Set(["gif", "jpeg", "jpg", "png", "webp"]);
const AUDIO_EXTS = new Set(["m4a", "mp3", "wav"]);
const VIDEO_EXTS = new Set(["mp4", "webm"]);
const TEXT_EXTS = new Set(["json", "log", "markdown", "md", "txt"]);
const CSV_EXTS = new Set(["csv"]);
const PDF_EXTS = new Set(["pdf"]);
const ZIP_EXTS = new Set(["zip"]);

const FORBIDDEN_EXTS = new Set([
	"app",
	"bat",
	"bin",
	"cmd",
	"com",
	"dll",
	"dmg",
	"docm",
	"exe",
	"htm",
	"html",
	"jar",
	"js",
	"mjs",
	"cjs",
	"php",
	"ps1",
	"py",
	"rb",
	"sh",
	"svg",
	"wasm",
	"xlsm",
	"pptm",
]);

const MIME_ALIASES: Record<string, string> = {
	"application/csv": "text/csv",
	"application/x-zip-compressed": "application/zip",
	"audio/m4a": "audio/mp4",
	"audio/mp3": "audio/mpeg",
	"audio/wave": "audio/wav",
	"audio/x-m4a": "audio/mp4",
	"audio/x-wav": "audio/wav",
	"image/jpg": "image/jpeg",
	"text/json": "application/json",
	"text/x-markdown": "text/markdown",
};

const EXT_ALIASES: Record<string, string> = {
	jpeg: "jpg",
	markdown: "md",
};

const EXT_TO_MIME: Record<string, string> = {
	csv: "text/csv",
	gif: "image/gif",
	jpg: "image/jpeg",
	json: "application/json",
	log: "text/plain",
	m4a: "audio/mp4",
	md: "text/markdown",
	mp3: "audio/mpeg",
	mp4: "video/mp4",
	pdf: "application/pdf",
	png: "image/png",
	txt: "text/plain",
	wav: "audio/wav",
	webm: "video/webm",
	webp: "image/webp",
	zip: "application/zip",
};

const KIND_MIMES: Record<FileKind, ReadonlySet<string>> = {
	audio: new Set(["audio/mpeg", "audio/mp4", "audio/wav"]),
	csv: new Set(["text/csv"]),
	image: new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]),
	pdf: new Set(["application/pdf"]),
	text: new Set(["application/json", "text/markdown", "text/plain"]),
	video: new Set(["video/mp4", "video/webm"]),
	zip: new Set(["application/zip"]),
};

const FORBIDDEN_MIMES = new Set([
	"application/javascript",
	"application/x-dosexec",
	"application/x-executable",
	"application/x-msdownload",
	"application/xhtml+xml",
	"image/svg+xml",
	"text/html",
	"text/javascript",
	"application/wasm",
	"application/vnd.ms-excel.sheet.macroenabled.12",
	"application/vnd.ms-powerpoint.presentation.macroenabled.12",
	"application/vnd.ms-word.document.macroenabled.12",
]);

export function extensionOf(filename: string): string {
	const trimmed = filename.trim();
	const dot = trimmed.lastIndexOf(".");
	if (dot <= 0 || dot === trimmed.length - 1) {
		return "";
	}
	return trimmed.slice(dot + 1).toLowerCase();
}

export function normalizeMime(mime: string): string {
	const lower = mime.trim().toLowerCase().split(";")[0]?.trim() ?? "";
	return MIME_ALIASES[lower] ?? lower;
}

export function normalizeExt(ext: string): string {
	const lower = ext.trim().toLowerCase();
	return EXT_ALIASES[lower] ?? lower;
}

export function kindForExt(ext: string): FileKind | null {
	const normalized = normalizeExt(ext);
	if (IMAGE_EXTS.has(normalized) || IMAGE_EXTS.has(ext)) {
		return FILE_KIND.image;
	}
	if (PDF_EXTS.has(normalized)) {
		return FILE_KIND.pdf;
	}
	if (CSV_EXTS.has(normalized)) {
		return FILE_KIND.csv;
	}
	if (TEXT_EXTS.has(normalized) || TEXT_EXTS.has(ext)) {
		return FILE_KIND.text;
	}
	if (AUDIO_EXTS.has(normalized)) {
		return FILE_KIND.audio;
	}
	if (VIDEO_EXTS.has(normalized)) {
		return FILE_KIND.video;
	}
	if (ZIP_EXTS.has(normalized)) {
		return FILE_KIND.zip;
	}
	return null;
}

export function kindForMime(mime: string): FileKind | null {
	const normalized = normalizeMime(mime);
	for (const kind of Object.values(FILE_KIND)) {
		if (KIND_MIMES[kind].has(normalized)) {
			return kind;
		}
	}
	return null;
}

export function classifyUpload(input: {
	byteLength: number;
	declaredMime: string;
	filename: string;
	sniff: FileSniff | null;
}): FileClassifyResult {
	const ext = normalizeExt(extensionOf(input.filename));
	const declared = normalizeMime(input.declaredMime);
	if (FORBIDDEN_EXTS.has(ext) || FORBIDDEN_MIMES.has(declared)) {
		return {
			reason: FILE_ATTACHMENT_COPY.typeRejected,
			status: "rejected",
		};
	}
	if (input.sniff) {
		const sniffedExt = normalizeExt(input.sniff.ext);
		const sniffedMime = normalizeMime(input.sniff.mime);
		if (FORBIDDEN_EXTS.has(sniffedExt) || FORBIDDEN_MIMES.has(sniffedMime)) {
			return {
				reason: FILE_ATTACHMENT_COPY.typeRejected,
				status: "rejected",
			};
		}
		if (sniffedExt !== ext || sniffedMime !== declared) {
			return {
				reason: FILE_ATTACHMENT_COPY.mimeMismatch,
				status: "mismatch",
			};
		}
	}
	const fromExt = kindForExt(ext);
	const fromMime = kindForMime(declared);
	if (!(fromExt && fromMime)) {
		return {
			reason: FILE_ATTACHMENT_COPY.typeRejected,
			status: "rejected",
		};
	}
	if (fromExt !== fromMime || EXT_TO_MIME[ext] !== declared) {
		return {
			reason: FILE_ATTACHMENT_COPY.mimeMismatch,
			status: "mismatch",
		};
	}
	const limit = FILE_KIND_LIMITS[fromExt];
	if (input.byteLength > limit) {
		return {
			kind: fromExt,
			limit,
			status: "too-large",
		};
	}
	return {
		declaredMime: declared,
		ext,
		kind: fromExt,
		status: "accepted",
	};
}
