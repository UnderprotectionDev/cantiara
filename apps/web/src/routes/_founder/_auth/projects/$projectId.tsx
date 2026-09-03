import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useCallback } from "react";

import {
	type ConfigurationModeEditor,
	projectShellHashAnchor,
	projectShellHashForWorkSelect,
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
	const hash = useLocation({ select: (location) => location.hash });
	const navigate = Route.useNavigate();
	const onPresentationChange = useCallback(
		(next: { editor: ConfigurationModeEditor | null; open: boolean }) => {
			navigate({
				hash: next.hash ?? projectShellHashAnchor(hash),
				search: {
					configurationEditor: next.editor ?? undefined,
					configurationMode: next.open ? true : undefined,
					goal: search.goal,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[hash, navigate, search.goal, search.work]
	);
	const onWorkId = useCallback(
		(workId: string | null) => {
			navigate({
				hash: projectShellHashForWorkSelect(hash),
				search: {
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					goal: search.goal,
					work: workId ?? undefined,
				},
			}).catch(() => undefined);
		},
		[
			hash,
			navigate,
			search.configurationEditor,
			search.configurationMode,
			search.goal,
		]
	);
	const onGoalId = useCallback(
		(goalId: string | null) => {
			navigate({
				hash: "overview",
				search: {
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					goal: goalId ?? undefined,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			navigate,
			search.configurationEditor,
			search.configurationMode,
			search.work,
		]
	);
	return (
		<ProjectProfile
			configurationEditor={search.configurationEditor ?? null}
			configurationMode={search.configurationMode === true}
			goalId={search.goal ?? null}
			onGoalId={onGoalId}
			onPresentationChange={onPresentationChange}
			onWorkId={onWorkId}
			projectId={projectId}
			workId={search.work ?? null}
		/>
	);
}
