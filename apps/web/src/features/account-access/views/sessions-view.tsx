import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@cantiara/ui/components/alert-dialog";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import { Skeleton } from "@cantiara/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor, ShieldCheck } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/views/client-shell";
import { client, orpc } from "@/utils/orpc";

const lastActivityFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

export default function SessionsView() {
  const queryClient = useQueryClient();
  const sessions = useQuery(orpc.sessions.queryOptions());
  const revokeSession = useMutation({
    mutationFn: (sessionId: string) =>
      runOnlineOnlyWrite(() => client.revokeSession({ sessionId })),
    onError: () => {
      toast.error("Session could not be revoked.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.sessions.key() });
      toast.success("Session revoked.");
    },
  });
  const revokeOtherSessions = useMutation({
    mutationFn: (_targetSessionAlias: string) =>
      runOnlineOnlyWrite(() => client.revokeOtherSessions()),
    onError: () => {
      toast.error("Other sessions could not be revoked.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.sessions.key() });
      toast.success("Other sessions revoked.");
    },
  });
  const otherSessionCount =
    sessions.data?.filter((productSession) => !productSession.current).length ??
    0;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-col gap-5 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-5" />
            <h1 className="font-semibold text-2xl tracking-tight">Sessions</h1>
          </div>
          <p className="text-pretty text-muted-foreground text-sm/6">
            Review the devices signed in to your Account and revoke access you
            no longer recognize.
          </p>
        </div>
        <RevokeConfirmation
          description="Every session except this one will lose access immediately."
          disabled={otherSessionCount === 0 || revokeOtherSessions.isPending}
          label="Revoke Other Sessions"
          onConfirm={revokeOtherSessions.mutate}
          targetSessionAlias=""
          title="Revoke other sessions?"
        />
      </header>

      <section aria-labelledby="active-sessions-heading" className="pt-7">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-medium text-sm" id="active-sessions-heading">
            Active sessions
          </h2>
          {sessions.data ? (
            <span className="text-muted-foreground text-xs">
              {sessions.data.length} active
            </span>
          ) : null}
        </div>

        {sessions.isPending ? <SessionsSkeleton /> : null}
        {sessions.isError ? (
          <div className="border-y py-8 text-sm" role="alert">
            <p className="font-medium">Sessions are unavailable.</p>
            <p className="mt-1 text-muted-foreground">
              Try loading this page again.
            </p>
          </div>
        ) : null}
        {sessions.data ? (
          <ul className="divide-y border-y">
            {sessions.data.map((productSession) => (
              <li
                className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                key={productSession.id}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center bg-muted">
                    <Monitor aria-hidden="true" className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-sm">
                        {productSession.device}
                      </p>
                      {productSession.current ? (
                        <Badge variant="secondary">Current</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Last activity{" "}
                      <time dateTime={productSession.lastActivityAt}>
                        {lastActivityFormatter.format(
                          new Date(productSession.lastActivityAt),
                        )}
                      </time>
                    </p>
                  </div>
                </div>
                {productSession.current ? null : (
                  <RevokeConfirmation
                    description={`${productSession.device} will lose access immediately.`}
                    disabled={revokeSession.isPending}
                    label="Revoke Session"
                    onConfirm={revokeSession.mutate}
                    targetSessionAlias={productSession.id}
                    title="Revoke this session?"
                  />
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}

function RevokeConfirmation({
  description,
  disabled,
  label,
  onConfirm,
  targetSessionAlias,
  title,
}: {
  description: string;
  disabled: boolean;
  label: "Revoke Other Sessions" | "Revoke Session";
  onConfirm: (targetSessionAlias: string) => void;
  targetSessionAlias: string;
  title: string;
}) {
  const handleConfirm = useCallback(() => {
    onConfirm(targetSessionAlias);
  }, [onConfirm, targetSessionAlias]);

  return (
    <AlertDialog>
      <AlertDialogTrigger
        disabled={disabled}
        render={<Button size="sm" variant="destructive" />}
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogCancel onClick={handleConfirm} variant="destructive">
            {label}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SessionsSkeleton() {
  return (
    <div aria-label="Loading sessions" className="border-y" role="status">
      {[0, 1].map((item) => (
        <div
          className="flex items-center gap-3 border-b py-5 last:border-0"
          key={item}
        >
          <Skeleton className="size-8 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading sessions…</span>
    </div>
  );
}
