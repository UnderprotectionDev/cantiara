import type {
  CreateRecordActionInput,
  UpdateRecordActionInput,
} from "@cantiara/api/record-actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";

import { recordActionListOptions } from "../lib/record-action-run";

export function useRecordActions(projectId: string) {
  const queryClient = useQueryClient();
  const options = recordActionListOptions(projectId);
  const query = useQuery(options);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: options.queryKey });

  const create = usePreparedMutation(
    orpc.createRecordAction.mutationOptions({
      mutationFn: (input) => client.createRecordAction(input),
      onSuccess: invalidate,
    }),
    (input: CreateRecordActionInput) => ({
      ...input,
      baseRevision: 0,
    }),
  );
  const update = usePreparedMutation(
    orpc.updateRecordAction.mutationOptions({
      mutationFn: (input) => client.updateRecordAction(input),
      onSuccess: invalidate,
    }),
    (
      input: UpdateRecordActionInput & {
        actionId: string;
        baseRevision: number;
      },
    ) => ({
      ...input,
    }),
  );
  const moveToTrash = usePreparedMutation(
    orpc.trashRecordAction.mutationOptions({
      mutationFn: (input) => client.trashRecordAction(input),
      onSuccess: invalidate,
    }),
    (input: { actionId: string; baseRevision: number }) => ({
      ...input,
    }),
  );

  return { create, moveToTrash, query, update };
}
