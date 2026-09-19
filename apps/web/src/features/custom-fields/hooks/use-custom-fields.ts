import type { CreateCustomFieldInput } from "@cantiara/api/custom-fields";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

export function useCustomFields(projectId: string) {
  const queryClient = useQueryClient();
  const customFieldsQueryOptions = orpc.customFields.queryOptions({
    input: { projectId },
  });
  const query = useQuery(customFieldsQueryOptions);
  const { queryKey } = customFieldsQueryOptions;
  const create = useMutation({
    mutationFn: (input: CreateCustomFieldInput) =>
      runOnlineOnlyWrite(() =>
        client.createCustomField({
          ...input,
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  return { create, query };
}
