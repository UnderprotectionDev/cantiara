import { buttonVariants } from "@cantiara/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import ProjectList from "@/features/project-shell/views/project-list";

export const Route = createFileRoute("/_founder/_auth/projects/")({
	component: ProjectsRoute,
});

function ProjectsRoute() {
	return (
		<FounderPage
			actions={
				<Link className={buttonVariants({ size: "sm" })} to="/projects/new">
					{PROJECT_SHELL_COPY.createProject}
				</Link>
			}
			title={PROJECT_SHELL_COPY.projects}
			wide
		>
			<ProjectList />
		</FounderPage>
	);
}
