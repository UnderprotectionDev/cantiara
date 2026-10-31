import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import ExtensionLinksSection from "@/features/capture-triage/ui/components/extension-links-section";
import { accountPreferencesQueryOptions } from "@/utils/orpc";

import { useAccountSessions } from "../../hooks/use-account-sessions";
import SessionsSection from "../components/sessions-section";

export default function AccountView({ accountId }: { accountId: string }) {
  const accountPreferences = useQuery(
    accountPreferencesQueryOptions(accountId),
  );
  const sessions = useAccountSessions();
  const formattingPreferences =
    accountPreferences.data ?? DEFAULT_ACCOUNT_PREFERENCES;

  return (
    <main className="surface-frame max-w-4xl">
      <SessionsSection
        controller={sessions}
        formattingPreferences={formattingPreferences}
      />
      <ExtensionLinksSection formattingPreferences={formattingPreferences} />
      <p className="text-sm">
        <Link className="underline" to="/account/personal-data">
          Export Personal Data
        </Link>
      </p>
    </main>
  );
}
