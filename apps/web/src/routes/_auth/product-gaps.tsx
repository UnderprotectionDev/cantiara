import { createFileRoute } from "@tanstack/react-router";
import ProductGapsSurface from "@/features/product-gaps/ui/components/product-gaps-surface";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/product-gaps")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ClientShellContent>
      <ProductGapsSurface />
    </ClientShellContent>
  );
}
