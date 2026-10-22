import type {
  ProductGapLinkTarget,
  ProductGapLinkTargetType,
} from "@cantiara/api/product-gaps";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

/** Reads link targets through TanStack Query; the surface injects the oRPC loader. */
export function useProductGapLinkTargets(
  loadTargets: (
    targetType: ProductGapLinkTargetType,
  ) => Promise<ProductGapLinkTarget[]>,
  targetType: ProductGapLinkTargetType,
) {
  return useQuery({
    ...orpc.productGapLinkTargets.queryOptions({ input: { targetType } }),
    queryFn: () => loadTargets(targetType),
  });
}
