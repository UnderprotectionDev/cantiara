import { WORKSPACE_OVERVIEW_UI_COPY } from "./workspace-overview-copy";

export function workspaceOverviewRecordHref(input: {
	heading: string;
	projectId?: string;
	recordId: string;
}): string | null {
	if (input.heading === WORKSPACE_OVERVIEW_UI_COPY.activeProjects) {
		return `/projects/${input.recordId}#overview`;
	}
	if (
		input.heading === WORKSPACE_OVERVIEW_UI_COPY.upcoming &&
		input.projectId
	) {
		return `/projects/${input.projectId}#overview`;
	}
	if (
		input.heading === WORKSPACE_OVERVIEW_UI_COPY.recentWork &&
		input.projectId
	) {
		return `/projects/${input.projectId}?work=${encodeURIComponent(input.recordId)}#work`;
	}
	return null;
}
