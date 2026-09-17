import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { CaptureInboxGroup } from "@cantiara/api/capture-triage";
import { useQuery } from "@tanstack/react-query";

import { formatAccountDateTime } from "@/features/account-preferences/forms/account-preferences-format";
import CaptureInboxForm from "@/features/capture-triage/forms/capture-inbox-form";
import { ClientShellStatus } from "@/features/web-macos-client/views/client-shell";
import {
  accountPreferencesQueryOptions,
  captureInboxQueryOptions,
} from "@/utils/orpc";

function captureCountLabel(count: number) {
  return `${count} ${count === 1 ? "capture" : "captures"}`;
}

function CaptureInboxGroupView({
  formattingPreferences,
  group,
}: {
  formattingPreferences: AccountPreferences;
  group: CaptureInboxGroup;
}) {
  const headingId = `capture-group-${group.itemIds[0]}`;
  const inboxKind = group.projectId ? "Project inbox" : "Workspace inbox";
  const surfaceClass = group.projectId
    ? "border-primary/30"
    : "border-border/70";
  const headerClass = group.projectId ? "bg-primary/5" : "bg-muted/25";
  const captureCount = group.items.length;

  return (
    <section
      aria-label={group.label}
      aria-labelledby={headingId}
      className={`overflow-hidden border ${surfaceClass}`}
    >
      <div
        className={`flex items-start justify-between gap-4 border-b px-4 py-4 ${headerClass}`}
      >
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{inboxKind}</p>
          <h2
            className="mt-1 font-semibold text-base tracking-tight"
            id={headingId}
          >
            {group.label}
          </h2>
        </div>
        <div className="shrink-0 text-right">
          {group.projectId ? (
            <p className="max-w-40 truncate text-sm" title={group.projectId}>
              {group.projectId}
            </p>
          ) : null}
          <p className="mt-1 text-muted-foreground text-xs">
            {captureCountLabel(captureCount)}
          </p>
        </div>
      </div>
      <ul className="divide-y">
        {group.items.map((item) => (
          <li className="space-y-3 px-4 py-4 sm:px-5" key={item.id}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {item.template ? (
                <span className="font-medium">{item.template}</span>
              ) : null}
              <time className="text-muted-foreground" dateTime={item.createdAt}>
                {formatAccountDateTime(item.createdAt, formattingPreferences)}
              </time>
            </div>
            {item.content ? (
              <p className="whitespace-pre-wrap text-sm/6">{item.content}</p>
            ) : null}
            {Object.entries(item.fields).length > 0 ? (
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {Object.entries(item.fields).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="whitespace-pre-wrap">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CaptureInboxView({ accountId }: { accountId: string }) {
  const inbox = useQuery(captureInboxQueryOptions(accountId));
  const accountPreferences = useQuery(
    accountPreferencesQueryOptions(accountId),
  );
  const formattingPreferences =
    accountPreferences.data ?? DEFAULT_ACCOUNT_PREFERENCES;
  const clientShellStatus = (
    <ClientShellStatus accountFormattingPreferences={formattingPreferences} />
  );

  if (inbox.isPending) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {clientShellStatus}
        <h1 className="font-semibold text-3xl tracking-tight">Capture Inbox</h1>
        <p className="mt-3 text-muted-foreground text-sm">Loading captures…</p>
      </main>
    );
  }

  if (inbox.isError || !inbox.data) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {clientShellStatus}
        <h1 className="font-semibold text-3xl tracking-tight">Capture Inbox</h1>
        <p
          className="mt-6 border border-destructive/40 bg-destructive/5 px-4 py-4 text-sm"
          role="alert"
        >
          Capture Inbox is unavailable. Try loading this page again.
        </p>
      </main>
    );
  }

  const { groups } = inbox.data;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-5 py-10 sm:px-8 sm:py-14">
      {clientShellStatus}
      <header className="max-w-3xl border-b pb-8">
        <h1 className="font-semibold text-3xl tracking-tight">Capture Inbox</h1>
        <p className="mt-3 text-muted-foreground text-sm/6">
          Save a thought before you know which permanent record it belongs to.
          Captures stay temporary until you choose what happens next.
        </p>
      </header>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="lg:sticky lg:top-6">
          <CaptureInboxForm accountId={accountId} />
        </div>

        <section
          aria-labelledby="capture-list-title"
          className="min-w-0 space-y-5"
        >
          <div className="flex items-end justify-between gap-4 border-b pb-4">
            <div>
              <h2
                className="font-semibold text-xl tracking-tight"
                id="capture-list-title"
              >
                Saved captures
              </h2>
              <p className="mt-2 max-w-md text-muted-foreground text-sm/6">
                Capture Inbox groups are shown here after you save.
              </p>
            </div>
            {groups.length > 0 ? (
              <span className="shrink-0 text-muted-foreground text-xs">
                {captureCountLabel(
                  groups.reduce(
                    (count, group) => count + group.items.length,
                    0,
                  ),
                )}
              </span>
            ) : null}
          </div>

          {groups.length === 0 ? (
            <section
              aria-labelledby="empty-workspace-inbox"
              className="overflow-hidden border border-border/70"
            >
              <div className="bg-muted/25 px-4 py-4">
                <p className="text-muted-foreground text-xs">Workspace inbox</p>
                <h3
                  className="mt-1 font-semibold text-base tracking-tight"
                  id="empty-workspace-inbox"
                >
                  Workspace Capture Inbox
                </h3>
              </div>
              <p className="px-4 py-6 text-muted-foreground text-sm">
                No captures in this Inbox.
              </p>
            </section>
          ) : (
            groups.map((group) => (
              <CaptureInboxGroupView
                formattingPreferences={formattingPreferences}
                group={group}
                key={`${group.kind}-${group.projectId ?? "workspace"}`}
              />
            ))
          )}
        </section>
      </div>
    </main>
  );
}
