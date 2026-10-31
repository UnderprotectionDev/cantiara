import {
  PERSONAL_DATA_ERASE_OPERATION_ID,
  type PersonalDataErasePreview,
  type PersonalDataFormat,
  type PersonalDataPreview,
} from "@cantiara/api/personal-data-rights";
import { requestGitHubIdentityGrant } from "@/features/account-access/lib/github-identity-confirmation";
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

/** Reads the erase impact. Nothing is redacted or changed. */
export function usePersonalDataErasePreview() {
  return function previewErase(contactId: string) {
    return client.previewPersonalDataErase({ contactId });
  };
}

/**
 * The erase calls. The Account Access `Confirm GitHub Identity` grant is
 * minted by that feature's flow and only carried here; the server consumes it
 * once for the `personal-data-erase` operation.
 */
export function usePersonalDataErase() {
  return {
    async confirmIdentity() {
      const grant = await requestGitHubIdentityGrant(
        PERSONAL_DATA_ERASE_OPERATION_ID,
      );
      if (!grant) {
        throw new Error("Confirm GitHub Identity did not return a grant.");
      }
      return grant;
    },
    erase: (
      preview: PersonalDataErasePreview,
      confirmation: { grant: string; typedName: string },
    ) =>
      client.erasePersonalData({
        contactId: preview.contactId,
        grant: confirmation.grant,
        previewFingerprint: preview.fingerprint,
        typedName: confirmation.typedName,
      }),
  };
}
