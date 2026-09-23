import type { ExternalExecutionHandoffInput } from "@cantiara/api/external-handoffs";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

export function useExternalExecutionHandoffs(
  work: WorkProfile,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const options = orpc.externalExecutionHandoffs.queryOptions({
    input: { workId: work.id },
  });
  const query = useQuery({ ...options, enabled });
  const start = useMutation({
    mutationFn: (input: Omit<ExternalExecutionHandoffInput, "workId">) =>
      runOnlineOnlyWrite(() =>
        client.startExternalExecutionHandoff({
          ...input,
          baseRevision: work.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          workId: work.id,
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: options.queryKey }),
  });

  return { query, start };
}
