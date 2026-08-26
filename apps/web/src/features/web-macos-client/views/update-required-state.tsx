import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";

import type { UpdateRequiredStateView } from "./client-shell";

export function UpdateRequiredState({
	state,
}: {
	state: UpdateRequiredStateView;
}) {
	return (
		<Empty aria-live="polite" className="min-h-full" role="status">
			<EmptyHeader>
				<EmptyTitle>
					<h1>{state.heading}</h1>
				</EmptyTitle>
			</EmptyHeader>
		</Empty>
	);
}
