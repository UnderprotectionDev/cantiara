import {
  EXPORT_PERSONAL_DATA_LABEL,
  type PersonalDataArtifact,
  type PersonalDataFormat,
  type PersonalDataPreview,
} from "@cantiara/api/personal-data-rights";
import { useState } from "react";
import { usePersonalDataAction } from "./use-personal-data-action";

/**
 * The Export Personal Data review state. The preview comes first and nothing
 * is produced until the founder confirms that exact preview.
 */
export function usePersonalDataFlow({
  onPreview,
  onProduce,
}: {
  onPreview: (contactId: string) => Promise<PersonalDataPreview>;
  onProduce: (
    preview: PersonalDataPreview,
    format: PersonalDataFormat,
  ) => Promise<PersonalDataArtifact>;
}) {
  const { pending, refusal, run, setRefusal } = usePersonalDataAction(
    EXPORT_PERSONAL_DATA_LABEL,
  );
  const [preview, setPreview] = useState<PersonalDataPreview | null>(null);
  const [produced, setProduced] = useState<PersonalDataArtifact | null>(null);

  async function review(contactId: string) {
    setProduced(null);
    setPreview(null);
    await run(async () => {
      setPreview(await onPreview(contactId));
    });
  }

  async function confirm(format: PersonalDataFormat) {
    if (!preview) {
      return;
    }
    await run(async () => {
      setProduced(await onProduce(preview, format));
    });
  }

  return {
    cancel: () => {
      setPreview(null);
      setProduced(null);
      setRefusal(null);
    },
    confirm,
    pending,
    preview,
    produced,
    refusal,
    review,
  };
}
