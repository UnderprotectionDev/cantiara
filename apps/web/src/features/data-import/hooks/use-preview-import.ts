import type { PreviewImportInput } from "@cantiara/api/data-import";
import { client } from "@/utils/orpc";

/** Reads the write-free `Import` preview; the server stages the encrypted file. */
export function usePreviewImport() {
  return function preview(input: PreviewImportInput) {
    return client.previewImport(input);
  };
}
