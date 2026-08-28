export const FILE_ATTACHMENT_COPY = {
	cancel: "Cancel",
	conflict: "Conflict",
	currentVersion: "Current version",
	download: "Download",
	fileAttachment: "File Attachment",
	finalizing: "Finalizing",
	fullscreen: "Fullscreen",
	incomingFile: "Incoming file",
	loop: "Loop",
	personalWiki: "Personal Wiki",
	quotaExceeded: "Workspace file quota is exceeded.",
	quotaWarning: "Workspace file storage is at 80% of quota.",
	restartFromByteZero: "The transfer restarts from byte zero.",
	speed: "Speed",
	targetAttachment: "Target File Attachment",
	unavailable: "Unavailable",
	upload: "Upload",
	uploadNewVersion: "Upload new version",
} as const;

export function fileToBase64(file: File): Promise<string> {
	return file.arrayBuffer().then((buffer) => {
		const bytes = new Uint8Array(buffer);
		let binary = "";
		for (const byte of bytes) {
			binary += String.fromCharCode(byte);
		}
		return btoa(binary);
	});
}

export function fileScopeFor(
	projectId: string | null
): { kind: "personal-wiki" } | { kind: "project"; projectId: string } {
	if (projectId) {
		return { kind: "project", projectId };
	}
	return { kind: "personal-wiki" };
}

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
