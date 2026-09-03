import { createFileRoute } from "@tanstack/react-router";

import SmartCollectionsArea from "@/features/smart-collections/views/smart-collections-area";

export const Route = createFileRoute("/_founder/_auth/smart-collections")({
	component: SmartCollectionsArea,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.ensureQueryData(
				context.orpc.smartCollections.catalog.queryOptions()
			),
			context.queryClient.ensureQueryData(
				context.orpc.smartCollections.list.queryOptions()
			),
		]),
});
