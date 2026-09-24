import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import type { WorkStatus } from "@cantiara/api/work-lifecycle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";
import {
  type KanbanStatusMoveHandlers,
  requestKanbanStatusMove,
} from "../../lib/kanban-status";
import KanbanBoard from "./kanban-board";

type KanbanDirectMove = Parameters<KanbanStatusMoveHandlers["onDirectMove"]>[0];

export default function ProjectWorkKanban({
  onExplicitStatusAction,
  projectId,
  workStatusLabels,
}: {
  onExplicitStatusAction: (input: {
    status: WorkStatus;
    workId: string;
  }) => void;
  projectId: string;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const query = useQuery(
    orpc.projectWorks.queryOptions({
      input: { archived: false, projectId },
    }),
  );
  const updateStatus = useMutation({
    mutationFn: (input: KanbanDirectMove) =>
      runOnlineOnlyWrite(() =>
        client.updateWorkStatus({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: async (work) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectWorksQueryPrefix,
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.work.queryOptions({
            input: { workId: work.id },
          }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.scopeTree.queryOptions({
            input: { projectId },
          }).queryKey,
        }),
      ]);
    },
  });
  const handleStatusAction = useCallback(
    (
      work: Parameters<typeof requestKanbanStatusMove>[0],
      targetStatus: WorkStatus,
    ) =>
      requestKanbanStatusMove(work, targetStatus, {
        onDirectMove: updateStatus.mutate,
        onExplicitActionRequired: onExplicitStatusAction,
      }),
    [onExplicitStatusAction, updateStatus.mutate],
  );

  if (query.isPending) {
    return <p className="text-muted-foreground text-sm">Loading Work…</p>;
  }

  if (query.isError) {
    return (
      <p className="text-destructive text-sm" role="alert">
        Work is unavailable. Try loading this page again.
      </p>
    );
  }

  const isDisabled = connection === "offline" || updateStatus.isPending;

  return (
    <KanbanBoard
      disabled={isDisabled}
      error={
        updateStatus.error ? mutationErrorMessage(updateStatus.error) : null
      }
      onStatusAction={handleStatusAction}
      projectId={projectId}
      workStatusLabels={workStatusLabels}
      works={query.data}
    />
  );
}

function mutationErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Work status could not be changed. Try again.";
}
