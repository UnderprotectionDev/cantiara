import { ACCOUNT_PREFERENCES_COPY } from "@cantiara/auth/account-preferences-copy";
import { useQuery } from "@tanstack/react-query";

import PreferencesForm from "@/features/account-preferences/forms/preferences-form";
import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { orpc } from "@/utils/orpc";

function browserSuggestion() {
	return {
		locale: navigator.language,
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
	};
}

export default function Preferences() {
	const preferences = useQuery(orpc.accountPreferences.get.queryOptions());
	const suggestion = browserSuggestion();

	if (preferences.isPending) {
		return (
			<FounderPage title={ACCOUNT_PREFERENCES_COPY.heading}>
				<p className="text-muted-foreground text-sm">
					{ACCOUNT_PREFERENCES_COPY.loading}
				</p>
			</FounderPage>
		);
	}

	if (preferences.isError || !preferences.data) {
		return (
			<FounderPage title={ACCOUNT_PREFERENCES_COPY.heading}>
				<p className="text-sm" role="alert">
					{ACCOUNT_PREFERENCES_COPY.unavailable}
				</p>
			</FounderPage>
		);
	}

	return (
		<FounderPage title={ACCOUNT_PREFERENCES_COPY.heading}>
			<PreferencesForm
				key={`${preferences.data.saved}:${preferences.data.locale}:${preferences.data.timeZone}:${preferences.data.appearance}`}
				preferences={preferences.data}
				suggestion={suggestion}
			/>
		</FounderPage>
	);
}
