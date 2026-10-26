import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { orpc } from "@/utils/orpc";

/**
 * Runs one Production Incident write online with a stable idempotency key: a
 * retry of the same command reuses its key, a changed command gets a new one.
 * Every Production Incident read is refreshed afterwards, also after a conflict.
 */
export function useProductionIncidentCommand() {
  const queryClient = useQueryClient();
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.productionIncidents.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.productionIncidentDetail.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectSourceRecord.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectSourceRecords.key(),
      }),
    ]);
  }
  return async function run<T>(
    command: unknown,
    write: (clientIdempotencyKey: string) => Promise<T>,
  ) {
    const fingerprint = JSON.stringify(command);
    if (pending.current?.fingerprint !== fingerprint) {
      pending.current = { fingerprint, key: crypto.randomUUID() };
    }
    const { key } = pending.current;
    try {
      const result = await runOnlineOnlyWrite(() => write(key));
      pending.current = null;
      return result;
    } finally {
      await refresh();
    }
  };
}
