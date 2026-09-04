import { createFileRoute } from "@tanstack/react-router";

import FavoritesArea from "@/features/favorites/views/favorites-area";

export const Route = createFileRoute("/_founder/_auth/favorites")({
	component: FavoritesArea,
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(
			context.orpc.favorites.openList.queryOptions()
		),
});
