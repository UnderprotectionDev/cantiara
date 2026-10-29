import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { orpc } from "@/utils/orpc";

/**
 * The shared shape of an online Trash write. The idempotency key belongs to
 * one attempt at one fingerprint (record and revision), so a retry is
 * replayed by the server and a changed record gets a new key; a success
 * clears the attempt. Trash and the source lists are refreshed afterwards,
 * whether the write succeeded or not.
 */
export function useIdempotentTrashWrite() {
  const queryClient = useQueryClient();
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  return async function write<Result>(
    fingerprint: string,
    send: (clientIdempotencyKey: string) => Promise<Result>,
  ) {
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    }
    const { key } = attempt.current;
    try {
      const result = await runOnlineOnlyWrite(() => send(key));
      attempt.current = null;
      return result;
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.trash.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.projectRisks.key() }),
        queryClient.invalidateQueries({
          queryKey: orpc.projectDecisions.key(),
        }),
        queryClient.invalidateQueries({ queryKey: orpc.customFields.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.workTemplates.key() }),
        queryClient.invalidateQueries({
          queryKey: orpc.workAutomationRules.key(),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.documentTemplates.key(),
        }),
      ]);
    }
  };
}
