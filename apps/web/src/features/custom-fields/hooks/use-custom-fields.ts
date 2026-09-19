import type {
  CreateCustomFieldInput,
  CustomFieldRecordType,
} from "@cantiara/api/custom-fields";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

export interface UpdateCustomFieldArgs {
  baseRevision: number;
  definitionId: string;
  name: string;
  options: string[];
  recordTypes: CustomFieldRecordType[];
}

export interface DefinitionRevisionArgs {
  baseRevision: number;
  definitionId: string;
}

export function useCustomFields(projectId: string) {
  const queryClient = useQueryClient();
  const customFieldsQueryOptions = orpc.customFields.queryOptions({
    input: { projectId },
  });
  const query = useQuery(customFieldsQueryOptions);
  const { queryKey } = customFieldsQueryOptions;
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey });
  };

  const create = useMutation({
    mutationFn: (input: CreateCustomFieldInput) =>
      runOnlineOnlyWrite(() =>
        client.createCustomField({
          ...input,
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (input: UpdateCustomFieldArgs) =>
      runOnlineOnlyWrite(() =>
        client.updateCustomField({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  const moveToTrash = useMutation({
    mutationFn: (input: DefinitionRevisionArgs) =>
      runOnlineOnlyWrite(() =>
        client.trashCustomField({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  const restore = useMutation({
    mutationFn: (input: DefinitionRevisionArgs) =>
      runOnlineOnlyWrite(() =>
        client.restoreCustomField({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  const deletePermanently = useMutation({
    mutationFn: (input: DefinitionRevisionArgs) =>
      runOnlineOnlyWrite(() =>
        client.deleteCustomField({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  return {
    create,
    deletePermanently,
    moveToTrash,
    query,
    restore,
    update,
  };
}
