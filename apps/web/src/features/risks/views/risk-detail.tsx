import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { RISKS_COPY } from "@/features/risks/forms/risks-copy";
import SetRiskStatusForm from "@/features/risks/forms/set-risk-status-form";
import { orpc } from "@/utils/orpc";

export default function RiskDetail({ riskId }: { riskId: string }) {
	const risk = useQuery(orpc.risks.get.queryOptions({ input: { riskId } }));
	const onChanged = useCallback(() => {
		risk.refetch().catch(() => undefined);
	}, [risk]);

	if (risk.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (risk.isError || !risk.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<article className="flex flex-col gap-4">
			<header className="flex flex-col gap-2">
				<h2 className="font-medium text-base">{risk.data.title}</h2>
				<p className="text-muted-foreground text-sm">{risk.data.status}</p>
			</header>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{RISKS_COPY.description}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">
					{risk.data.description}
				</p>
			</section>
			<section>
				<h3 className="text-muted-foreground text-xs">{RISKS_COPY.impact}</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">{risk.data.impact}</p>
			</section>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{RISKS_COPY.probability}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">
					{risk.data.probability}
				</p>
			</section>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{RISKS_COPY.responseMitigation}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">{risk.data.response}</p>
			</section>
			{risk.data.status === RISKS_COPY.accepted &&
			risk.data.acceptanceRationale ? (
				<section>
					<h3 className="text-muted-foreground text-xs">
						{RISKS_COPY.rationale}
					</h3>
					<p className="mt-1 whitespace-pre-wrap text-sm">
						{risk.data.acceptanceRationale}
					</p>
				</section>
			) : null}
			<SetRiskStatusForm
				baseRevision={risk.data.revision}
				currentStatus={risk.data.status}
				onChanged={onChanged}
				projectId={risk.data.projectId}
				riskId={risk.data.id}
			/>
		</article>
	);
}
