import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

/** Optional neutral reading of existing history; persists nothing. */
export function useClosureSummaryDateComparison() {
  return useMutation(
    orpc.projectClosureSummaryDateComparison.mutationOptions(),
  );
}
