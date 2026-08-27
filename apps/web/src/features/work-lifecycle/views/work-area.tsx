import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

import CreateWorkForm from "../forms/create-work-form";
import { WORK_LIFECYCLE_COPY } from "../forms/work-lifecycle-copy";
import WorkDetail from "./work-detail";
import WorkList from "./work-list";

export default function WorkArea({ projectId }: { projectId: string }) {
	const work = useQuery(
		orpc.workLifecycle.list.queryOptions({ input: { projectId } })
	);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	if (work.isPending) {
		return <p>{PROJECT_SHELL_COPY.loading}</p>;
	}
	if (work.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const selected = work.data.find((item) => item.id === selectedId) ?? null;

	return (
		<section aria-label={WORK_LIFECYCLE_COPY.work}>
			<h1 className="font-semibold text-[1.375rem] tracking-tight">
				{WORK_LIFECYCLE_COPY.work}
			</h1>
			<div className="mt-6">
				<CreateWorkForm projectId={projectId} />
			</div>
			<WorkList
				items={work.data}
				onSelect={setSelectedId}
				selectedId={selectedId}
			/>
			{selected ? <WorkDetail projectId={projectId} work={selected} /> : null}
		</section>
	);
}
