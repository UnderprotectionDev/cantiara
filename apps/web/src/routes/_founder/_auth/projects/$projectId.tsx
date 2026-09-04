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
					assumption: search.assumption,
					configurationEditor: next.editor ?? undefined,
					configurationMode: next.open ? true : undefined,
					decision: search.decision,
					goal: search.goal,
					researchSession: search.researchSession,
					risk: search.risk,
					source: search.source,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			hash,
			navigate,
			search.assumption,
			search.decision,
			search.goal,
			search.researchSession,
			search.risk,
			search.source,
			search.work,
		]
	);
	const onWorkId = useCallback(
		(workId: string | null) => {
			navigate({
				hash: projectShellHashForWorkSelect(hash),
				search: {
					assumption: search.assumption,
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: search.decision,
					goal: search.goal,
					researchSession: search.researchSession,
					risk: search.risk,
					source: search.source,
					work: workId ?? undefined,
				},
			}).catch(() => undefined);
		},
		[
			hash,
			navigate,
			search.assumption,
			search.configurationEditor,
			search.configurationMode,
			search.decision,
			search.goal,
			search.researchSession,
			search.risk,
			search.source,
		]
	);
	const onDecisionId = useCallback(
		(decisionId: string | null) => {
			navigate({
				hash: "decisions",
				search: {
					assumption: search.assumption,
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: decisionId ?? undefined,
					goal: search.goal,
					researchSession: search.researchSession,
					risk: search.risk,
					source: search.source,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			navigate,
			search.assumption,
			search.configurationEditor,
			search.configurationMode,
			search.goal,
			search.researchSession,
			search.risk,
			search.source,
			search.work,
		]
	);
	const onAssumptionId = useCallback(
		(assumptionId: string | null) => {
			navigate({
				hash: "decisions",
				search: {
					assumption: assumptionId ?? undefined,
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: search.decision,
					goal: search.goal,
					researchSession: search.researchSession,
					risk: search.risk,
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
			search.goal,
			search.researchSession,
			search.risk,
			search.source,
			search.work,
		]
	);
	const onRiskId = useCallback(
		(riskId: string | null) => {
			navigate({
				hash: "risks",
				search: {
					assumption: search.assumption,
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: search.decision,
					goal: search.goal,
					researchSession: search.researchSession,
					risk: riskId ?? undefined,
					source: search.source,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			navigate,
			search.assumption,
			search.configurationEditor,
			search.configurationMode,
			search.decision,
			search.goal,
			search.researchSession,
			search.source,
			search.work,
		]
	);
	const onGoalId = useCallback(
		(goalId: string | null) => {
			navigate({
				hash: "overview",
				search: {
					assumption: search.assumption,
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: search.decision,
					goal: goalId ?? undefined,
					researchSession: search.researchSession,
					risk: search.risk,
					source: search.source,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			navigate,
			search.assumption,
			search.configurationEditor,
			search.configurationMode,
			search.decision,
			search.researchSession,
			search.risk,
			search.source,
			search.work,
		]
	);
	const onResearchSessionId = useCallback(
		(sessionId: string | null) => {
			navigate({
				hash: "discovery",
				search: {
					assumption: search.assumption,
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: search.decision,
					goal: search.goal,
					researchSession: sessionId ?? undefined,
					risk: search.risk,
					source: search.source,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			navigate,
			search.assumption,
			search.configurationEditor,
			search.configurationMode,
			search.decision,
			search.goal,
			search.risk,
			search.source,
			search.work,
		]
	);
	const onSourceId = useCallback(
		(sourceId: string | null) => {
			navigate({
				hash: "source",
				search: {
					assumption: search.assumption,
					configurationEditor: search.configurationEditor,
					configurationMode: search.configurationMode,
					decision: search.decision,
					goal: search.goal,
					researchSession: search.researchSession,
					risk: search.risk,
					source: sourceId ?? undefined,
					work: search.work,
				},
			}).catch(() => undefined);
		},
		[
			navigate,
			search.assumption,
			search.configurationEditor,
			search.configurationMode,
			search.decision,
			search.goal,
			search.researchSession,
			search.risk,
			search.work,
		]
	);
	return (
		<ProjectProfile
			assumptionId={search.assumption ?? null}
			configurationEditor={search.configurationEditor ?? null}
			configurationMode={search.configurationMode === true}
			decisionId={search.decision ?? null}
			goalId={search.goal ?? null}
			onAssumptionId={onAssumptionId}
			onDecisionId={onDecisionId}
			onGoalId={onGoalId}
			onPresentationChange={onPresentationChange}
			onResearchSessionId={onResearchSessionId}
			onRiskId={onRiskId}
			onSourceId={onSourceId}
			onWorkId={onWorkId}
			projectId={projectId}
			researchSessionId={search.researchSession ?? null}
			riskId={search.risk ?? null}
			sourceId={search.source ?? null}
			workId={search.work ?? null}
		/>
	);
}
