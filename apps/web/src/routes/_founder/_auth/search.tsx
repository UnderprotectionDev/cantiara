import { createFileRoute } from "@tanstack/react-router";

import SearchArea from "@/features/record-discovery/views/search-area";

export const Route = createFileRoute("/_founder/_auth/search")({
	component: SearchArea,
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(
			context.orpc.recordDiscovery.catalog.queryOptions()
		),
	validateSearch: (search: Record<string, unknown>): { project?: string } => ({
		project: typeof search.project === "string" ? search.project : undefined,
	}),
});
