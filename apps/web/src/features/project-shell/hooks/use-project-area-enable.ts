import type { ProjectArea } from "@cantiara/api/project-shell";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";

export function useProjectAreaEnable(projectId: string, baseRevision: number) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const projectQueryKey = orpc.project.queryOptions({
    input: { projectId },
  }).queryKey;
  const mutation = usePreparedMutation(
    orpc.enableProjectArea.mutationOptions({
      mutationFn: (input) => client.enableProjectArea(input),
      onError: () => {
        setError("Project area could not be enabled. Try again.");
      },
      onSuccess: async (nextProject) => {
        setError(null);
        queryClient.setQueryData(projectQueryKey, nextProject);
        await queryClient.invalidateQueries({ queryKey: projectQueryKey });
      },
    }),
    (area: ProjectArea) => ({
      area,
      baseRevision,
      projectId,
    }),
  );

  return { error, mutation };
}
