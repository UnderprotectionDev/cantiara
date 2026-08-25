import { ACCOUNT_PREFERENCES_COPY } from "@cantiara/auth/account-preferences-copy";
import { useQuery } from "@tanstack/react-query";

import PreferencesForm from "@/features/account-preferences/forms/preferences-form";
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

	return (
		<main className="mx-auto w-full max-w-3xl p-6">
			<h1 className="mb-6 font-bold text-2xl">
				{ACCOUNT_PREFERENCES_COPY.heading}
			</h1>
			{preferences.isPending ? (
				<p>{ACCOUNT_PREFERENCES_COPY.loading}</p>
			) : preferences.isError || !preferences.data ? (
				<p role="alert">{ACCOUNT_PREFERENCES_COPY.unavailable}</p>
			) : (
				<PreferencesForm
					key={`${preferences.data.saved}:${preferences.data.locale}:${preferences.data.timeZone}`}
					preferences={preferences.data}
					suggestion={suggestion}
				/>
			)}
		</main>
	);
}
