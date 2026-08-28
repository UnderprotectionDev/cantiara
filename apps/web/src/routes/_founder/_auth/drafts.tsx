import { createFileRoute } from "@tanstack/react-router";

import DraftsArea from "@/features/work-drafts/views/drafts-area";

export const Route = createFileRoute("/_founder/_auth/drafts")({
	component: DraftsArea,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.ensureQueryData(
				context.orpc.workDrafts.list.queryOptions()
			),
			context.queryClient.ensureQueryData(
				context.orpc.workDrafts.catalog.queryOptions()
			),
			context.queryClient.ensureQueryData(
				context.orpc.projectShell.list.queryOptions()
			),
		]),
});
