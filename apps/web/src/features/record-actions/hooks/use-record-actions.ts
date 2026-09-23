import type {
  CreateRecordActionInput,
  UpdateRecordActionInput,
} from "@cantiara/api/record-actions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

export function useRecordActions(projectId: string) {
  const queryClient = useQueryClient();
  const options = orpc.recordActions.queryOptions({ input: { projectId } });
  const query = useQuery(options);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: options.queryKey });

  const create = useMutation({
    mutationFn: (input: CreateRecordActionInput) =>
      runOnlineOnlyWrite(() =>
        client.createRecordAction({
          ...input,
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (
      input: UpdateRecordActionInput & {
        actionId: string;
        baseRevision: number;
      },
    ) =>
      runOnlineOnlyWrite(() =>
        client.updateRecordAction({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });
  const moveToTrash = useMutation({
    mutationFn: (input: { actionId: string; baseRevision: number }) =>
      runOnlineOnlyWrite(() =>
        client.trashRecordAction({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  return { create, moveToTrash, query, update };
}
