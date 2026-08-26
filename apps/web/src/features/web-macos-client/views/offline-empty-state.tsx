import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@cantiara/ui/components/empty";

import type { OfflineEmptyStateView } from "./client-shell";

export function OfflineEmptyState({ state }: { state: OfflineEmptyStateView }) {
	return (
		<Empty aria-live="polite" className="min-h-full" role="status">
			<EmptyHeader>
				<EmptyTitle>
					<h1>{state.heading}</h1>
				</EmptyTitle>
				<EmptyDescription>
					<span>
						{state.lastSavedLabel}
						{state.lastSavedDisplay ? `: ${state.lastSavedDisplay}` : ""}
					</span>
				</EmptyDescription>
				{state.unsavedRisk ? (
					<EmptyDescription>{state.unsavedRisk}</EmptyDescription>
				) : null}
			</EmptyHeader>
		</Empty>
	);
}
