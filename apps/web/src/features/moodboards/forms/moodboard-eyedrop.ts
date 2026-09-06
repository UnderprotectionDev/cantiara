const CHANNEL_HEX = 16;

export function hexFromRgbBytes(r: number, g: number, b: number): string {
	return `#${[r, g, b]
		.map((channel) =>
			Math.max(0, Math.min(255, Math.round(channel)))
				.toString(CHANNEL_HEX)
				.padStart(2, "0")
		)
		.join("")
		.toUpperCase()}`;
}

export function hexFromImageData(
	data: Uint8ClampedArray,
	width: number,
	x: number,
	y: number
): string | null {
	if (width < 1 || x < 0 || y < 0) {
		return null;
	}
	const index = (Math.floor(y) * width + Math.floor(x)) * 4;
	if (index + 2 >= data.length) {
		return null;
	}
	return hexFromRgbBytes(
		data[index] ?? 0,
		data[index + 1] ?? 0,
		data[index + 2] ?? 0
	);
}

export function visualEyedropSrc(origin: {
	fileAttachmentId?: string;
	fileAttachmentVersionId?: string;
	kind: string;
	url?: string;
}): string | null {
	if (
		origin.kind === "File Attachment" &&
		origin.fileAttachmentId &&
		origin.fileAttachmentVersionId
	) {
		return `/api/file-attachments/${origin.fileAttachmentId}/versions/${origin.fileAttachmentVersionId}`;
	}
	if (origin.url) {
		return origin.url;
	}
	return null;
}
