import { client } from "@/utils/orpc";

/** Reads the durable `Import receipt` of an earlier Apply Import back by key. */
export function useReopenImportReceipt() {
  return function reopenReceipt(idempotencyKey: string) {
    return client.reopenImportReceipt({ idempotencyKey });
  };
}
