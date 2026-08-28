export function galleryThumbnailSrc(input: {
	contentPath: string;
	galleryThumbnailPath: string | null;
}): string | null {
	if (input.galleryThumbnailPath === input.contentPath) {
		return null;
	}
	return input.galleryThumbnailPath;
}

const TRAILING_SLASH = /\/$/;

export function filePreviewKind(input: {
	kind: string;
	status: string;
	unpack: boolean;
}):
	| "unavailable"
	| "download"
	| "visual"
	| "paged"
	| "csv"
	| "text"
	| "playback" {
	if (input.status === "unavailable") {
		return "unavailable";
	}
	if (input.kind === "zip" || input.unpack) {
		return "download";
	}
	if (input.kind === "image") {
		return "visual";
	}
	if (input.kind === "pdf") {
		return "paged";
	}
	if (input.kind === "csv") {
		return "csv";
	}
	if (input.kind === "text") {
		return "text";
	}
	if (input.kind === "audio" || input.kind === "video") {
		return "playback";
	}
	return "download";
}

export function galleryThumbnailPathFromFile(item: {
	currentVersion?: {
		preview?: { galleryThumbnailPath?: string | null } | null;
	} | null;
}): string | null {
	return item.currentVersion?.preview?.galleryThumbnailPath ?? null;
}

export function isolatedPreviewPathFromContent(
	contentPath: string | null | undefined
): string | null {
	if (!contentPath) {
		return null;
	}
	return `${contentPath.replace(TRAILING_SLASH, "")}/preview`;
}

export function previewFromVersion(
	version: {
		preview?: {
			cause?: string | null;
			csvRows?: string[][] | null;
			galleryThumbnailPath?: string | null;
			mode?: string;
			playback?: {
				autoplay: false;
				fullscreen: boolean;
				loopOptional: boolean;
				speed: boolean;
			} | null;
			previewPath?: string | null;
			retryLimit?: number;
			status?: string;
			supportReference?: string | null;
			textExcerpt?: string | null;
			unpack?: boolean;
			written?: boolean;
		} | null;
	} | null,
	contentPath?: string | null
): {
	cause: string | null;
	csvRows: string[][] | null;
	galleryThumbnailPath: string | null;
	mode: string;
	playback: {
		autoplay: false;
		fullscreen: boolean;
		loopOptional: boolean;
		speed: boolean;
	} | null;
	previewPath: string | null;
	retryLimit: number;
	status: string;
	supportReference: string | null;
	textExcerpt: string | null;
	unpack: boolean;
	written: boolean;
} {
	const preview = version?.preview;
	return {
		cause: preview?.cause ?? null,
		csvRows: preview?.csvRows ?? null,
		galleryThumbnailPath: preview?.galleryThumbnailPath ?? null,
		mode: preview?.mode ?? "download-only",
		playback: preview?.playback ?? null,
		previewPath:
			preview?.previewPath ?? isolatedPreviewPathFromContent(contentPath),
		retryLimit: preview?.retryLimit ?? 0,
		status: preview?.status ?? "pending",
		supportReference: preview?.supportReference ?? null,
		textExcerpt: preview?.textExcerpt ?? null,
		unpack: preview?.unpack ?? false,
		written: preview?.written ?? false,
	};
}

export function absoluteProductPath(
	origin: string,
	path: string | null
): string | null {
	if (!path) {
		return null;
	}
	return `${origin}${path}`;
}
