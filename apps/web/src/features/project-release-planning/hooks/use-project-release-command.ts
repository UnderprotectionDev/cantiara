import { hashKey, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { executeWrite } from "@/utils/execute-write";
import { invalidateSmartCollectionMembership, orpc } from "@/utils/orpc";

export async function refreshProjectRelease(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  releaseId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: orpc.projectReleases.queryKey({ input: { projectId } }),
    }),
    queryClient.invalidateQueries({
      queryKey: orpc.projectReleasePlanning.queryKey({
        input: { projectId, releaseId },
      }),
    }),
    queryClient.invalidateQueries({
      queryKey: orpc.projectSourceRecord.queryKey({
        input: { sourceType: "Project Release", sourceId: releaseId },
      }),
    }),
    ...invalidateSmartCollectionMembership(queryClient),
  ]);
}

export function useProjectReleaseCommand(projectId: string) {
  const queryClient = useQueryClient();
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  return function run<T>(
    command: { id: string },
    write: (clientIdempotencyKey: string) => Promise<T>,
    onSuccess: () => Promise<void>,
  ) {
    const fingerprint = hashKey([command]);
    if (pending.current?.fingerprint !== fingerprint) {
      pending.current = { fingerprint, key: crypto.randomUUID() };
    }
    const { key } = pending.current;
    return executeWrite(queryClient, key, write, async (_, error, id) => {
      await refreshProjectRelease(queryClient, projectId, command.id);
      if (!error && pending.current?.key === id) {
        pending.current = null;
        // Navigation runs after the server commit. A refused route cannot undo it.
        await Promise.resolve()
          .then(onSuccess)
          .catch(() => undefined);
      }
    });
  };
}
