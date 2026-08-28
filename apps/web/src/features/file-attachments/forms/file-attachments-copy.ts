export const FILE_ATTACHMENT_COPY = {
	arrow: "Arrow",
	bindAsOrigin: "Bind as origin",
	cancel: "Cancel",
	chooseFile: "Choose file",
	confirm: "Confirm",
	conflict: "Conflict",
	currentVersion: "Current version",
	download: "Download",
	existingWork: "Existing Work",
	fileAttachment: "File Attachment",
	finalizing: "Finalizing",
	fullscreen: "Fullscreen",
	highlighter: "Highlighter",
	incomingFile: "Incoming file",
	loop: "Loop",
	markingLayer: "Marking layer",
	newWork: "New Work",
	next: "Next",
	noFileSelected: "No file selected",
	originLocation: "Origin Location",
	pen: "Pen",
	personalWiki: "Personal Wiki",
	point: "Point",
	preview: "Preview",
	previous: "Previous",
	quotaExceeded: "Workspace file quota is exceeded.",
	quotaWarning: "Workspace file storage is at 80% of quota.",
	rectangle: "Rectangle",
	region: "Region",
	restartFromByteZero: "The transfer restarts from byte zero.",
	selectFileAttachment: "Select a File Attachment",
	sourceVisual: "Source visual",
	speed: "Speed",
	targetAttachment: "Target File Attachment",
	unavailable: "Unavailable",
	undo: "Undo",
	upload: "Upload",
	uploadNewVersion: "Upload new version",
	versions: "Versions",
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
