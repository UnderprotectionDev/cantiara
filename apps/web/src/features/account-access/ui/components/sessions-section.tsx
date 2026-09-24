import { Badge } from "@cantiara/ui/components/badge";
import { Monitor, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import {
  formatAccountDateTime,
  formatAccountNumber,
} from "@/features/account-preferences/lib/account-preferences-format";
import type { AccountSessionsController } from "../../hooks/use-account-sessions";
import RevokeConfirmation from "./revoke-confirmation";
import SessionsSkeleton from "./sessions-skeleton";

export default function SessionsSection({
  controller,
  formattingPreferences,
}: {
  controller: AccountSessionsController;
  formattingPreferences: Parameters<typeof formatAccountDateTime>[1];
}) {
  const { otherSessionCount, revokeOtherSessions, revokeSession, sessions } =
    controller;
  const activeSessionCount = useMemo(
    () => sessions.data?.length ?? 0,
    [sessions.data],
  );

  return (
    <>
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
              {formatAccountNumber(activeSessionCount, formattingPreferences)}{" "}
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
          <ul className="divide-y border-border/70 border-y">
            {sessions.data.map((productSession) => (
              <li
                className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
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
    </>
  );
}
