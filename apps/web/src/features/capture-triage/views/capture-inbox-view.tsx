import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { CaptureInboxGroup } from "@cantiara/api/capture-triage";
import { useQuery } from "@tanstack/react-query";

import { formatAccountDateTime } from "@/features/account-preferences/forms/account-preferences-format";
import CaptureInboxForm from "@/features/capture-triage/forms/capture-inbox-form";
import {
  accountPreferencesQueryOptions,
  captureInboxQueryOptions,
} from "@/utils/orpc";

function CaptureInboxGroupView({
  formattingPreferences,
  group,
}: {
  formattingPreferences: AccountPreferences;
  group: CaptureInboxGroup;
}) {
  const headingId = `capture-group-${group.itemIds[0]}`;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-baseline justify-between gap-4 border-b pb-3">
        <h2 className="font-semibold text-lg tracking-tight" id={headingId}>
          {group.label}
        </h2>
        {group.projectId ? (
          <span className="text-muted-foreground text-sm">
            {group.projectId}
          </span>
        ) : null}
      </div>
      <ul className="divide-y border-y">
        {group.items.map((item) => (
          <li className="space-y-2 px-4 py-4" key={item.id}>
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

  if (inbox.isPending) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="font-semibold text-3xl tracking-tight">Capture Inbox</h1>
        <p className="mt-3 text-muted-foreground text-sm">Loading captures…</p>
      </main>
    );
  }

  if (inbox.isError || !inbox.data) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
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
  const formattingPreferences =
    accountPreferences.data ?? DEFAULT_ACCOUNT_PREFERENCES;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl border-b pb-8">
        <h1 className="font-semibold text-3xl tracking-tight">Capture Inbox</h1>
        <p className="mt-3 text-muted-foreground text-sm/6">
          Save a thought before you know which permanent record it belongs to.
          Captures stay temporary until you choose what happens next.
        </p>
      </header>

      <CaptureInboxForm accountId={accountId} />

      <section aria-labelledby="capture-list-title" className="space-y-8">
        <h2 className="sr-only" id="capture-list-title">
          Saved captures
        </h2>
        {groups.length === 0 ? (
          <section
            aria-labelledby="empty-workspace-inbox"
            className="space-y-3"
          >
            <h2
              className="font-semibold text-lg tracking-tight"
              id="empty-workspace-inbox"
            >
              Workspace Capture Inbox
            </h2>
            <p className="border-y py-6 text-muted-foreground text-sm">
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
    </main>
  );
}
