import { useQuery } from "@tanstack/react-query";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

export default function ProjectOverview({ projectId }: { projectId: string }) {
	const overview = useQuery(
		orpc.projectOverview.get.queryOptions({ input: { projectId } })
	);

	if (overview.isPending) {
		return <p>{PROJECT_SHELL_COPY.loading}</p>;
	}
	if (overview.isError || !overview.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-4">
			{overview.data.modules.map((module) => (
				<section aria-label={module.heading} key={module.heading}>
					<h2 className="font-medium text-lg">{module.heading}</h2>
					{module.records.length > 0 ? (
						<ul>
							{module.records.map((record) => (
								<li key={record.id}>
									{record.title}
									{record.detail ? ` · ${record.detail}` : null}
								</li>
							))}
						</ul>
					) : null}
				</section>
			))}
		</div>
	);
}
