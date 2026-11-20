import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/utils/orpc";

/** `Revoke / Unpublish` of one surface, online only; the directory is read again after. */
export function useRemoveExternalSurface() {
  const removeExternalSurfaceMutation = useMutation(
    orpc.removeExternalSurface.mutationOptions({
      mutationFn: (input) => client.removeExternalSurface(input),
    }),
  );
  const queryClient = useQueryClient();
  return async (surfaceId: string) => {
    try {
      return await removeExternalSurfaceMutation.mutateAsync({ surfaceId });
    } finally {
      await queryClient.invalidateQueries({
        queryKey: orpc.listExternalSurfaces.key(),
      });
    }
  };
}
