export function galleryThumbnailSrc(input: {
	contentPath: string;
	galleryThumbnailPath: string | null;
}): string | null {
	if (input.galleryThumbnailPath === input.contentPath) {
		return null;
	}
	return input.galleryThumbnailPath;
}

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
	if (input.status === "unavailable" || input.status === "pending") {
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

export function absoluteProductPath(
	origin: string,
	path: string | null
): string | null {
	if (!path) {
		return null;
	}
	return `${origin}${path}`;
}
