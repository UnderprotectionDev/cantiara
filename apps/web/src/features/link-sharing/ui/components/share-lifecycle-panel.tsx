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
import {
  defaultNewExpiry,
  expiryInput,
  expiryLabel,
} from "../../lib/share-lifecycle";
import { ShareExpiryForm } from "../forms/share-expiry-form";

type Confirming = "reopen" | "revoke" | null;

/**
 * Expiry, reopen, reshare and revoke of one Dış yüzey. Expiry is reversible
 * and deletes nothing; after it, `Reshare with a new link` (a new URL) and
 * `Reopen the same link` (old holders return, with an extra confirmation) are
 * two separate actions. `Revoke` is terminal and says so before it runs.
 */
export function ShareLifecyclePanel({
  onReopen,
  onReshare,
  onRevoke,
  onSetExpiry,
  surface,
  timeZone,
}: {
  onReopen: (expiresAt: string | null) => Promise<unknown>;
  onReshare: (expiresAt: string | null) => Promise<unknown>;
  onRevoke: () => Promise<unknown>;
  onSetExpiry: (expiresAt: string | null) => Promise<unknown>;
  surface: Pick<ShareSurfaceSummary, "expiresAt" | "state">;
  timeZone: string;
}) {
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const expired = surface.state === "Expired";

  async function run(work: () => Promise<unknown>, done: string) {
    setStatus(null);
    setFailed(false);
    try {
      await work();
      setConfirming(null);
      setStatus(done);
    } catch {
      setFailed(true);
    }
  }
  return (
    <section aria-label="Link expiry and revoke" className="space-y-4">
      <h4 className="font-medium text-sm">Expiry</h4>
      <p
        className={expired ? "font-medium text-sm" : "text-sm"}
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
          onConfirmReopen={(expiresAt) =>
            run(
              () => onReopen(expiresAt),
              "The same link is open again. Old holders can use it.",
            )
          }
          onReshare={(expiresAt) =>
            run(
              () => onReshare(expiresAt),
              "A new link was created. The expired link stays closed.",
            )
          }
          onStartReopen={() => setConfirming("reopen")}
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
          initial={expiryInput(surface.expiresAt, timeZone)}
          key={surface.expiresAt ?? "none"}
          legend="Link expiry"
          onSubmit={(id, expiresAt) =>
            run(
              () => onSetExpiry(id === "clear" ? null : expiresAt),
              id === "clear" ? "Expiry removed." : "Expiry saved.",
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
            onConfirm={() =>
              run(onRevoke, "Link revoked. It can never be used again.")
            }
          />
        ) : (
          <Button
            onClick={() => setConfirming("revoke")}
            type="button"
            variant="destructive"
          >
            {REVOKE_LABEL}
          </Button>
        )}
      </div>
      {status ? <p role="status">{status}</p> : null}
      {failed ? (
        <p className="text-destructive text-sm" role="alert">
          That did not work. Try again.
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
  timeZone,
}: {
  confirming: boolean;
  onCancel: () => void;
  onConfirmReopen: (expiresAt: string | null) => Promise<unknown>;
  onReshare: (expiresAt: string | null) => Promise<unknown>;
  onStartReopen: () => void;
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
      />
    );
  }
  return (
    <ShareExpiryForm
      actions={[
        { id: "reshare", label: RESHARE_LABEL, variant: "default" },
        { id: "reopen", label: REOPEN_LABEL },
      ]}
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
}: {
  acknowledge?: string;
  confirmLabel: string;
  description: ReactNode;
  heading: string;
  onCancel: () => void;
  onConfirm: () => Promise<unknown>;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [acknowledged, setAcknowledged] = useState(!acknowledge);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }
  return (
    <fieldset
      aria-labelledby="share-confirm-heading"
      className="space-y-3 rounded-md border p-3"
    >
      <h5
        className="font-medium text-sm"
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
          onClick={confirm}
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
