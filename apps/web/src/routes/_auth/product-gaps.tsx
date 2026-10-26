import { createFileRoute } from "@tanstack/react-router";
import ProductGapsView from "@/features/product-gaps/ui/views/product-gaps-view";

export const Route = createFileRoute("/_auth/product-gaps")({
  component: ProductGapsView,
});
