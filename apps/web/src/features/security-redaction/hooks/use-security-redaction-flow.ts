import type {
  SecurityRedactionGateResult,
  SecurityRedactionPreview,
} from "@cantiara/api/security-redaction";
import { useState } from "react";

export interface SecurityRedactionCalls {
  apply: (confirmation: {
    grant: string;
    sensitiveValue: string;
    typedName: string;
  }) => Promise<SecurityRedactionGateResult>;
  confirmIdentity: () => Promise<string>;
  preview: (sensitiveValue: string) => Promise<SecurityRedactionPreview>;
}

/**
 * The review state of one `Redact`: preview, the Account Access grant step,
 * the typed name and the result. The sensitive value lives only in this
 * component state and is dropped on cancel, success and failure.
 */
export function useSecurityRedactionFlow(calls: SecurityRedactionCalls) {
  const [review, setReview] = useState<{
    grant: string | null;
    identityPending: boolean;
    preview: SecurityRedactionPreview;
    sensitiveValue: string;
  } | null>(null);
  const [result, setResult] = useState<SecurityRedactionGateResult | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function showPreview(sensitiveValue: string) {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      setReview({
        grant: null,
        identityPending: false,
        preview: await calls.preview(sensitiveValue),
        sensitiveValue,
      });
    } catch {
      setError("Could not load the Redact preview.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmIdentity() {
    if (!review) {
      return;
    }
    setError(null);
    setReview({ ...review, identityPending: true });
    try {
      const grant = await calls.confirmIdentity();
      setReview((current) =>
        current ? { ...current, grant, identityPending: false } : current,
      );
    } catch {
      setError("Confirm GitHub Identity could not be completed.");
      setReview((current) =>
        current ? { ...current, identityPending: false } : current,
      );
    }
  }

  async function redact(typedName: string) {
    if (!review?.grant) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(
        await calls.apply({
          grant: review.grant,
          sensitiveValue: review.sensitiveValue,
          typedName,
        }),
      );
      setReview(null);
    } catch {
      // The grant is single-use: a failed attempt needs a fresh confirmation.
      setReview((current) => (current ? { ...current, grant: null } : null));
      setError("Could not redact. Check the name and confirm again.");
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    cancel: () => {
      setReview(null);
      setError(null);
    },
    confirmIdentity,
    error,
    redact,
    result,
    review,
    showPreview,
  };
}
