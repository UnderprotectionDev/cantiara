import type {
  PreviewRecordActionInput,
  RecordActionRuntimeInputs,
  UndoRecordActionInput,
} from "@cantiara/api/record-actions";
import { recordActionStepsNeedRuntimeInputs } from "@cantiara/api/record-actions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { commandVariables } from "@/lib/command-variables";
import { fetchCurrentWork } from "@/lib/fetch-current-work";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";

import type { ActiveRecordAction } from "../lib/record-action-run";

type RecordActionRefreshContext = Pick<
  Parameters<typeof client.applyRecordAction>[0],
  "focusDate" | "runtimeInputs"
>;

function mutationErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Record Action could not be completed. Try again.";
}

export function useRecordActionRunner(
  projectId: string,
  active: ActiveRecordAction,
) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [runVersion, setRunVersion] = useState(0);
  const needsRuntimeInput = recordActionStepsNeedRuntimeInputs(
    active.action.steps,
  );
  const needsRuntimeFieldInput = Boolean(
    active.action.steps.some(
      (step) =>
        step.kind === "custom-field-value" &&
        step.value.kind === "runtime-input",
    ),
  );
  const needsRuntimeRelationInput = Boolean(
    active.action.steps.some((step) => step.kind === "related-work"),
  );
  const runtimeCustomFieldsQueryOptions = orpc.customFields.queryOptions({
    input: { projectId },
  });
  const runtimeCustomFieldsQuery = useQuery({
    ...runtimeCustomFieldsQueryOptions,
    enabled: needsRuntimeFieldInput,
  });
  const runtimeWorksQueryOptions = orpc.projectWorks.queryOptions({
    input: { archived: false, projectId },
  });
  const runtimeWorksQuery = useQuery({
    ...runtimeWorksQueryOptions,
    enabled: needsRuntimeRelationInput,
  });

  // A committed run or its undo can change Work status, Daily Focus
  // membership, custom field values and related Works in one write; refresh
  // every surface that reads them.
  async function refreshWork(
    workId: string,
    run: RecordActionRefreshContext | null,
  ) {
    const relationRecordIds = [
      workId,
      ...Object.values(run?.runtimeInputs?.relations ?? {}).map(
        (relation) => relation.recordId,
      ),
    ];
    await Promise.all([
      ...invalidateSmartCollectionMembership(queryClient),
      ...(run
        ? [
            queryClient.invalidateQueries({
              queryKey: orpc.dailyFocusDay.queryOptions({
                input: { focusDate: run.focusDate },
              }).queryKey,
            }),
          ]
        : []),
      queryClient.invalidateQueries({
        queryKey: orpc.customFieldValues.queryOptions({
          input: {
            projectId,
            recordId: workId,
            recordType: "Work",
          },
        }).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.customFieldProjectValues.queryOptions({
          input: { projectId, recordType: "Work" },
        }).queryKey,
      }),
      ...relationRecordIds.flatMap((recordId) =>
        [orpc.relations, orpc.usedIn].map((procedure) =>
          queryClient.invalidateQueries({
            queryKey: procedure.queryOptions({
              input: { recordId, recordType: "Work" },
            }).queryKey,
          }),
        ),
      ),
      queryClient.invalidateQueries({
        queryKey: orpc.projectWorks.queryKey({ input: { projectId } }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.work.queryOptions({ input: { workId } }).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.scopeTree.queryOptions({
          input: { projectId },
        }).queryKey,
      }),
    ]);
  }

  const previewMutation = useMutation({
    mutationKey: orpc.previewRecordAction.mutationKey(),
    mutationFn: (input: PreviewRecordActionInput) =>
      client.previewRecordAction(input),
  });
  const applyMutation = useMutation(
    orpc.applyRecordAction.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.applyRecordAction(input),
      onSuccess: async (result, command) => {
        if (result.status === "committed") {
          await refreshWork(command.workId, command);
        }
      },
    }),
  );
  const undoMutation = useMutation({
    mutationKey: orpc.undoRecordAction.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({
      command,
    }: {
      command: UndoRecordActionInput;
      run: RecordActionRefreshContext | null;
    }) => client.undoRecordAction(command),
    onSuccess: async (_, { command, run }) => {
      await refreshWork(command.workId, run);
    },
  });
  const prepareUndo = useMutation({
    meta: { presentsSupportFailure: true },
    mutationFn: (workId: string) => fetchCurrentWork(queryClient, workId),
  });
  const isPreparingUndo = prepareUndo.isPending;
  const preview = previewMutation.data ?? null;
  const applyResult = applyMutation.data ?? null;
  const undoReceipt = undoMutation.data ?? null;
  const failure =
    prepareUndo.error ??
    undoMutation.error ??
    applyMutation.error ??
    previewMutation.error;
  const error = failure ? mutationErrorMessage(failure) : null;

  function resetRun() {
    prepareUndo.reset();
    previewMutation.reset();
    applyMutation.reset();
    undoMutation.reset();
  }
  const openingPreviewStarted = useRef<boolean>(false);
  const previewRun = previewMutation.mutate;
  useEffect(() => {
    if (
      openingPreviewStarted.current ||
      needsRuntimeInput ||
      connection === "offline"
    ) {
      return;
    }
    openingPreviewStarted.current = true;
    previewRun({
      actionId: active.action.id,
      runtimeInputs: { customFieldValues: {}, relations: {} },
      workId: active.work.id,
    });
  }, [active, connection, needsRuntimeInput, previewRun]);

  function startAgain() {
    if (
      connection === "offline" ||
      active.work.archivedAt !== null ||
      isPreparingUndo ||
      undoMutation.isPending
    ) {
      return;
    }
    setRunVersion((current) => current + 1);
    resetRun();
    if (!needsRuntimeInput) {
      previewRun({
        actionId: active.action.id,
        runtimeInputs: { customFieldValues: {}, relations: {} },
        workId: active.work.id,
      });
    }
  }

  function previewWithInputs(runtimeInputs: RecordActionRuntimeInputs) {
    if (
      connection === "offline" ||
      previewMutation.isPending ||
      isPreparingUndo ||
      undoMutation.isPending
    ) {
      return;
    }
    resetRun();
    previewMutation.mutate({
      actionId: active.action.id,
      runtimeInputs,
      workId: active.work.id,
    });
  }

  function changeInputs() {
    if (
      previewMutation.isPending ||
      applyMutation.isPending ||
      isPreparingUndo ||
      undoMutation.isPending
    ) {
      return;
    }
    resetRun();
  }

  function apply() {
    if (
      !preview ||
      connection === "offline" ||
      active.work.archivedAt !== null ||
      applyMutation.isPending
    ) {
      return;
    }
    const command = commandVariables<
      Omit<
        Parameters<typeof client.applyRecordAction>[0],
        "clientIdempotencyKey"
      >
    >(
      {
        actionId: preview.actionId,
        actionRevision: preview.actionRevision,
        baseRevision: preview.baseRevision,
        focusDate: preview.focusDate,
        previewFingerprint: preview.previewFingerprint,
        runtimeInputs: preview.runtimeInputs,
        workId: preview.workId,
      },
      applyMutation.isError ? applyMutation.variables : undefined,
    );
    applyMutation.mutate(command);
  }

  async function undo() {
    if (
      applyResult?.status !== "committed" ||
      connection === "offline" ||
      active.work.archivedAt !== null ||
      undoMutation.isPending ||
      isPreparingUndo
    ) {
      return;
    }
    prepareUndo.reset();
    if (undoMutation.isError) {
      undoMutation.mutate(undoMutation.variables);
      return;
    }

    const currentWork = await prepareUndo
      .mutateAsync(active.work.id)
      .catch(() => undefined);
    if (!currentWork) {
      return;
    }
    const command: UndoRecordActionInput = {
      baseRevision: currentWork.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      receiptId: applyResult.receipt.id,
      workId: active.work.id,
    };
    undoMutation.mutate({
      command,
      run: preview && {
        focusDate: preview.focusDate,
        runtimeInputs: preview.runtimeInputs,
      },
    });
  }

  return {
    active,
    apply,
    applyError: applyMutation.isError,
    applyResult,
    changeInputs,
    error,
    isApplying: applyMutation.isPending,
    isPreviewing: previewMutation.isPending,
    isPreparingUndo,
    isUndoing: isPreparingUndo || undoMutation.isPending,
    needsRuntimeInput,
    preview,
    previewWithInputs,
    runVersion,
    runtimeCustomFields:
      runtimeCustomFieldsQuery.data?.filter(
        (definition) => definition.trashedAt === null,
      ) ?? [],
    runtimeCustomFieldsError: runtimeCustomFieldsQuery.isError,
    runtimeCustomFieldsPending: runtimeCustomFieldsQuery.isPending,
    runtimeWorks: runtimeWorksQuery.data ?? [],
    runtimeWorksError: runtimeWorksQuery.isError,
    runtimeWorksPending: runtimeWorksQuery.isPending,
    startAgain,
    undo,
    undoError: undoMutation.isError,
    undoReceipt,
  };
}

export type RecordActionRunnerState = ReturnType<typeof useRecordActionRunner>;
