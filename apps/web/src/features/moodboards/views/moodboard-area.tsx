import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import CreateMoodboardForm from "@/features/moodboards/forms/create-moodboard-form";
import { MOODBOARDS_COPY } from "@/features/moodboards/forms/moodboards-copy";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

import MoodboardDetail from "./moodboard-detail";

export default function MoodboardArea({ projectId }: { projectId: string }) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const boards = useQuery(
		orpc.moodboards.list.queryOptions({
			input: { projectId },
		})
	);
	const onCreated = useCallback((createdId: string) => {
		setSelectedId(createdId);
	}, []);
	const onSelect = useCallback((id: string) => {
		setSelectedId(id);
	}, []);

	if (boards.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (boards.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			<CreateMoodboardForm onCreated={onCreated} projectId={projectId} />
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				{boards.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{MOODBOARDS_COPY.noMoodboards}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{boards.data.map((item) => (
							<li key={item.id}>
								<MoodboardRow
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
					<MoodboardDetail moodboardId={selectedId} projectId={projectId} />
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{MOODBOARDS_COPY.moodboard}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</div>
	);
}

function MoodboardRow({
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
