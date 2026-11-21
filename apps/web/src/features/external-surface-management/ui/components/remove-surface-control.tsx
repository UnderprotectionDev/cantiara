// biome-ignore-all lint/performance/noJsxPropsBind: The dismissal guard observes this surface's mutation.
import { REVOKE_UNPUBLISH_LABEL } from "@cantiara/api/external-surface-management";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
  createAlertDialogHandle,
} from "@cantiara/ui/components/alert-dialog";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import { useRemoveExternalSurface } from "../../hooks/use-remove-external-surface";

/** Confirms the permanent removal of one Dış yüzey. */
export function RemoveSurfaceControl({
  surfaceId,
  sourceTitle,
}: {
  surfaceId: string;
  sourceTitle: string;
}) {
  const [actionsHandle] = useState(createAlertDialogHandle);
  const remove = useRemoveExternalSurface();

  async function confirm() {
    try {
      await remove.mutateAsync({ surfaceId });
      actionsHandle.close();
    } catch {
      // The removal mutation exposes the failure for another confirmation.
    }
  }

  return (
    <AlertDialog
      handle={actionsHandle}
      onOpenChange={(open, event) => {
        if (open) {
          remove.reset();
        } else if (remove.isPending && event.reason !== "imperative-action") {
          event.cancel();
        }
      }}
    >
      <AlertDialogTrigger
        aria-label={`${REVOKE_UNPUBLISH_LABEL}: ${sourceTitle}`}
        render={<Button variant="destructive" />}
      >
        {REVOKE_UNPUBLISH_LABEL}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Confirm removal</AlertDialogTitle>
        <AlertDialogDescription>
          This is permanent. The old URL will answer 410 Gone, is never reused,
          and nothing reopens it. Copies other sites already hold are not
          promised gone.
        </AlertDialogDescription>
        {remove.isError ? (
          <p className="text-sm text-destructive" role="alert">
            That did not work. Try again.
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={remove.isPending}
            onClick={confirm}
            variant="destructive"
          >
            {REVOKE_UNPUBLISH_LABEL}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
