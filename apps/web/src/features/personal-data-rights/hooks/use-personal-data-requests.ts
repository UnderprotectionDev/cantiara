import type {
  PersonalDataFormat,
  PersonalDataPreview,
} from "@cantiara/api/personal-data-rights";
import { client } from "@/utils/orpc";

/** Reads the closed-world preview. Nothing is produced or changed. */
export function usePersonalDataPreview() {
  return function preview(contactId: string) {
    return client.previewPersonalDataExport({ contactId });
  };
}

/** Asks for the package of a preview the founder confirmed. */
export function usePersonalDataProduce() {
  return function produce(
    preview: PersonalDataPreview,
    format: PersonalDataFormat,
  ) {
    return client.exportPersonalData({
      contactId: preview.contactId,
      format,
      previewFingerprint: preview.fingerprint,
    });
  };
}
