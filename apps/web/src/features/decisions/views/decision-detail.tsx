import { Button } from "@cantiara/ui/components/button";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { DECISIONS_COPY } from "@/features/decisions/forms/decisions-copy";
import RemoveSupersessionForm from "@/features/decisions/forms/remove-supersession-form";
import SupersedeDecisionForm from "@/features/decisions/forms/supersede-decision-form";
import WithdrawDecisionForm from "@/features/decisions/forms/withdraw-decision-form";
import EvidenceOnTarget from "@/features/evidence/views/evidence-on-target";
import FavoriteToggle from "@/features/favorites/views/favorite-toggle";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

export default function DecisionDetail({
	decisionId,
	onOpenCurrent,
	projectId,
}: {
	decisionId: string;
	onOpenCurrent?: (decisionId: string) => void;
	projectId: string;
}) {
	const decision = useQuery(
		orpc.decisions.get.queryOptions({ input: { decisionId } })
	);
	const onChanged = useCallback(() => {
		decision.refetch().catch(() => undefined);
	}, [decision]);
	const onOpen = useCallback(() => {
		const currentId = decision.data?.openCurrentDecisionId;
		if (currentId) {
			onOpenCurrent?.(currentId);
		}
	}, [decision.data?.openCurrentDecisionId, onOpenCurrent]);

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
			<FavoriteToggle sourceId={decision.data.id} sourceType="Decision" />
			<DecisionHeader
				currentDecision={decision.data.currentDecision}
				life={decision.data.life}
				onOpen={onOpen}
				openCurrentDecisionId={decision.data.openCurrentDecisionId}
				title={decision.data.title}
				transitionOccurredAt={decision.data.transitionOccurredAt}
				transitionRationale={decision.data.transitionRationale}
			/>
			{decision.data.chain.length > 0 ? (
				<ol className="flex flex-col gap-1">
					{decision.data.chain.map((item) => (
						<li className="text-sm" key={item.id}>
							{`${item.title} · ${item.life}`}
						</li>
					))}
				</ol>
			) : null}
			<EvidenceOnTarget
				projectId={projectId}
				targetId={decision.data.id}
				targetKind="Decision"
			/>
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
			{decision.data.life === DECISIONS_COPY.valid &&
			!decision.data.contentReadOnly ? (
				<>
					<SupersedeDecisionForm
						baseRevision={decision.data.revision}
						decisionId={decision.data.id}
						onSuperseded={onChanged}
						projectId={projectId}
					/>
					<WithdrawDecisionForm
						baseRevision={decision.data.revision}
						decisionId={decision.data.id}
						onWithdrawn={onChanged}
						projectId={projectId}
					/>
				</>
			) : null}
			{decision.data.supersedes.length > 0
				? decision.data.supersedes.map((old) => (
						<section key={old.id}>
							<p className="text-muted-foreground text-sm">
								{`${DECISIONS_COPY.supersedes} · ${old.title}`}
							</p>
							{decision.data.life === DECISIONS_COPY.valid ? (
								<RemoveSupersessionForm
									baseRevision={decision.data.revision}
									onRemoved={onChanged}
									projectId={projectId}
									successorId={decision.data.id}
									supersededId={old.id}
								/>
							) : null}
						</section>
					))
				: null}
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

function DecisionHeader({
	currentDecision,
	life,
	onOpen,
	openCurrentDecisionId,
	title,
	transitionOccurredAt,
	transitionRationale,
}: {
	currentDecision: { id: string; title: string } | null;
	life: string;
	onOpen: () => void;
	openCurrentDecisionId: string | null;
	title: string;
	transitionOccurredAt: string | null;
	transitionRationale: string | null;
}) {
	return (
		<header className="flex flex-col gap-2">
			<h2 className="font-medium text-base">{title}</h2>
			<p className="text-muted-foreground text-sm">{life}</p>
			{life === DECISIONS_COPY.superseded ? (
				<div className="flex flex-col gap-2">
					{currentDecision ? (
						<p className="text-sm">
							{`${DECISIONS_COPY.decision} · ${currentDecision.title}`}
						</p>
					) : null}
					{transitionOccurredAt ? (
						<p className="text-muted-foreground text-sm">
							{transitionOccurredAt}
							{transitionRationale ? ` · ${transitionRationale}` : ""}
						</p>
					) : null}
					{openCurrentDecisionId ? (
						<Button onClick={onOpen} type="button" variant="outline">
							{DECISIONS_COPY.openCurrentDecision}
						</Button>
					) : null}
				</div>
			) : null}
		</header>
	);
}
