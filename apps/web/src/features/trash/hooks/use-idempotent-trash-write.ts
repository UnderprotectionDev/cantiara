import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { invalidateSmartCollectionMembership, orpc } from "@/utils/orpc";

// Every read family whose rows come from a record kind that Trash can move,
// restore or permanently delete (`TRASH_RECORD_KINDS` in packages/api trash.ts)
// or that derives from those records. A restore or delete of any kind can be
// opened from the Trash surface, so the list is not limited to the kinds the
// Move to Trash form offers.
const TRASH_AFFECTED_QUERY_KEYS = () => [
  orpc.trash.key(),
  orpc.projectWorks.key(),
  orpc.work.key(),
  orpc.documents.key(),
  orpc.projectScreens.key(),
  orpc.projectRisks.key(),
  orpc.projectDecisions.key(),
  orpc.listExternalSurfaces.key(),
  orpc.customFields.key(),
  orpc.customFieldValues.key(),
  orpc.customFieldProjectValues.key(),
  orpc.workTemplates.key(),
  orpc.workAutomationRules.key(),
  orpc.documentTemplates.key(),
  orpc.recordActions.key(),
  orpc.prioritizationSessions.key(),
  orpc.projectTestSessions.key(),
  orpc.projectGitHubOverview.key(),
  orpc.projectGitHubWorkLinks.key(),
  orpc.dailyFocusDay.key(),
  orpc.focusPeriods.key(),
  orpc.scopeTree.key(),
  orpc.relations.key(),
  orpc.usedIn.key(),
  orpc.searchRecords.key(),
  orpc.workspaceOverview.key(),
];

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
        ...TRASH_AFFECTED_QUERY_KEYS().map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
        ...invalidateSmartCollectionMembership(queryClient),
      ]);
    }
  };
}
