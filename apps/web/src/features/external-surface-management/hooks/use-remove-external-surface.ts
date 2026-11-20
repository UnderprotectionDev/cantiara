import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/utils/orpc";

/** `Revoke / Unpublish` of one surface, online only; the directory is read again after. */
export function useRemoveExternalSurface() {
  const queryClient = useQueryClient();
  const removeExternalSurfaceMutation = useMutation(
    orpc.removeExternalSurface.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.removeExternalSurface(input),
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: orpc.listExternalSurfaces.key(),
        }),
    }),
  );
  return (surfaceId: string) =>
    removeExternalSurfaceMutation.mutateAsync({ surfaceId });
}
