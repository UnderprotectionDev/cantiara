import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

/** Reads the durable `Import receipt` of an earlier Apply Import back by key. */
export function useReopenImportReceipt() {
  const queryClient = useQueryClient();
  return function reopenReceipt(idempotencyKey: string) {
    return queryClient.query({
      ...orpc.reopenImportReceipt.queryOptions({ input: { idempotencyKey } }),
      gcTime: 0,
      staleTime: 0,
    });
  };
}
