import type {
  PersonalDataArtifact,
  PersonalDataFormat,
  PersonalDataPreview,
} from "@cantiara/api/personal-data-rights";
import { useState } from "react";
import { personalDataRefusalMessage } from "../lib/personal-data-refusal";

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
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [preview, setPreview] = useState<PersonalDataPreview | null>(null);
  const [produced, setProduced] = useState<PersonalDataArtifact | null>(null);

  async function review(contactId: string) {
    setPending(true);
    setRefusal(null);
    setProduced(null);
    setPreview(null);
    try {
      setPreview(await onPreview(contactId));
    } catch (error) {
      setRefusal(personalDataRefusalMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function confirm(format: PersonalDataFormat) {
    if (!preview) {
      return;
    }
    setPending(true);
    setRefusal(null);
    try {
      setProduced(await onProduce(preview, format));
    } catch (error) {
      setRefusal(personalDataRefusalMessage(error));
    } finally {
      setPending(false);
    }
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
