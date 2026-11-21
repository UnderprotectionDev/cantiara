import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type {
  ProjectShellConfiguration,
  WorkStatusLabel,
} from "@cantiara/api/project-shell";
import type { WorkStatus } from "@cantiara/api/work-lifecycle";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { currentDateInTimeZone } from "@/features/account-preferences/lib/account-preferences-format";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { useViewClock } from "@/lib/use-view-clock";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
  projectWorksQueryPrefix,
} from "@/utils/orpc";
import {
  type KanbanStatusMoveHandlers,
  requestKanbanStatusMove,
} from "../../lib/kanban-status";
import {
  filterDefaultKanbanWorks,
  sortKanbanWorks,
} from "../../lib/kanban-view";
import KanbanBoard from "./kanban-board";
import KanbanList from "./kanban-list";

type KanbanDirectMove = Parameters<KanbanStatusMoveHandlers["onDirectMove"]>[0];

export default function ProjectWorkKanban({
  onExplicitStatusAction,
  accountFormattingPreferences,
  focusThreshold,
  projectId,
  softWipLimits,
  sort,
  view,
  workStatusLabels,
}: {
  accountFormattingPreferences: AccountPreferences;
  focusThreshold: ProjectShellConfiguration["workFocusThreshold"];
  onExplicitStatusAction: (input: {
    status: WorkStatus;
    workId: string;
  }) => void;
  projectId: string;
  softWipLimits: ProjectShellConfiguration["workStatusSoftWipLimits"];
  sort: ProjectShellConfiguration["workSort"];
  view: "Board" | "List";
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const { timeZone } = accountFormattingPreferences;
  const today = currentDateInTimeZone(timeZone, useViewClock(30_000));
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const query = useQuery(
    orpc.projectWorks.queryOptions({
      input: { archived: false, projectId },
    }),
  );
  const updateStatus = usePreparedMutation(
    orpc.updateWorkStatus.mutationOptions({
      mutationFn: (input) => client.updateWorkStatus(input),
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
          ...invalidateSmartCollectionMembership(queryClient),
        ]);
      },
    }),
    (input: KanbanDirectMove) => ({
      ...input,
    }),
  );
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

  if (query.status === "pending") {
    return <p className="text-sm text-muted-foreground">Loading Work…</p>;
  }

  if (query.isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Work is unavailable. Try loading this page again.
      </p>
    );
  }

  const isDisabled = connection === "offline" || updateStatus.isPending;
  const works = sortKanbanWorks(
    filterDefaultKanbanWorks(query.data, today),
    sort,
  );

  if (view === "List") {
    return (
      <KanbanList
        focusThreshold={focusThreshold}
        projectId={projectId}
        workStatusLabels={workStatusLabels}
        works={works}
      />
    );
  }

  return (
    <KanbanBoard
      disabled={isDisabled}
      error={
        updateStatus.error ? mutationErrorMessage(updateStatus.error) : null
      }
      focusThreshold={focusThreshold}
      onStatusAction={handleStatusAction}
      projectId={projectId}
      softWipLimits={softWipLimits}
      workStatusLabels={workStatusLabels}
      works={works}
    />
  );
}

function mutationErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Work status could not be changed. Try again.";
}
