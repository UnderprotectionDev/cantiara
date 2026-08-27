import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

import CreateWorkForm from "../forms/create-work-form";
import WorkDetail from "./work-detail";
import WorkList from "./work-list";
import { nextSelectedWorkId } from "./work-selection";

export default function WorkArea({ projectId }: { projectId: string }) {
	const work = useQuery(
		orpc.workLifecycle.list.queryOptions({ input: { projectId } })
	);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const onSelect = useCallback((id: string) => {
		setSelectedId((current) => nextSelectedWorkId(current, id));
	}, []);
	const onClose = useCallback(() => {
		setSelectedId(null);
	}, []);
	const onCreated = useCallback((workId: string) => {
		setSelectedId(workId);
	}, []);

	useEffect(() => {
		if (!selectedId) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setSelectedId(null);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [selectedId]);

	if (work.isPending) {
		return <p>{PROJECT_SHELL_COPY.loading}</p>;
	}
	if (work.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const selected = work.data.find((item) => item.id === selectedId) ?? null;

	return (
		<div className="flex flex-col gap-6">
			<CreateWorkForm onCreated={onCreated} projectId={projectId} />
			<WorkList
				items={work.data}
				onSelect={onSelect}
				selectedId={selectedId}
			/>
			{selected ? (
				<WorkDetail
					candidates={work.data
						.filter((item) => item.id !== selected.id)
						.map((item) => ({
							id: item.id,
							key: item.key,
							title: item.title,
						}))}
					onClose={onClose}
					onMerged={onCreated}
					projectId={projectId}
					work={selected}
				/>
			) : null}
		</div>
	);
}
