import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import CreateSourceForm from "@/features/sources-and-freshness/forms/create-source-form";
import { SOURCES_COPY } from "@/features/sources-and-freshness/forms/sources-copy";
import { orpc } from "@/utils/orpc";

import SourceDetail from "./source-detail";

export default function SourceArea({
	onSourceId,
	projectId,
	sourceId,
}: {
	onSourceId?: (sourceId: string | null) => void;
	projectId: string;
	sourceId?: string | null;
}) {
	const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
	const selectedId = sourceId ?? localSelectedId;
	const sources = useQuery(
		orpc.sources.list.queryOptions({
			input: { projectId },
		})
	);
	const onCreated = useCallback(
		(createdId: string) => {
			setLocalSelectedId(createdId);
			onSourceId?.(createdId);
		},
		[onSourceId]
	);
	const onSelect = useCallback(
		(id: string) => {
			setLocalSelectedId(id);
			onSourceId?.(id);
		},
		[onSourceId]
	);

	if (sources.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (sources.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			<CreateSourceForm onCreated={onCreated} projectId={projectId} />
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				{sources.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{SOURCES_COPY.noSources}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{sources.data.map((item) => (
							<li key={item.id}>
								<SourceRow
									id={item.id}
									onSelect={onSelect}
									selected={item.id === selectedId}
									title={item.title}
								/>
							</li>
						))}
					</ul>
				)}
				{selectedId ? (
					<SourceDetail projectId={projectId} sourceId={selectedId} />
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{SOURCES_COPY.source}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</div>
	);
}

function SourceRow({
	id,
	onSelect,
	selected,
	title,
}: {
	id: string;
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
		</button>
	);
}
