import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { executeWrite } from "@/utils/execute-write";
import { invalidateSmartCollectionMembership, orpc } from "@/utils/orpc";

/**
 * Runs one Project Release write online with a stable idempotency key: a retry
 * of the same command reuses its key, a changed command gets a new one. Every
 * Project Release read is refreshed afterwards, also after a conflict.
 */
export function useProjectReleaseCommand() {
  const queryClient = useQueryClient();
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.projectReleases.key() }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectReleasePlanning.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectSourceRecord.key(),
      }),
      ...invalidateSmartCollectionMembership(queryClient),
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
    return await executeWrite(
      queryClient,
      key,
      async (id) => {
        const result = await write(id);
        if (pending.current?.key === id) {
          pending.current = null;
        }
        return result;
      },
      refresh,
    );
  };
}
