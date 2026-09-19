import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
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
import { type MouseEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import {
  formatAccountDateTime,
  formatAccountNumber,
} from "@/features/account-preferences/forms/account-preferences-format";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/views/client-shell";
import { accountPreferencesQueryOptions, client, orpc } from "@/utils/orpc";

export default function SessionsView({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient();
  const accountPreferences = useQuery(
    accountPreferencesQueryOptions(accountId),
  );
  const sessions = useQuery(orpc.sessions.queryOptions());
  const revokeSession = useMutation({
    mutationFn: (sessionId: string) =>
      runOnlineOnlyWrite(() => client.revokeSession({ sessionId })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.sessions.key() });
      toast.success("Session revoked.");
    },
  });
  const revokeOtherSessions = useMutation({
    mutationFn: (_targetSessionAlias: string) =>
      runOnlineOnlyWrite(() => client.revokeOtherSessions()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.sessions.key() });
      toast.success("Other sessions revoked.");
    },
  });
  const otherSessionCount =
    sessions.data?.filter((productSession) => !productSession.current).length ??
    0;
  const formattingPreferences =
    accountPreferences.data ?? DEFAULT_ACCOUNT_PREFERENCES;

  return (
    <main className="surface-frame max-w-4xl">
      <header className="surface-header flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
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

      <section aria-labelledby="active-sessions-heading" className="pt-9">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-medium text-sm" id="active-sessions-heading">
            Active sessions
          </h2>
          {sessions.data ? (
            <span className="text-muted-foreground text-xs">
              {formatAccountNumber(sessions.data.length, formattingPreferences)}{" "}
              active
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
          <ul className="divide-y rounded-lg border border-border/70 bg-card/45">
            {sessions.data.map((productSession) => (
              <li
                className="flex flex-col gap-4 px-5 py-5 first:rounded-t-lg last:rounded-b-lg hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                key={productSession.id}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
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
                        {formatAccountDateTime(
                          productSession.lastActivityAt,
                          formattingPreferences,
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

      <WebCaptureLinksSection formattingPreferences={formattingPreferences} />
    </main>
  );
}

function WebCaptureLinksSection({
  formattingPreferences,
}: {
  formattingPreferences: Parameters<typeof formatAccountDateTime>[1];
}) {
  const queryClient = useQueryClient();
  const links = useQuery(orpc.webCaptureLinks.queryOptions());
  const [pairingCode, setPairingCode] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const { isPending: isGeneratingPairingCode, mutate: generatePairingCode } =
    useMutation({
      mutationFn: () =>
        runOnlineOnlyWrite(() => client.createWebCapturePairingCode()),
      onSuccess: (nextPairingCode) => {
        setPairingCode(nextPairingCode);
      },
    });
  const { isPending: isRevokingLink, mutate: revokeLink } = useMutation({
    mutationFn: (linkId: string) =>
      runOnlineOnlyWrite(() => client.revokeWebCaptureLink({ linkId })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpc.webCaptureLinks.key(),
      });
      toast.success("Extension link revoked.");
    },
  });
  const handleGeneratePairingCode = useCallback(() => {
    generatePairingCode();
  }, [generatePairingCode]);
  const handleRevokeLink = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const {
        currentTarget: {
          dataset: { linkId },
        },
      } = event;
      if (linkId) {
        revokeLink(linkId);
      }
    },
    [revokeLink],
  );

  return (
    <section aria-labelledby="extension-links-heading" className="pt-12">
      <div className="flex flex-col gap-3 border-border/70 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-medium text-sm" id="extension-links-heading">
            Extension links
          </h2>
          <p className="mt-1 max-w-xl text-muted-foreground text-sm/6">
            Pair a browser with Web Capture and revoke individual links when a
            device should stop writing to the Capture Inbox.
          </p>
        </div>
        <Button
          disabled={isGeneratingPairingCode}
          onClick={handleGeneratePairingCode}
          size="sm"
          type="button"
        >
          {isGeneratingPairingCode ? "Generating…" : "Generate pairing code"}
        </Button>
      </div>

      {pairingCode ? (
        <div
          className="rounded-md border border-primary/25 bg-primary/5 px-4 py-4"
          role="status"
        >
          <p className="text-muted-foreground text-xs">
            This pairing code expires in five minutes and can be used once.
          </p>
          <code className="mt-2 block font-semibold text-lg tracking-wider">
            {pairingCode.code}
          </code>
          <time
            className="mt-1 block text-muted-foreground text-xs"
            dateTime={pairingCode.expiresAt}
          >
            Expires{" "}
            {formatAccountDateTime(
              pairingCode.expiresAt,
              formattingPreferences,
            )}
          </time>
        </div>
      ) : null}

      {links.isPending ? (
        <div className="border-b py-5 text-muted-foreground text-sm">
          Loading Extension links…
        </div>
      ) : null}
      {links.isError ? (
        <div className="border-b py-5 text-sm" role="alert">
          Extension links are unavailable.
        </div>
      ) : null}
      {links.data?.length === 0 ? (
        <p className="border-b py-5 text-muted-foreground text-sm">
          No Extension links.
        </p>
      ) : null}
      {links.data && links.data.length > 0 ? (
        <ul className="divide-y rounded-lg border border-border/70 bg-card/45">
          {links.data.map((link) => (
            <li
              className="flex flex-col gap-4 px-5 py-4 first:rounded-t-lg last:rounded-b-lg hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
              key={link.id}
            >
              <div className="grid gap-1 text-sm">
                <p className="font-medium">{link.device}</p>
                <p className="text-muted-foreground text-xs">
                  Browser: {link.browser}
                </p>
                <p className="text-muted-foreground text-xs">
                  Last use:{" "}
                  {link.lastUse
                    ? formatAccountDateTime(link.lastUse, formattingPreferences)
                    : "Never"}
                </p>
              </div>
              <Button
                data-link-id={link.id}
                disabled={isRevokingLink}
                onClick={handleRevokeLink}
                size="sm"
                type="button"
                variant="destructive"
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
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
