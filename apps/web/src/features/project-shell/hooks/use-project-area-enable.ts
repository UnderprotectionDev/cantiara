import type { ProjectArea } from "@cantiara/api/project-shell";
import { useQueryClient } from "@tanstack/react-query";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";

export function useProjectAreaEnable(projectId: string, baseRevision: number) {
  const queryClient = useQueryClient();
  const mutation = usePreparedMutation(
    orpc.enableProjectArea.mutationOptions({
      mutationFn: (input) => client.enableProjectArea(input),
      onSuccess: async (nextProject, input) => {
        const projectQueryKey = orpc.project.queryKey({
          input: { projectId: input.projectId },
        });
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

  const error = mutation.isError
    ? "Project area could not be enabled. Try again."
    : null;
  return { error, mutation };
}
