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
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[navigate, search.work]
	);
	const onWorkId = useCallback(
		(workId: string | null) => {
			navigate({
				search: {
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					work: workId ?? undefined,
				},
			}).catch(() => undefined);
		},
		[navigate, search.configurationEditor, search.configurationMode]
	);
	return (
		<ProjectProfile
			configurationEditor={search.configurationEditor ?? null}
			configurationMode={search.configurationMode === true}
			onPresentationChange={onPresentationChange}
			onWorkId={onWorkId}
			projectId={projectId}
			workId={search.work ?? null}
		/>
	);
}
