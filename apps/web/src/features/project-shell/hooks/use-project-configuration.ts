import type { ProjectShellConfigurationChange } from "@cantiara/api/project-shell";
import { useQueryClient } from "@tanstack/react-query";

import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";

export function useProjectConfiguration(
  projectId: string,
  baseRevision: number,
) {
  const queryClient = useQueryClient();
  const mutation = usePreparedMutation(
    orpc.updateProjectConfiguration.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.updateProjectConfiguration(input),
      onSuccess: async (
        nextProject,
        { change, projectId: targetProjectId },
      ) => {
        const projectQueryKey = orpc.project.queryKey({
          input: { projectId: targetProjectId },
        });
        queryClient.setQueryData(projectQueryKey, nextProject);
        await queryClient.invalidateQueries({
          queryKey: projectQueryKey,
        });
        if (change.kind === "set-status-age-threshold") {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: orpc.returnToWork.key(),
            }),
            queryClient.invalidateQueries({
              queryKey: orpc.smartCollectionViews.key(),
            }),
          ]);
        }
      },
    }),
    (change: ProjectShellConfigurationChange) => ({
      baseRevision,
      change,
      projectId,
    }),
  );

  const failure =
    mutation.error?.message ??
    "Project configuration could not be changed. Try again.";
  const error = mutation.isError ? failure : null;
  return { error, mutation };
}
