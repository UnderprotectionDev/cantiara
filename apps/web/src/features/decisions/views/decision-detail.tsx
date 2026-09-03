import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { DECISIONS_COPY } from "@/features/decisions/forms/decisions-copy";
import WithdrawDecisionForm from "@/features/decisions/forms/withdraw-decision-form";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

export default function DecisionDetail({
	decisionId,
	projectId,
}: {
	decisionId: string;
	projectId: string;
}) {
	const decision = useQuery(
		orpc.decisions.get.queryOptions({ input: { decisionId } })
	);
	const onWithdrawn = useCallback(() => {
		decision.refetch().catch(() => undefined);
	}, [decision]);

	if (decision.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (decision.isError || !decision.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<article className="flex flex-col gap-4">
			<h2 className="font-medium text-base">{decision.data.title}</h2>
			<p className="text-muted-foreground text-sm">{decision.data.life}</p>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{DECISIONS_COPY.decisionText}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">
					{decision.data.decision}
				</p>
			</section>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{DECISIONS_COPY.rationale}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">
					{decision.data.rationale}
				</p>
			</section>
			{decision.data.life === DECISIONS_COPY.valid ? (
				<WithdrawDecisionForm
					baseRevision={decision.data.revision}
					decisionId={decision.data.id}
					onWithdrawn={onWithdrawn}
					projectId={projectId}
				/>
			) : null}
			{decision.data.life === DECISIONS_COPY.withdrawn &&
			decision.data.withdrawnAt ? (
				<p className="text-muted-foreground text-sm">
					{`${DECISIONS_COPY.withdrawn} · ${decision.data.withdrawnAt}`}
					{decision.data.withdrawnRationale
						? ` · ${decision.data.withdrawnRationale}`
						: ""}
				</p>
			) : null}
		</article>
	);
}
