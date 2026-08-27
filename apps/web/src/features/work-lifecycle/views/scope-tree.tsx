import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { type MouseEvent, useCallback, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

import { WORK_LIFECYCLE_COPY } from "../forms/work-lifecycle-copy";
import { nextExpandedNodeIds } from "./scope-tree-state";

interface ScopeTreeWorkNode {
	id: string;
	key: string;
	status: string;
	title: string;
}

interface ScopeTreeFeatureNode extends ScopeTreeWorkNode {
	includedWork: ScopeTreeWorkNode[];
	progress: {
		closedCount: number;
		includedCount: number;
	};
}

export default function ScopeTree({
	onOpenSourceRecord,
	openedRecordId,
	projectId,
}: {
	onOpenSourceRecord: (workId: string) => void;
	openedRecordId: string | null;
	projectId: string;
}) {
	const tree = useQuery(
		orpc.workLifecycle.getScopeTree.queryOptions({ input: { projectId } })
	);
	const [expandedIds, setExpandedIds] = useState<readonly string[]>([]);
	const onToggle = useCallback((event: MouseEvent<HTMLButtonElement>) => {
		const { value } = event.currentTarget;
		setExpandedIds((current) => nextExpandedNodeIds(current, value));
	}, []);
	const onOpen = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			onOpenSourceRecord(event.currentTarget.value);
		},
		[onOpenSourceRecord]
	);

	if (tree.isPending) {
		return <p>{PROJECT_SHELL_COPY.loading}</p>;
	}
	if (tree.isError || !tree.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<section aria-label={tree.data.copy.scopeTree}>
			<h2 className="font-medium text-sm">{tree.data.copy.scopeTree}</h2>
			<ul className="mt-2 flex flex-col">
				<li>
					<p className="px-2 py-2 text-sm">{tree.data.project.name}</p>
					<ul className="flex flex-col pl-4">
						{tree.data.features.map((feature) => (
							<FeatureNode
								expanded={expandedIds.includes(feature.id)}
								feature={feature}
								key={feature.id}
								onOpen={onOpen}
								onToggle={onToggle}
								openedRecordId={openedRecordId}
								openSourceRecord={tree.data.copy.openSourceRecord}
							/>
						))}
					</ul>
				</li>
			</ul>
		</section>
	);
}

function FeatureNode({
	expanded,
	feature,
	onOpen,
	onToggle,
	openedRecordId,
	openSourceRecord,
}: {
	expanded: boolean;
	feature: ScopeTreeFeatureNode;
	onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
	onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
	openedRecordId: string | null;
	openSourceRecord: string;
}) {
	return (
		<li>
			<div className="flex flex-wrap items-baseline gap-2">
				<Button
					aria-expanded={expanded}
					onClick={onToggle}
					size="sm"
					type="button"
					value={feature.id}
					variant="ghost"
				>
					{feature.key} {feature.title}
				</Button>
				<span className="text-muted-foreground text-xs">
					{feature.status} · {feature.progress.closedCount}/
					{feature.progress.includedCount} {WORK_LIFECYCLE_COPY.closed}
				</span>
				<Button
					aria-pressed={openedRecordId === feature.id}
					onClick={onOpen}
					size="sm"
					type="button"
					value={feature.id}
					variant="outline"
				>
					{openSourceRecord}
				</Button>
			</div>
			{expanded ? (
				<ul className="flex flex-col pl-4">
					{feature.includedWork.map((work) => (
						<li className="flex flex-wrap items-baseline gap-2" key={work.id}>
							<span className="px-2 py-2 text-sm">
								<span className="font-mono text-muted-foreground text-xs">
									{work.key}
								</span>{" "}
								{work.title}{" "}
								<span className="text-muted-foreground text-xs">
									{work.status}
								</span>
							</span>
							<Button
								aria-pressed={openedRecordId === work.id}
								onClick={onOpen}
								size="sm"
								type="button"
								value={work.id}
								variant="outline"
							>
								{openSourceRecord}
							</Button>
						</li>
					))}
				</ul>
			) : null}
		</li>
	);
}
