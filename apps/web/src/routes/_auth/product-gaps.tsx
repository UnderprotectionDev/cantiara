// biome-ignore-all lint/performance/noJsxPropsBind: Route callbacks bind navigation to this outlet.
import { productGapListInputSchema } from "@cantiara/api/product-gaps";
import { createFileRoute } from "@tanstack/react-router";
import {
  EMPTY_GAP_FILTER,
  type GapFilterValues,
} from "@/features/product-gaps/lib/product-gap-form";
import ProductGapsView from "@/features/product-gaps/ui/views/product-gaps-view";

export const Route = createFileRoute("/_auth/product-gaps")({
  validateSearch: (search): Partial<GapFilterValues> => ({
    projectId: productGapListInputSchema.shape.projectId.safeParse(
      search.projectId,
    ).data,
    reason: productGapListInputSchema.shape.reason.safeParse(search.reason)
      .data,
    status: productGapListInputSchema.shape.status.safeParse(search.status)
      .data,
    tool: productGapListInputSchema.shape.tool.safeParse(search.tool).data,
  }),
  component: ProductGapsRoute,
});

function ProductGapsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ProductGapsView
      filter={{
        projectId: search.projectId ?? EMPTY_GAP_FILTER.projectId,
        reason: search.reason ?? EMPTY_GAP_FILTER.reason,
        status: search.status ?? EMPTY_GAP_FILTER.status,
        tool: search.tool ?? EMPTY_GAP_FILTER.tool,
      }}
      onFilterChange={(filter) => {
        navigate({
          search: {
            projectId: filter.projectId || undefined,
            reason: filter.reason || undefined,
            status: filter.status || undefined,
            tool: filter.tool || undefined,
          },
        }).catch(() => undefined);
      }}
    />
  );
}
