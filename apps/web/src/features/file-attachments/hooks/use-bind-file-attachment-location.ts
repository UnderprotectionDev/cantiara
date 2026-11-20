import type { FileAttachmentLocationBindInput } from "@cantiara/api/file-attachments";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";

/**
 * `Bind as origin`: the confirmed bind creates a Work or moves an existing
 * Work's origin to the File Attachment location, so Work lists, Work reads and
 * Smart Collection membership are read again afterwards.
 */
export function useBindFileAttachmentLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { onlineWrite: true },
    mutationKey: orpc.bindFileAttachmentLocation.mutationKey(),
    mutationFn: (input: FileAttachmentLocationBindInput) =>
      client.bindFileAttachmentLocation(input),
    onSuccess: ({ work }) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.projectWorks.key({
            input: { projectId: work.projectId },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.work.key({ input: { workId: work.id } }),
        }),
        ...invalidateSmartCollectionMembership(queryClient),
      ]),
  });
}
