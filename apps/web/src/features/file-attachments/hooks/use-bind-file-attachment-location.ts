import type { FileAttachmentLocationBindInput } from "@cantiara/api/file-attachments";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
  projectWorksQueryPrefix,
} from "@/utils/orpc";

/**
 * `Bind as origin`: the confirmed bind creates a Work or moves an existing
 * Work's origin to the File Attachment location, so Work lists, Work reads and
 * Smart Collection membership are read again afterwards.
 */
export function useBindFileAttachmentLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: orpc.bindFileAttachmentLocation.mutationKey(),
    mutationFn: async (input: FileAttachmentLocationBindInput) => {
      await client.bindFileAttachmentLocation(input);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: projectWorksQueryPrefix }),
        queryClient.invalidateQueries({ queryKey: orpc.work.key() }),
        ...invalidateSmartCollectionMembership(queryClient),
      ]),
  });
}
