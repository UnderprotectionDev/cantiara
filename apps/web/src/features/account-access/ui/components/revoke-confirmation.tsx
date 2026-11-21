// biome-ignore-all lint/performance/noJsxPropsBind: Confirmation handlers close over the active trigger payload and mutation observers.
import {
  AlertDialog,
  AlertDialogAction,
  type AlertDialogActions,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  type createAlertDialogHandle,
} from "@cantiara/ui/components/alert-dialog";
import { type RefObject, useRef } from "react";
import type { AccountSessionsController } from "../../hooks/use-account-sessions";

export type RevokeTarget = { device: string; sessionAlias: string } | "others";

export default function RevokeConfirmation({
  handle,
  heading,
  revokeOtherSessions,
  revokeSession,
}: Pick<AccountSessionsController, "revokeOtherSessions" | "revokeSession"> & {
  handle: ReturnType<typeof createAlertDialogHandle<RevokeTarget>>;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const actions = useRef<AlertDialogActions | null>(null);
  const submitting = useRef<boolean>(false);
  const revoked = useRef<boolean>(false);
  const pending = revokeSession.isPending || revokeOtherSessions.isPending;

  async function confirm(target: RevokeTarget) {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    try {
      if (target === "others") {
        await revokeOtherSessions.mutateAsync();
      } else {
        await revokeSession.mutateAsync(target.sessionAlias);
      }
      revoked.current = true;
      actions.current?.close();
    } catch {
      // The mutation exposes the failure to the open confirmation.
    } finally {
      submitting.current = false;
    }
  }

  return (
    <AlertDialog
      actionsRef={actions}
      handle={handle}
      onOpenChange={(open, event) => {
        if (open) {
          revoked.current = false;
          revokeSession.reset();
          revokeOtherSessions.reset();
        } else if (submitting.current && !revoked.current) {
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
            finalFocus={() => (revoked.current ? heading.current : true)}
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
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
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
