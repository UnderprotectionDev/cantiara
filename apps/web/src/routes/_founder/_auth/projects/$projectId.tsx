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
		(next: {
			editor: ConfigurationModeEditor | null;
			hash?: string;
			open: boolean;
		}) => {
			navigate({
				hash: next.hash ?? projectShellHashAnchor(hash),
				search: {
					configurationEditor: next.editor ?? undefined,
					configurationMode: next.open ? true : undefined,
					decision: search.decision,
					goal: search.goal,
					source: search.source,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[hash, navigate, search.decision, search.goal, search.source, search.work]
	);
	const onWorkId = useCallback(
		(workId: string | null) => {
			navigate({
				hash: projectShellHashForWorkSelect(hash),
				search: {
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: search.decision,
					goal: search.goal,
					source: search.source,
					work: workId ?? undefined,
				},
			}).catch(() => undefined);
		},
		[
			hash,
			navigate,
			search.configurationEditor,
			search.configurationMode,
			search.decision,
			search.goal,
			search.source,
		]
	);
	const onDecisionId = useCallback(
		(decisionId: string | null) => {
			navigate({
				hash: "decisions",
				search: {
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: decisionId ?? undefined,
					goal: search.goal,
					source: search.source,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			navigate,
			search.configurationEditor,
			search.configurationMode,
			search.goal,
			search.source,
			search.work,
		]
	);
	const onGoalId = useCallback(
		(goalId: string | null) => {
			navigate({
				hash: "overview",
				search: {
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: search.decision,
					goal: goalId ?? undefined,
					source: search.source,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			navigate,
			search.configurationEditor,
			search.configurationMode,
			search.decision,
			search.source,
			search.work,
		]
	);
	const onSourceId = useCallback(
		(sourceId: string | null) => {
			navigate({
				hash: "source",
				search: {
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: search.decision,
					goal: search.goal,
					source: sourceId ?? undefined,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			navigate,
			search.configurationEditor,
			search.configurationMode,
			search.decision,
			search.goal,
			search.work,
		]
	);
	return (
		<ProjectProfile
			configurationEditor={search.configurationEditor ?? null}
			configurationMode={search.configurationMode === true}
			decisionId={search.decision ?? null}
			goalId={search.goal ?? null}
			onDecisionId={onDecisionId}
			onGoalId={onGoalId}
			onPresentationChange={onPresentationChange}
			onSourceId={onSourceId}
			onWorkId={onWorkId}
			projectId={projectId}
			sourceId={search.source ?? null}
			workId={search.work ?? null}
		/>
	);
}
