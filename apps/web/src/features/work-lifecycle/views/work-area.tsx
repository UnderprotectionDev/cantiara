import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

import CreateWorkForm from "../forms/create-work-form";
import { WORK_LIFECYCLE_COPY } from "../forms/work-lifecycle-copy";
import WorkDetail from "./work-detail";
import WorkList from "./work-list";
import { nextSelectedWorkId } from "./work-selection";

export default function WorkArea({ projectId }: { projectId: string }) {
	const [archived, setArchived] = useState(false);
	const work = useQuery(
		orpc.workLifecycle.list.queryOptions({
			input: { archived, projectId },
		})
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
		setArchived(false);
	}, []);
	const onToggleArchiveFilter = useCallback(() => {
		setArchived((current) => !current);
		setSelectedId(null);
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
			<Button
				aria-pressed={archived}
				onClick={onToggleArchiveFilter}
				size="sm"
				type="button"
				variant={archived ? "secondary" : "ghost"}
			>
				{WORK_LIFECYCLE_COPY.archive}
			</Button>
			<WorkList
				items={work.data}
				onSelect={onSelect}
				selectedId={selectedId}
			/>
			{selected ? (
				<WorkDetail
					onClose={onClose}
					projectId={projectId}
					work={selected}
				/>
			) : null}
		</div>
	);
}
