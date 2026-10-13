import type { ProjectShellConfigurationChange } from "@cantiara/api/project-shell";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

export function useProjectConfiguration(
  projectId: string,
  baseRevision: number,
) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const projectQueryKey = orpc.project.queryOptions({
    input: { projectId },
  }).queryKey;
  const mutation = useMutation({
    mutationFn: (change: ProjectShellConfigurationChange) =>
      runOnlineOnlyWrite(() =>
        client.updateProjectConfiguration({
          baseRevision,
          change,
          clientIdempotencyKey: crypto.randomUUID(),
          projectId,
        }),
      ),
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Project configuration could not be changed. Try again.",
      );
    },
    onSuccess: async (nextProject, change) => {
      setError(null);
      queryClient.setQueryData(projectQueryKey, nextProject);
      await queryClient.invalidateQueries({
        queryKey: projectQueryKey,
      });
      if (change.kind === "set-status-age-threshold") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orpc.returnToWork.key() }),
          queryClient.invalidateQueries({
            queryKey: orpc.smartCollectionViews.key(),
          }),
        ]);
      }
    },
  });

  return { error, mutation };
}
