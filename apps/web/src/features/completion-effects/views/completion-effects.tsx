import { COMPLETION_EFFECTS_COPY } from "@cantiara/auth/completion-effects-copy";
import { useQuery } from "@tanstack/react-query";

import CompletionEffectsForm from "@/features/completion-effects/forms/completion-effects-form";
import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { orpc } from "@/utils/orpc";

export default function CompletionEffects() {
	const preference = useQuery(orpc.completionEffects.get.queryOptions());

	return (
		<FounderPage title={COMPLETION_EFFECTS_COPY.heading}>
			{preference.isPending ? (
				<p className="text-muted-foreground text-sm">
					{COMPLETION_EFFECTS_COPY.loading}
				</p>
			) : preference.isError || !preference.data ? (
				<p className="text-sm" role="alert">
					{COMPLETION_EFFECTS_COPY.unavailable}
				</p>
			) : (
				<CompletionEffectsForm
					key={`${preference.data.enabled}:${preference.data.theme}:${preference.data.palette}`}
					preference={preference.data}
				/>
			)}
		</FounderPage>
	);
}
