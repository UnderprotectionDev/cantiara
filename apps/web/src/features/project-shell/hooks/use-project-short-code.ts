import type { ProjectProfile } from "@cantiara/api/project-shell";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { commandVariables } from "@/lib/command-variables";
import { client, orpc, projectsQueryPrefix } from "@/utils/orpc";

import { projectErrorMessage } from "../lib/project-list";

export function useProjectShortCode(project: ProjectProfile) {
  const queryClient = useQueryClient();
  const updateShortCode = useMutation(
    orpc.updateProjectShortCode.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.updateProjectShortCode(input),
      onSuccess: async (_, input) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: projectsQueryPrefix }),
          queryClient.invalidateQueries({
            queryKey: orpc.project.queryKey({
              input: { projectId: input.projectId },
            }),
          }),
        ]);
        toast.success("Short code saved.");
      },
    }),
  );

  async function saveShortCode(shortCode: string) {
    try {
      await updateShortCode.mutateAsync(
        commandVariables(
          { baseRevision: project.revision, projectId: project.id, shortCode },
          updateShortCode.isError ? updateShortCode.variables : undefined,
        ),
      );
      return true;
    } catch {
      return false;
    }
  }

  return {
    clearError: updateShortCode.reset,
    error: updateShortCode.isError
      ? projectErrorMessage(updateShortCode.error)
      : null,
    isPending: updateShortCode.isPending,
    isSuccess: updateShortCode.isSuccess,
    saveShortCode,
  };
}
