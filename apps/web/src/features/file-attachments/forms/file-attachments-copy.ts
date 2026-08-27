export const FILE_ATTACHMENT_COPY = {
	cancel: "Cancel",
	conflict: "Conflict",
	currentVersion: "Current version",
	download: "Download",
	fileAttachment: "File Attachment",
	finalizing: "Finalizing",
	incomingFile: "Incoming file",
	personalWiki: "Personal Wiki",
	quotaExceeded: "Workspace file quota is exceeded.",
	quotaWarning: "Workspace file storage is at 80% of quota.",
	restartFromByteZero: "The transfer restarts from byte zero.",
	targetAttachment: "Target File Attachment",
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
