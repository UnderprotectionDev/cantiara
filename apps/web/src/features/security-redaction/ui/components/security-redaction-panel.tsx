import type { SecurityRedactionScope } from "@cantiara/api/security-redaction";
import { REDACT_LABEL } from "@cantiara/api/security-redaction";
import { Button } from "@cantiara/ui/components/button";
import { useCallback, useState } from "react";
import { useSecurityRedaction } from "../../hooks/use-security-redaction";
import {
  type SecurityRedactionCalls,
  useSecurityRedactionFlow,
} from "../../hooks/use-security-redaction-flow";
import { RedactForm } from "../forms/redact-form";

/**
 * Entry of Security Redaction: a `Redact` button that opens the review. The
 * result states that the gate passed and that no removal has run yet, so it
 * never claims the value is gone.
 */
export function SecurityRedactionPanel({
  calls,
  scope,
}: {
  /** Test seam; the product wires the oRPC calls. */
  calls?: SecurityRedactionCalls;
  scope: SecurityRedactionScope;
}) {
  const live = useSecurityRedaction(scope);
  const flow = useSecurityRedactionFlow(calls ?? live);
  const [open, setOpen] = useState(false);
  const { cancel } = flow;
  const close = useCallback(() => {
    cancel();
    setOpen(false);
  }, [cancel]);
  const openReview = useCallback(() => setOpen(true), []);

  return (
    <section aria-label={REDACT_LABEL} className="space-y-3">
      {open ? (
        <RedactForm
          busy={flow.busy}
          error={flow.error}
          grant={flow.review?.grant ?? null}
          identityPending={flow.review?.identityPending ?? false}
          onCancel={close}
          onConfirmIdentity={flow.confirmIdentity}
          onPreview={flow.showPreview}
          onSubmit={flow.redact}
          preview={flow.review?.preview ?? null}
        />
      ) : (
        <Button onClick={openReview} type="button" variant="outline">
          {REDACT_LABEL}
        </Button>
      )}
      {flow.result ? (
        <p role="status">
          Identity and name confirmed. Removal has not run yet.
        </p>
      ) : null}
    </section>
  );
}
