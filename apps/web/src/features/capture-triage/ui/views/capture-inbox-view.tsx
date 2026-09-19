import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import { useCaptureInboxData } from "@/features/capture-triage/hooks/use-capture-inbox";
import { ClientShellStatus } from "@/features/web-macos-client/ui/components/client-shell";

import CaptureInboxSurface from "../components/capture-inbox-surface";

export default function CaptureInboxView({ accountId }: { accountId: string }) {
  const { accountPreferences, inbox } = useCaptureInboxData(accountId);
  const formattingPreferences: AccountPreferences =
    accountPreferences.data ?? DEFAULT_ACCOUNT_PREFERENCES;
  const clientShellStatus = (
    <ClientShellStatus accountFormattingPreferences={formattingPreferences} />
  );

  if (inbox.isPending) {
    return (
      <main className="surface-frame max-w-7xl">
        {clientShellStatus}
        <h1 className="font-semibold text-3xl tracking-tight">Capture Inbox</h1>
        <p className="mt-3 text-muted-foreground text-sm">Loading captures…</p>
      </main>
    );
  }

  if (inbox.isError || !inbox.data) {
    return (
      <main className="surface-frame max-w-7xl">
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

  return (
    <main className="surface-frame max-w-7xl space-y-10">
      {clientShellStatus}
      <header className="surface-header max-w-3xl">
        <h1 className="font-semibold text-3xl tracking-tight">Capture Inbox</h1>
        <p className="mt-3 text-muted-foreground text-sm/6">
          Save a thought before you know which permanent record it belongs to.
          Captures stay temporary until you choose what happens next.
        </p>
      </header>
      <CaptureInboxSurface
        accountId={accountId}
        formattingPreferences={formattingPreferences}
        inbox={inbox.data}
      />
    </main>
  );
}
