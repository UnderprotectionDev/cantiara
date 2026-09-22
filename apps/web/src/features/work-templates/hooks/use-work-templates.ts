import type {
  CreateWorkTemplateInput,
  InstantiateWorkTemplateInput,
  UpdateWorkTemplateInput,
} from "@cantiara/api/work-templates";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";

export function useWorkTemplates(projectId: string) {
  const queryClient = useQueryClient();
  const options = orpc.workTemplates.queryOptions({ input: { projectId } });
  const query = useQuery(options);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: options.queryKey });

  const create = useMutation({
    mutationFn: (input: CreateWorkTemplateInput) =>
      runOnlineOnlyWrite(() =>
        client.createWorkTemplate({
          ...input,
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });
  const instantiate = useMutation({
    mutationFn: (
      input: Omit<InstantiateWorkTemplateInput, "clientIdempotencyKey">,
    ) =>
      runOnlineOnlyWrite(() =>
        client.instantiateWorkTemplate({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectWorksQueryPrefix }),
  });
  const update = useMutation({
    mutationFn: (
      input: UpdateWorkTemplateInput & {
        baseRevision: number;
        templateId: string;
      },
    ) =>
      runOnlineOnlyWrite(() =>
        client.updateWorkTemplate({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });
  const moveToTrash = useMutation({
    mutationFn: (input: { baseRevision: number; templateId: string }) =>
      runOnlineOnlyWrite(() =>
        client.trashWorkTemplate({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  return { create, instantiate, moveToTrash, query, update };
}
