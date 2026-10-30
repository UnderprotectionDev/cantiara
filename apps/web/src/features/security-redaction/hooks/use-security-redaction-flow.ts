import type {
  SecurityRedactionGateResult,
  SecurityRedactionPreview,
} from "@cantiara/api/security-redaction";
import { useState } from "react";

type ApplyFailure =
  | { code: "GRANT_REJECTED" }
  | { code: "NAME_MISMATCH" }
  | { code: "SPREAD_INCOMPLETE" }
  | { code: "UNKNOWN" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * The oRPC failure kinds of `applySecurityRedaction`: a name mismatch burns
 * nothing, a rejected grant needs a fresh confirmation and a partial spread
 * has already removed some copies while leaving the event for replay.
 */
export function parseApplyFailure(error: unknown): ApplyFailure {
  if (!isRecord(error)) {
    return { code: "UNKNOWN" };
  }
  const data = isRecord(error.data) ? error.data : error;
  if (data.code === "SECURITY_REDACTION_TYPED_NAME_MISMATCH") {
    return { code: "NAME_MISMATCH" };
  }
  if (data.code === "SECURITY_REDACTION_GRANT_REJECTED") {
    return { code: "GRANT_REJECTED" };
  }
  if (data.code === "SECURITY_REDACTION_SPREAD_INCOMPLETE") {
    return { code: "SPREAD_INCOMPLETE" };
  }
  return { code: "UNKNOWN" };
}

export interface SecurityRedactionCalls {
  apply: (confirmation: {
    grant: string;
    reason: string;
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

  async function redact(typedName: string, reason: string) {
    if (!review?.grant) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(
        await calls.apply({
          grant: review.grant,
          reason,
          sensitiveValue: review.sensitiveValue,
          typedName,
        }),
      );
      setReview(null);
    } catch (caught) {
      // The grant is single-use: a failed attempt needs a fresh confirmation.
      setReview((current) => (current ? { ...current, grant: null } : null));
      switch (parseApplyFailure(caught).code) {
        case "NAME_MISMATCH":
          setError("Could not redact. Check the name and confirm again.");
          break;
        case "GRANT_REJECTED":
          setError(
            "Confirm GitHub Identity was not accepted. Confirm again to redact.",
          );
          break;
        case "SPREAD_INCOMPLETE":
          setError(
            "Some copies could not be removed yet. Confirm again to retry; the removal is already recorded.",
          );
          break;
        default:
          setError("Could not redact. Confirm identity again to retry.");
      }
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
