import { createFileRoute } from "@tanstack/react-router";

import WorkspaceOverview from "@/features/workspace-overview/views/workspace-overview";

export const Route = createFileRoute("/_founder/_auth/dashboard")({
	component: WorkspaceOverview,
});
