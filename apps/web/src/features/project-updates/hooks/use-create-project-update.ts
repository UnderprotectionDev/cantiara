import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { client, orpc } from "@/utils/orpc";

type CreateInput = Parameters<typeof client.createProjectUpdate>[0];

/**
 * Saves one Project Update online. The update id belongs to one attempt, so a
 * retry of the same save is replayed by the server instead of adding a second
 * entry; a changed save gets a new id. The chronology is refreshed afterwards.
 */
export function useCreateProjectUpdate() {
  const queryClient = useQueryClient();
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const createProjectUpdateMutation = useMutation(
    orpc.createProjectUpdate.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.createProjectUpdate(input),
      onSuccess: (_, { updateId }) => {
        if (attempt.current?.id === updateId) {
          attempt.current = null;
        }
      },
      onSettled: (_, __, { projectId }) =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.projectUpdates.queryKey({ input: { projectId } }),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.projectUpdateReminder.queryKey({
              input: { projectId },
            }),
          }),
        ]),
    }),
  );
  return async function create(input: Omit<CreateInput, "updateId">) {
    const fingerprint = JSON.stringify(input);
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, id: crypto.randomUUID() };
    }
    return await createProjectUpdateMutation.mutateAsync({
      ...input,
      updateId: attempt.current.id,
    });
  };
}
