import {
  ERASE_PERSONAL_DATA_LABEL,
  type PersonalDataErasePreview,
  type PersonalDataEraseResult,
} from "@cantiara/api/personal-data-rights";
import { useState } from "react";
import { usePersonalDataAction } from "./use-personal-data-action";

/**
 * The Erase Personal Data review state. The impact preview comes first, the
 * GitHub identity grant is held until the founder submits, and a refused erase
 * drops the grant so it is never reused.
 */
export function usePersonalDataEraseFlow({
  onConfirmIdentity,
  onErase,
  onPreview,
}: {
  onConfirmIdentity: () => Promise<string>;
  onErase: (
    preview: PersonalDataErasePreview,
    confirmation: { grant: string; typedName: string },
  ) => Promise<PersonalDataEraseResult>;
  onPreview: (contactId: string) => Promise<PersonalDataErasePreview>;
}) {
  const main = usePersonalDataAction(ERASE_PERSONAL_DATA_LABEL);
  const identity = usePersonalDataAction(ERASE_PERSONAL_DATA_LABEL);
  const [preview, setPreview] = useState<PersonalDataErasePreview | null>(null);
  const [grant, setGrant] = useState<string | null>(null);
  const [result, setResult] = useState<PersonalDataEraseResult | null>(null);

  function reset() {
    setPreview(null);
    setGrant(null);
    setResult(null);
    main.setRefusal(null);
    identity.setRefusal(null);
  }

  async function review(contactId: string) {
    reset();
    await main.run(async () => {
      setPreview(await onPreview(contactId));
    });
  }

  async function confirmIdentity() {
    main.setRefusal(null);
    await identity.run(async () => {
      setGrant(await onConfirmIdentity());
    });
  }

  async function erase(typedName: string) {
    if (!(preview && grant)) {
      return;
    }
    identity.setRefusal(null);
    await main.run(
      async () => {
        setResult(await onErase(preview, { grant, typedName }));
        setPreview(null);
      },
      // A grant is single-use: a refused or failed erase needs a fresh one.
      () => setGrant(null),
    );
  }

  return {
    cancel: reset,
    confirmIdentity,
    erase,
    grant,
    identityPending: identity.pending,
    pending: main.pending,
    preview,
    refusal: main.refusal ?? identity.refusal,
    result,
    review,
  };
}
