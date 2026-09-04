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
					validation: search.validation,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			hash,
			navigate,
			search.decision,
			search.goal,
			search.validation,
			search.work,
		]
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
					validation: search.validation,
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
			search.validation,
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
					validation: search.validation,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			navigate,
			search.configurationEditor,
			search.configurationMode,
			search.goal,
			search.validation,
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
					validation: search.validation,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			navigate,
			search.configurationEditor,
			search.configurationMode,
			search.decision,
			search.validation,
			search.work,
		]
	);
	const onValidationRecordId = useCallback(
		(validationRecordId: string | null) => {
			navigate({
				hash: "discovery",
				search: {
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: search.decision,
					goal: search.goal,
					validation: validationRecordId ?? undefined,
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
			onValidationRecordId={onValidationRecordId}
			onWorkId={onWorkId}
			projectId={projectId}
			validationRecordId={search.validation ?? null}
			workId={search.work ?? null}
		/>
	);
}
