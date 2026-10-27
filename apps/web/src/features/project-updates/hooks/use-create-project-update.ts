import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
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
  return async function create(input: Omit<CreateInput, "updateId">) {
    const fingerprint = JSON.stringify(input);
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, id: crypto.randomUUID() };
    }
    const { id } = attempt.current;
    try {
      const saved = await runOnlineOnlyWrite(() =>
        client.createProjectUpdate({ ...input, updateId: id }),
      );
      attempt.current = null;
      return saved;
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.projectUpdates.key() }),
        // A save answers a due reminder on the server, so it is read again.
        queryClient.invalidateQueries({
          queryKey: orpc.projectUpdateReminder.key(),
        }),
      ]);
    }
  };
}
