// biome-ignore-all lint/performance/noJsxPropsBind: Confirmation handlers close over the active trigger payload and mutation observers.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  type createAlertDialogHandle,
} from "@cantiara/ui/components/alert-dialog";
import { useEffect } from "react";
import { popupReturnFocus } from "@/lib/popup-return-focus";
import type { AccountSessionsController } from "../../hooks/use-account-sessions";

export type RevokeTarget = { device: string; sessionAlias: string } | "others";

export default function RevokeConfirmation({
  handle,
  headingId,
  isRevoking,
  revocationPending,
  revokeOtherSessions,
  revokeSession,
}: Pick<
  AccountSessionsController,
  "isRevoking" | "revocationPending" | "revokeOtherSessions" | "revokeSession"
> & {
  handle: ReturnType<typeof createAlertDialogHandle<RevokeTarget>>;
  headingId: string;
}) {
  const revoked = revokeSession.isSuccess || revokeOtherSessions.isSuccess;
  useEffect(() => {
    if (revoked && handle.isOpen) {
      handle.close();
    }
  }, [handle, revoked]);

  function confirm(target: RevokeTarget) {
    if (isRevoking()) {
      return;
    }
    if (target === "others") {
      revokeOtherSessions.mutate();
    } else {
      revokeSession.mutate(target.sessionAlias);
    }
  }

  return (
    <AlertDialog
      handle={handle}
      onOpenChange={(open, event) => {
        if (open) {
          revokeSession.reset();
          revokeOtherSessions.reset();
        } else if (event.reason !== "imperative-action" && isRevoking()) {
          event.cancel();
        }
      }}
    >
      {({ payload }) => {
        if (!payload) {
          return null;
        }
        const others = payload === "others";
        const mutation = others ? revokeOtherSessions : revokeSession;
        return (
          <AlertDialogContent
            finalFocus={() => popupReturnFocus(revoked ? headingId : undefined)}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {others ? "Revoke other sessions?" : "Revoke this session?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {others
                  ? "Every session except this one will lose access immediately."
                  : `${payload.device} will lose access immediately.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {mutation.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {others
                  ? "Other sessions could not be revoked. Try again."
                  : "Session could not be revoked. Try again."}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={revocationPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={revocationPending}
                onClick={() => confirm(payload)}
                variant="destructive"
              >
                {others ? "Revoke Other Sessions" : "Revoke Session"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        );
      }}
    </AlertDialog>
  );
}
