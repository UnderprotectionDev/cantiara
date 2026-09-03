import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import CreateDecisionForm from "@/features/decisions/forms/create-decision-form";
import { DECISIONS_COPY } from "@/features/decisions/forms/decisions-copy";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

import DecisionDetail from "./decision-detail";

export default function DecisionArea({ projectId }: { projectId: string }) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const decisions = useQuery(
		orpc.decisions.list.queryOptions({ input: { projectId } })
	);
	const onCreated = useCallback((decisionId: string) => {
		setSelectedId(decisionId);
	}, []);
	const onSelect = useCallback((decisionId: string) => {
		setSelectedId(decisionId);
	}, []);

	if (decisions.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (decisions.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			<CreateDecisionForm onCreated={onCreated} projectId={projectId} />
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				{decisions.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{DECISIONS_COPY.noDecisions}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{decisions.data.map((item) => (
							<li key={item.id}>
								<DecisionRow
									id={item.id}
									life={item.life}
									onSelect={onSelect}
									selected={item.id === selectedId}
									title={item.title}
								/>
							</li>
						))}
					</ul>
				)}
				{selectedId ? (
					<DecisionDetail decisionId={selectedId} projectId={projectId} />
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{DECISIONS_COPY.decision}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</div>
	);
}

function DecisionRow({
	id,
	life,
	onSelect,
	selected,
	title,
}: {
	id: string;
	life: string;
	onSelect: (id: string) => void;
	selected: boolean;
	title: string;
}) {
	const onClick = useCallback(() => {
		onSelect(id);
	}, [id, onSelect]);
	return (
		<button
			aria-current={selected ? "true" : undefined}
			className="w-full rounded-none border border-input px-2.5 py-2 text-left text-sm hover:bg-muted/40"
			onClick={onClick}
			type="button"
		>
			<span className="font-medium">{title}</span>
			<span className="mt-0.5 block text-muted-foreground text-xs">{life}</span>
		</button>
	);
}
