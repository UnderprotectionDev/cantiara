import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/utils/orpc";

/** `Revoke / Unpublish` of one surface, online only; the directory is read again after. */
export function useRemoveExternalSurface() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.removeExternalSurface.mutationOptions({
      meta: { onlineWrite: true, presentsSupportFailure: true },
      mutationFn: (input) => client.removeExternalSurface(input),
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: orpc.listExternalSurfaces.key(),
        }),
    }),
  );
}
