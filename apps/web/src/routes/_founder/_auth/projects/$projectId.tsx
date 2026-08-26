import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import {
	type ConfigurationModeEditor,
	projectShellSearch,
} from "@/features/project-shell/forms/project-shell-copy";
import ProjectProfile from "@/features/project-shell/views/project-profile";

export const Route = createFileRoute("/_founder/_auth/projects/$projectId")({
	component: ProjectProfileRoute,
	validateSearch: projectShellSearch,
});

function ProjectProfileRoute() {
	const { projectId } = Route.useParams();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const onPresentationChange = useCallback(
		(next: { editor: ConfigurationModeEditor | null; open: boolean }) => {
			navigate({
				search: {
					configurationEditor: next.editor ?? undefined,
					configurationMode: next.open ? true : undefined,
				},
			}).catch(() => undefined);
		},
		[navigate]
	);
	return (
		<ProjectProfile
			configurationEditor={search.configurationEditor ?? null}
			configurationMode={search.configurationMode === true}
			onPresentationChange={onPresentationChange}
			projectId={projectId}
		/>
	);
}
