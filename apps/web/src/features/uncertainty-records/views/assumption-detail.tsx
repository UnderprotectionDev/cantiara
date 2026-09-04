import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import RecordAssumptionOutcomeForm from "@/features/uncertainty-records/forms/record-assumption-outcome-form";
import { UNCERTAINTY_COPY } from "@/features/uncertainty-records/forms/uncertainty-records-copy";
import { orpc } from "@/utils/orpc";

export default function AssumptionDetail({
	assumptionId,
	projectId,
}: {
	assumptionId: string;
	projectId: string;
}) {
	const assumption = useQuery(
		orpc.uncertaintyRecords.getAssumption.queryOptions({
			input: { assumptionId },
		})
	);
	const onChanged = useCallback(() => {
		assumption.refetch().catch(() => undefined);
	}, [assumption]);

	if (assumption.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (assumption.isError || !assumption.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<article className="flex flex-col gap-4">
			<header className="flex flex-col gap-2">
				<h2 className="font-medium text-base">{assumption.data.statement}</h2>
				<p className="text-muted-foreground text-sm">{assumption.data.life}</p>
			</header>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{UNCERTAINTY_COPY.statement}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">
					{assumption.data.statement}
				</p>
			</section>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{UNCERTAINTY_COPY.rationale}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">
					{assumption.data.rationale}
				</p>
			</section>
			{assumption.data.outcomeRationale ? (
				<p className="text-muted-foreground text-sm">
					{`${assumption.data.life} · ${assumption.data.outcomeRationale}`}
				</p>
			) : null}
			{assumption.data.evidenceMissing ? (
				<p role="status">{UNCERTAINTY_COPY.missingEvidence}</p>
			) : null}
			{assumption.data.evidence.length > 0 ? (
				<ul className="flex flex-col gap-1">
					{assumption.data.evidence.map((item) => (
						<li className="text-sm" key={item.id}>
							{`${UNCERTAINTY_COPY.evidence} · ${item.fromKind}`}
						</li>
					))}
				</ul>
			) : null}
			<RecordAssumptionOutcomeForm
				assumptionId={assumption.data.id}
				baseRevision={assumption.data.revision}
				currentLife={assumption.data.life}
				onChanged={onChanged}
				projectId={projectId}
			/>
		</article>
	);
}
