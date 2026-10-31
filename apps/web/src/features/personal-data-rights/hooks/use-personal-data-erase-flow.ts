import type {
  PersonalDataErasePreview,
  PersonalDataEraseResult,
} from "@cantiara/api/personal-data-rights";
import { useState } from "react";
import { personalDataRefusalMessage } from "../lib/personal-data-refusal";

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
  const [pending, setPending] = useState(false);
  const [identityPending, setIdentityPending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [preview, setPreview] = useState<PersonalDataErasePreview | null>(null);
  const [grant, setGrant] = useState<string | null>(null);
  const [result, setResult] = useState<PersonalDataEraseResult | null>(null);

  function reset() {
    setPreview(null);
    setGrant(null);
    setResult(null);
    setRefusal(null);
  }

  async function review(contactId: string) {
    reset();
    setPending(true);
    try {
      setPreview(await onPreview(contactId));
    } catch (error) {
      setRefusal(personalDataRefusalMessage(error, "Erase Personal Data"));
    } finally {
      setPending(false);
    }
  }

  async function confirmIdentity() {
    setIdentityPending(true);
    setRefusal(null);
    try {
      setGrant(await onConfirmIdentity());
    } catch (error) {
      setRefusal(personalDataRefusalMessage(error, "Erase Personal Data"));
    } finally {
      setIdentityPending(false);
    }
  }

  async function erase(typedName: string) {
    if (!(preview && grant)) {
      return;
    }
    setPending(true);
    setRefusal(null);
    try {
      setResult(await onErase(preview, { grant, typedName }));
      setPreview(null);
    } catch (error) {
      setRefusal(personalDataRefusalMessage(error, "Erase Personal Data"));
    } finally {
      // A grant is single-use: a refused or failed erase needs a fresh one.
      setGrant(null);
      setPending(false);
    }
  }

  return {
    cancel: reset,
    confirmIdentity,
    erase,
    grant,
    identityPending,
    pending,
    preview,
    refusal,
    result,
    review,
  };
}
