import { createFileRoute } from "@tanstack/react-router";

import ProjectProfile from "@/features/project-shell/views/project-profile";

export const Route = createFileRoute("/_auth/projects/$projectId")({
	component: ProjectProfileRoute,
});

function ProjectProfileRoute() {
	const { projectId } = Route.useParams();
	return <ProjectProfile projectId={projectId} />;
}
