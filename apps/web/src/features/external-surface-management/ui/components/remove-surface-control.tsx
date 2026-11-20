// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface's state.

import { REVOKE_UNPUBLISH_LABEL } from "@cantiara/api/external-surface-management";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import { useRemoveExternalSurface } from "../../hooks/use-remove-external-surface";

/**
 * `Revoke / Unpublish` of one existing Dış yüzey. Removal is terminal: it says
 * so before it runs and promises nothing about copies a third party holds.
 */
export function RemoveSurfaceControl({
  surfaceId,
  sourceTitle,
}: {
  surfaceId: string;
  sourceTitle: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const remove = useRemoveExternalSurface();

  async function confirm() {
    try {
      await remove.mutateAsync({ surfaceId });
      setConfirming(false);
    } catch {
      // The removal mutation exposes the failure for another confirmation.
    }
  }

  if (!confirming) {
    return (
      <Button
        aria-label={`${REVOKE_UNPUBLISH_LABEL}: ${sourceTitle}`}
        onClick={() => {
          remove.reset();
          setConfirming(true);
        }}
        type="button"
        variant="destructive"
      >
        {REVOKE_UNPUBLISH_LABEL}
      </Button>
    );
  }
  return (
    <fieldset className="space-y-2" disabled={remove.isPending}>
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
      {remove.isError ? (
        <p className="text-sm text-destructive" role="alert">
          That did not work. Try again.
        </p>
      ) : null}
    </fieldset>
  );
}
