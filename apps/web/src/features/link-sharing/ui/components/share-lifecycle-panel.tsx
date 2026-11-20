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
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { ShareLifecycleFeedback } from "../../hooks/use-share-access";
import { linkSharingRefusalMessage } from "../../lib/link-sharing-refusal";
import {
  defaultNewExpiry,
  expiryInput,
  expiryLabel,
} from "../../lib/share-lifecycle";
import { ShareExpiryForm } from "../forms/share-expiry-form";

type Confirming = "reopen" | "revoke" | null;

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
  const [confirmation, setConfirming] = useState<Confirming>(null);
  const confirming =
    feedback?.action === confirmation && feedback.status === "success"
      ? null
      : confirmation;
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
      setConfirming(null);
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
        <ExpiredActions
          confirming={confirming === "reopen"}
          onCancel={() => setConfirming(null)}
          onConfirmReopen={(expiresAt) => confirm(() => onReopen(expiresAt))}
          onReshare={(expiresAt) => onReshare(expiresAt).catch(() => undefined)}
          onStartReopen={() => setConfirming("reopen")}
          pending={pending}
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
        {confirming === "revoke" ? (
          <ConfirmGroup
            confirmLabel={REVOKE_LABEL}
            description="Revoke is permanent. This link and its token never work again, every open visit ends, and nothing can reopen it. Sharing again makes a new link."
            heading="Revoke this link?"
            onCancel={() => setConfirming(null)}
            onConfirm={() => confirm(onRevoke)}
            pending={pending}
          />
        ) : (
          <Button
            disabled={pending}
            onClick={() => setConfirming("revoke")}
            type="button"
            variant="destructive"
          >
            {REVOKE_LABEL}
          </Button>
        )}
      </div>
      {status ? <p role="status">{status}</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function ExpiredActions({
  confirming,
  onCancel,
  onConfirmReopen,
  onReshare,
  onStartReopen,
  pending,
  timeZone,
}: {
  confirming: boolean;
  onCancel: () => void;
  onConfirmReopen: (expiresAt: string | null) => Promise<unknown>;
  onReshare: (expiresAt: string | null) => Promise<unknown>;
  onStartReopen: () => void;
  pending: boolean;
  timeZone: string;
}) {
  const [pendingExpiry, setPendingExpiry] = useState<string | null>(null);
  if (confirming) {
    return (
      <ConfirmGroup
        acknowledge="I understand that everyone who ever received this link can open it again."
        confirmLabel={REOPEN_LABEL}
        description="Reopening makes this exact link work again for every old holder, including people you shared it with before. If you only want to share again, use Reshare with a new link instead."
        heading="Reopen the same link?"
        onCancel={onCancel}
        onConfirm={() => onConfirmReopen(pendingExpiry)}
        pending={pending}
      />
    );
  }
  return (
    <ShareExpiryForm
      actions={[
        { id: "reshare", label: RESHARE_LABEL, variant: "default" },
        { id: "reopen", label: REOPEN_LABEL },
      ]}
      disabled={pending}
      initial={defaultNewExpiry(timeZone)}
      legend="New expiry (optional)"
      onSubmit={(id, expiresAt) => {
        if (id === "reopen") {
          setPendingExpiry(expiresAt);
          onStartReopen();
          return Promise.resolve();
        }
        return onReshare(expiresAt);
      }}
      timeZone={timeZone}
    />
  );
}

function ConfirmGroup({
  acknowledge,
  confirmLabel,
  description,
  heading,
  onCancel,
  onConfirm,
  pending,
}: {
  acknowledge?: string;
  confirmLabel: string;
  description: ReactNode;
  heading: string;
  onCancel: () => void;
  onConfirm: () => Promise<unknown>;
  pending: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [acknowledged, setAcknowledged] = useState(!acknowledge);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <fieldset
      aria-labelledby="share-confirm-heading"
      className="space-y-3 rounded-md border p-3"
    >
      <h5
        className="text-sm font-medium"
        id="share-confirm-heading"
        ref={headingRef}
        tabIndex={-1}
      >
        {heading}
      </h5>
      <p className="text-sm">{description}</p>
      {acknowledge ? (
        <label
          className="inline-flex items-start gap-2 text-sm"
          htmlFor="share-confirm-acknowledge"
        >
          <Checkbox
            checked={acknowledged}
            id="share-confirm-acknowledge"
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
          />
          {acknowledge}
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!acknowledged || pending}
          onClick={() => onConfirm().catch(() => undefined)}
          type="button"
          variant="destructive"
        >
          {confirmLabel}
        </Button>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </fieldset>
  );
}
