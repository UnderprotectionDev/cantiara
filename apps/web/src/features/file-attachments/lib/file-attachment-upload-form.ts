import { fileAttachmentFinalizeInputSchema } from "@cantiara/api/file-attachments";

const [newAttachmentSchema] = fileAttachmentFinalizeInputSchema.options;
const selectedFileSchema = newAttachmentSchema.pick({
  declaredMimeType: true,
  fileName: true,
});

/**
 * Upload: the chosen file's name and type follow the finalize procedure's own
 * rules. `Upload` is disabled without a file and the picker only offers the
 * allowed types, so a failure here has no copy.
 */
export function parseUploadSelection(
  file: File | null,
): { file: File; ok: true } | { ok: false } {
  if (!file) {
    return { ok: false };
  }
  const result = selectedFileSchema.safeParse({
    declaredMimeType: file.type || "application/octet-stream",
    fileName: file.name,
  });
  return result.success ? { file, ok: true } : { ok: false };
}
