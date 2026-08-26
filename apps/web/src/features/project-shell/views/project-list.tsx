import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

export default function ProjectList() {
	const projects = useQuery(orpc.projectShell.list.queryOptions());

	return (
		<section className="flex flex-col gap-2">
			<h2 className="font-medium text-lg">{PROJECT_SHELL_COPY.projects}</h2>
			<p>
				<Link to="/projects/new">{PROJECT_SHELL_COPY.createProject}</Link>
			</p>
			{projects.data?.map((project) => (
				<p key={project.id}>
					<Link params={{ projectId: project.id }} to="/projects/$projectId">
						{project.name} {project.shortCode} {project.lifecycleStatus}
					</Link>
				</p>
			))}
		</section>
	);
}
