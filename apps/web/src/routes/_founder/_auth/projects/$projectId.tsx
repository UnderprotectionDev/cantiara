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
					risk: search.risk,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[hash, navigate, search.decision, search.goal, search.risk, search.work]
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
					risk: search.risk,
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
			search.risk,
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
					risk: search.risk,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			navigate,
			search.configurationEditor,
			search.configurationMode,
			search.goal,
			search.risk,
			search.work,
		]
	);
	const onRiskId = useCallback(
		(riskId: string | null) => {
			navigate({
				hash: "risks",
				search: {
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: search.decision,
					goal: search.goal,
					risk: riskId ?? undefined,
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
	const onGoalId = useCallback(
		(goalId: string | null) => {
			navigate({
				hash: "overview",
				search: {
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: search.decision,
					goal: goalId ?? undefined,
					risk: search.risk,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			navigate,
			search.configurationEditor,
			search.configurationMode,
			search.decision,
			search.risk,
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
			onRiskId={onRiskId}
			onWorkId={onWorkId}
			projectId={projectId}
			riskId={search.risk ?? null}
			workId={search.work ?? null}
		/>
	);
}
