import { useQueryClient } from "@tanstack/react-query";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";

type RelationCommand = Omit<
  Parameters<typeof client.createProjectWallPersistentRelation>[0],
  "clientIdempotencyKey" | "projectId" | "wallId"
>;

export function useProjectWallRelation(projectId: string, wallId: string) {
  const queryClient = useQueryClient();
  return usePreparedMutation(
    orpc.createProjectWallPersistentRelation.mutationOptions({
      mutationFn: (input) => client.createProjectWallPersistentRelation(input),
      onSettled: async (_, _error, input) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.projectWall.key({
              input: { projectId: input.projectId, wallId: input.wallId },
            }),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.projectWalls.key({
              input: { projectId: input.projectId },
            }),
          }),
        ]);
      },
    }),
    (input: RelationCommand) => ({ ...input, projectId, wallId }),
  );
}
