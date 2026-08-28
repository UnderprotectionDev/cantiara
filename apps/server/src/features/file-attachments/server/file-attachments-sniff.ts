import { fileTypeFromBuffer } from "file-type";

import type { FileSniff } from "./file-attachments-types";

export async function sniffFileBytes(
	bytes: Uint8Array
): Promise<FileSniff | null> {
	const sniffed = await fileTypeFromBuffer(bytes);
	if (!sniffed) {
		return null;
	}
	return { ext: sniffed.ext, mime: sniffed.mime };
}
