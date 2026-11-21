// biome-ignore-all lint/performance/noJsxPropsBind: The handlers bind to this surface.

import {
  EXPIRED_LABEL,
  REMOVE_EXPIRY_LABEL,
  REOPEN_LABEL,
  RESHARE_LABEL,
  REVOKE_LABEL,
  SET_EXPIRY_LABEL,
  type ShareSurfaceSummary,
} from "@cantiara/api/link-sharing";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
  createAlertDialogHandle,
} from "@cantiara/ui/components/alert-dialog";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { useSelector } from "@tanstack/react-store";
import { type RefObject, useId, useRef, useState } from "react";
import { submitForm } from "@/lib/submit-form";
import type { ShareLifecycleFeedback } from "../../hooks/use-share-access";
import { useShareConfirmationForm } from "../../hooks/use-share-lifecycle-confirmation";
import { linkSharingRefusalMessage } from "../../lib/link-sharing-refusal";
import {
  defaultNewExpiry,
  expiryInput,
  expiryLabel,
} from "../../lib/share-lifecycle";
import { ShareExpiryForm } from "../forms/share-expiry-form";

type Confirmation =
  | { action: "reopen"; expiresAt: string | null }
  | { action: "revoke" };

function successMessage(feedback: ShareLifecycleFeedback | null) {
  if (feedback?.status !== "success") {
    return null;
  }
  switch (feedback.action) {
    case "reopen":
      return "The same link is open again. Old holders can use it.";
    case "reshare":
      return "A new link was created. The expired link stays closed.";
    case "expiry":
      return feedback.expiresAt ? "Expiry saved." : "Expiry removed.";
    default:
      return null;
  }
}

/**
 * Expiry, reopen, reshare and revoke of one Dış yüzey. Expiry is reversible
 * and deletes nothing; after it, `Reshare with a new link` (a new URL) and
 * `Reopen the same link` (old holders return, with an extra confirmation) are
 * two separate actions. `Revoke` is terminal and says so before it runs.
 */
export function ShareLifecyclePanel({
  feedback,
  onReopen,
  onReshare,
  onRevoke,
  onSetExpiry,
  surface,
  timeZone,
}: {
  feedback: ShareLifecycleFeedback | null;
  onReopen: (expiresAt: string | null) => Promise<unknown>;
  onReshare: (expiresAt: string | null) => Promise<unknown>;
  onRevoke: () => Promise<unknown>;
  onSetExpiry: (expiresAt: string | null) => Promise<unknown>;
  surface: Pick<ShareSurfaceSummary, "expiresAt" | "state">;
  timeZone: string;
}) {
  const [handle] = useState(createAlertDialogHandle<Confirmation>);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const status = successMessage(feedback);
  const error =
    feedback?.status === "error"
      ? (linkSharingRefusalMessage(feedback.error) ??
        "That did not work. Try again.")
      : null;
  const pending = feedback?.status === "pending";
  const expired = surface.state === "Expired";

  async function confirm(work: () => Promise<unknown>) {
    try {
      await work();
      handle.close();
    } catch {
      // The mutation observer shows the refusal while confirmation stays open.
    }
  }
  return (
    <section aria-label="Link expiry and revoke" className="space-y-4">
      <h4 className="text-sm font-medium">Expiry</h4>
      <p
        className={expired ? "text-sm font-medium" : "text-sm"}
        role={expired ? "status" : undefined}
      >
        {expired
          ? `${EXPIRED_LABEL}: ${expiryLabel(surface.expiresAt, timeZone)}. Visitors can no longer open this link. The snapshot and password are kept.`
          : `${expiryLabel(surface.expiresAt, timeZone)}.`}
      </p>
      {expired ? (
        <ShareExpiryForm
          actions={[
            { id: "reshare", label: RESHARE_LABEL, variant: "default" },
            { id: "reopen", label: REOPEN_LABEL },
          ]}
          disabled={pending}
          initial={defaultNewExpiry(timeZone)}
          legend="New expiry (optional)"
          onSubmit={async (action, expiresAt) => {
            if (action === "reopen") {
              handle.openWithPayload({ action, expiresAt });
            } else {
              await onReshare(expiresAt);
            }
          }}
          timeZone={timeZone}
        />
      ) : (
        <ShareExpiryForm
          actions={[
            { id: "set", label: SET_EXPIRY_LABEL },
            ...(surface.expiresAt
              ? [{ clears: true, id: "clear", label: REMOVE_EXPIRY_LABEL }]
              : []),
          ]}
          defaultActionId="set"
          disabled={pending}
          initial={expiryInput(surface.expiresAt, timeZone)}
          key={surface.expiresAt ?? "none"}
          legend="Link expiry"
          onSubmit={(id, expiresAt) =>
            onSetExpiry(id === "clear" ? null : expiresAt).catch(
              () => undefined,
            )
          }
          timeZone={timeZone}
        />
      )}
      <div className="space-y-2 border-t pt-4">
        <AlertDialogTrigger
          disabled={pending}
          handle={handle}
          payload={{ action: "revoke" }}
          render={<Button variant="destructive" />}
        >
          {REVOKE_LABEL}
        </AlertDialogTrigger>
      </div>
      <AlertDialog
        handle={handle}
        onOpenChange={(open, event) => {
          if (!open && pending && event.reason !== "imperative-action") {
            event.cancel();
          }
        }}
      >
        {({ payload }) => {
          if (!payload) {
            return null;
          }
          const reopen = payload.action === "reopen";
          return (
            <AlertDialogContent initialFocus={confirmationHeading}>
              <ConfirmGroup
                acknowledge={reopen}
                confirmLabel={reopen ? REOPEN_LABEL : REVOKE_LABEL}
                description={
                  reopen
                    ? "Reopening makes this exact link work again for every old holder, including people you shared it with before. If you only want to share again, use Reshare with a new link instead."
                    : "Revoke is permanent. This link and its token never work again, every open visit ends, and nothing can reopen it. Sharing again makes a new link."
                }
                error={feedback?.action === payload.action ? error : null}
                heading={reopen ? "Reopen the same link?" : "Revoke this link?"}
                headingRef={confirmationHeading}
                key={payload.action}
                onConfirm={() =>
                  confirm(reopen ? () => onReopen(payload.expiresAt) : onRevoke)
                }
                pending={pending}
              />
            </AlertDialogContent>
          );
        }}
      </AlertDialog>
      {status ? <p role="status">{status}</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function ConfirmGroup({
  acknowledge,
  confirmLabel,
  description,
  error,
  heading,
  headingRef,
  onConfirm,
  pending,
}: {
  acknowledge: boolean;
  confirmLabel: string;
  description: string;
  error: string | null;
  heading: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onConfirm: () => Promise<unknown>;
  pending: boolean;
}) {
  const acknowledgeId = useId();
  const form = useShareConfirmationForm(acknowledge, onConfirm);
  const acknowledged = useSelector(
    form.store,
    (state) => state.values.acknowledged,
  );
  const submitting = useSelector(form.store, (state) => state.isSubmitting);
  return (
    <>
      <AlertDialogTitle ref={headingRef} tabIndex={-1}>
        {heading}
      </AlertDialogTitle>
      <AlertDialogDescription>{description}</AlertDialogDescription>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {acknowledge ? (
        <label
          className="inline-flex items-start gap-2 text-sm"
          htmlFor={acknowledgeId}
        >
          <Checkbox
            checked={acknowledged}
            id={acknowledgeId}
            onCheckedChange={(checked) =>
              form.setFieldValue("acknowledged", checked === true)
            }
          />
          I understand that everyone who ever received this link can open it
          again.
        </label>
      ) : null}
      <AlertDialogFooter>
        <Button
          disabled={!acknowledged || pending || submitting}
          onClick={() => submitForm(form).catch(() => undefined)}
          type="button"
          variant="destructive"
        >
          {confirmLabel}
        </Button>
        <AlertDialogCancel disabled={pending || submitting}>
          Cancel
        </AlertDialogCancel>
      </AlertDialogFooter>
    </>
  );
}
