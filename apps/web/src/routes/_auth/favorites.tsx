import { createFileRoute } from "@tanstack/react-router";
import FavoritesPageView from "@/features/favorites/ui/views/favorites-page-view";

export const Route = createFileRoute("/_auth/favorites")({
  component: FavoritesPageView,
});
