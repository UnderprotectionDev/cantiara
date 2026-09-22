// biome-ignore-all lint/performance/noJsxPropsBind: Checklist controls close over their current Work state.

import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import WorkChecklist from "./work-checklist";

function checklistMutationErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Checklist could not be saved. Try again.";
}

export default function WorkChecklistEditor({ work }: { work: WorkProfile }) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (checklist: WorkProfile["checklist"]) =>
      runOnlineOnlyWrite(() =>
        client.updateWorkChecklist({
          baseRevision: work.revision,
          checklist,
          clientIdempotencyKey: crypto.randomUUID(),
          workId: work.id,
        }),
      ),
    onError: (mutationError) => {
      setError(checklistMutationErrorMessage(mutationError));
    },
    onSuccess: (updatedWork) => {
      setError(null);
      for (const archived of [work.archivedAt !== null, "all" as const]) {
        queryClient.setQueryData<WorkProfile[]>(
          orpc.projectWorks.queryOptions({
            input: { archived, projectId: work.projectId },
          }).queryKey,
          (current) =>
            current?.map((item) =>
              item.id === updatedWork.id ? updatedWork : item,
            ),
        );
      }
      queryClient.setQueryData(
        orpc.work.queryOptions({ input: { workId: work.id } }).queryKey,
        updatedWork,
      );
    },
  });

  return (
    <div className="space-y-1">
      <WorkChecklist
        checklist={work.checklist}
        disabled={
          connection === "offline" ||
          mutation.isPending ||
          work.archivedAt !== null
        }
        onSave={(checklist) => mutation.mutateAsync(checklist)}
        workKey={work.key}
      />
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
