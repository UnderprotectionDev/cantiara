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
import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import type { AccountSessionsController } from "../../hooks/use-account-sessions";

export type RevokeTarget = { device: string; sessionAlias: string } | "others";

export default function RevokeConfirmation({
  handle,
  headingId,
  revokeOtherSessions,
  revokeSession,
}: Pick<AccountSessionsController, "revokeOtherSessions" | "revokeSession"> & {
  handle: ReturnType<typeof createAlertDialogHandle<RevokeTarget>>;
  headingId: string;
}) {
  const queryClient = useQueryClient();
  function isRevoking() {
    return (
      queryClient.isMutating({
        mutationKey: orpc.revokeSession.mutationKey(),
      }) > 0 ||
      queryClient.isMutating({
        mutationKey: orpc.revokeOtherSessions.mutationKey(),
      }) > 0
    );
  }
  const pending = revokeSession.isPending || revokeOtherSessions.isPending;

  async function confirm(target: RevokeTarget) {
    if (isRevoking()) {
      return;
    }
    try {
      if (target === "others") {
        await revokeOtherSessions.mutateAsync();
      } else {
        await revokeSession.mutateAsync(target.sessionAlias);
      }
      handle.close();
    } catch {
      // The mutation exposes the failure to the open confirmation.
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
            finalFocus={() =>
              mutation.isSuccess ? document.getElementById(headingId) : true
            }
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
