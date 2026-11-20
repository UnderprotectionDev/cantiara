import type { ImportReceipt } from "@cantiara/api/data-import";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

/** Reads the durable `Import receipt` on demand by the last applied key. */
export function useReopenImportReceipt(
  idempotencyKey: string | null,
  load: (idempotencyKey: string) => Promise<ImportReceipt>,
) {
  return useQuery({
    ...orpc.reopenImportReceipt.queryOptions({
      input: { idempotencyKey: idempotencyKey ?? "" },
    }),
    enabled: false,
    gcTime: 0,
    queryFn: () => load(idempotencyKey ?? ""),
    retry: false,
    staleTime: 0,
  });
}
