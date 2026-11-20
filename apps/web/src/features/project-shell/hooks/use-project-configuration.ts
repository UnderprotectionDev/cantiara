import type { ProjectShellConfigurationChange } from "@cantiara/api/project-shell";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";

export function useProjectConfiguration(
  projectId: string,
  baseRevision: number,
) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const mutation = usePreparedMutation(
    orpc.updateProjectConfiguration.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.updateProjectConfiguration(input),
      onError: (mutationError) => {
        setError(
          mutationError instanceof Error
            ? mutationError.message
            : "Project configuration could not be changed. Try again.",
        );
      },
      onSuccess: async (
        nextProject,
        { change, projectId: targetProjectId },
      ) => {
        const projectQueryKey = orpc.project.queryKey({
          input: { projectId: targetProjectId },
        });
        setError(null);
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

  return { error, mutation };
}
