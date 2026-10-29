// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface's state.

import { REVOKE_UNPUBLISH_LABEL } from "@cantiara/api/external-surface-management";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";

/**
 * `Revoke / Unpublish` of one existing Dış yüzey. Removal is terminal: it says
 * so before it runs and promises nothing about copies a third party holds.
 */
export function RemoveSurfaceControl({
  onRemove,
  sourceTitle,
}: {
  onRemove: () => Promise<unknown>;
  sourceTitle: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setFailed(false);
    try {
      await onRemove();
      setConfirming(false);
    } catch {
      setFailed(true);
    }
  }

  if (!confirming) {
    return (
      <Button
        aria-label={`${REVOKE_UNPUBLISH_LABEL}: ${sourceTitle}`}
        onClick={() => setConfirming(true)}
        type="button"
        variant="destructive"
      >
        {REVOKE_UNPUBLISH_LABEL}
      </Button>
    );
  }
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Confirm removal</legend>
      <p className="text-sm">
        This is permanent. The old URL will answer 410 Gone, is never reused,
        and nothing reopens it. Copies other sites already hold are not promised
        gone.
      </p>
      <div className="flex gap-2">
        <Button onClick={confirm} type="button" variant="destructive">
          {REVOKE_UNPUBLISH_LABEL}
        </Button>
        <Button
          onClick={() => setConfirming(false)}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
      {failed ? (
        <p className="text-destructive text-sm" role="alert">
          That did not work. Try again.
        </p>
      ) : null}
    </fieldset>
  );
}
