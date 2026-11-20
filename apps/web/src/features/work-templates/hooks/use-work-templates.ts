import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";

interface WorkTemplateCallbacks {
  onCreatedWork: (key: string) => void;
  onSavedTemplate: () => void;
}

export function useWorkTemplates(
  projectId: string,
  { onCreatedWork, onSavedTemplate }: WorkTemplateCallbacks,
) {
  const queryClient = useQueryClient();
  const options = orpc.workTemplates.queryOptions({ input: { projectId } });
  const query = useQuery(options);
  const invalidateTemplates = (template: { projectId: string }) =>
    queryClient.invalidateQueries({
      queryKey: orpc.workTemplates.queryKey({
        input: { projectId: template.projectId },
      }),
    });

  async function savedTemplate(template: { projectId: string }) {
    if (template.projectId === projectId) {
      onSavedTemplate();
    }
    await invalidateTemplates(template);
  }

  const create = useMutation(
    orpc.createWorkTemplate.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.createWorkTemplate(input),
      onSuccess: savedTemplate,
    }),
  );
  const instantiate = useMutation(
    orpc.instantiateWorkTemplate.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.instantiateWorkTemplate(input),
      onSuccess: async (work) => {
        if (work.projectId === projectId) {
          onCreatedWork(work.key);
        }
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.projectWorks.queryKey({
              input: { projectId: work.projectId },
            }),
          }),
          ...invalidateSmartCollectionMembership(queryClient),
        ]);
      },
    }),
  );
  const update = useMutation(
    orpc.updateWorkTemplate.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.updateWorkTemplate(input),
      onSuccess: savedTemplate,
    }),
  );
  const moveToTrash = useMutation(
    orpc.trashWorkTemplate.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.trashWorkTemplate(input),
      onSuccess: invalidateTemplates,
    }),
  );

  return { create, instantiate, moveToTrash, query, update };
}
