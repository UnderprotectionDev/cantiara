// biome-ignore-all lint/performance/noJsxPropsBind: Focus Period controls act on the selected period and Work.

import {
  type FocusPeriodRecord,
  type FocusPeriodSnapshotWork,
  focusPeriodDecisionInputSchema,
} from "@cantiara/api/focus-period";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
  VirtualList,
  virtualRowId,
} from "@cantiara/ui/components/virtual-list";
import { useForm, useSelector } from "@tanstack/react-form";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import {
  rowSelectionFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useEffect, useRef } from "react";
import { fetchCurrentWork } from "@/lib/fetch-current-work";
import { executeWrite } from "@/utils/execute-write";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";

const leftoverFeatures = tableFeatures({ rowSelectionFeature });
const leftoverColumns = [] as const;

type CloseWorkCommand = Parameters<typeof client.closeWork>[0];

async function abandonSelectedWork(
  queryClient: QueryClient,
  periodId: string,
  workIds: string[],
  closeAnyway: boolean,
  attempts: Map<string, CloseWorkCommand>,
  decide: (
    input: Parameters<typeof client.decideFocusPeriodLeftovers>[0],
  ) => Promise<unknown>,
  afterEach: (workId: string) => void,
) {
  for (const selectedWorkId of workIds) {
    // biome-ignore lint/performance/noAwaitInLoops: Each Work closure precedes its individual decision for retry safety.
    const current = await fetchCurrentWork(queryClient, selectedWorkId);
    if (current.status !== "Closed") {
      const preview = await client.workClosePreview({ workId: selectedWorkId });
      const hasChecks =
        preview.closureCheck.activeBlockers.length > 0 ||
        preview.closureCheck.incompleteChecklistItems.length > 0;
      if (hasChecks && !closeAnyway) {
        throw new Error("Review closure checks or select Close anyway.");
      }
      const closureCheck = closeAnyway ? ("Close anyway" as const) : undefined;
      const previous = attempts.get(selectedWorkId);
      const command =
        previous && previous.closureCheck === closureCheck
          ? previous
          : {
              workId: selectedWorkId,
              baseRevision: current.revision,
              clientIdempotencyKey: crypto.randomUUID(),
              closureResult: "Abandoned" as const,
              closureCheck,
            };
      attempts.set(selectedWorkId, command);
      await executeWrite(
        queryClient,
        command,
        (input) => client.closeWork(input),
        async (_, error) => {
          if (!error) {
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: orpc.work.queryKey({
                  input: { workId: command.workId },
                }),
              }),
              queryClient.invalidateQueries({
                queryKey: orpc.projectWorks.queryKey({
                  input: { projectId: current.projectId },
                }),
              }),
            ]);
          }
        },
        { presentsSupportFailure: true },
      );
      attempts.delete(selectedWorkId);
    } else if (current.closureResult !== "Abandoned") {
      throw new Error("Work was already completed.");
    }
    await decide({
      periodId,
      workIds: [selectedWorkId],
      destination: "Abandon",
    });
    afterEach(selectedWorkId);
  }
}

type LeftoverDestination =
  | "Next period"
  | "Another period"
  | "Backlog"
  | "Abandon";

interface LeftoverValues {
  closeAnyway: boolean;
  confirmAbandon: boolean;
  destination: LeftoverDestination;
  targetPeriodId: string;
}

export function PeriodLeftoverDecisions({
  period,
  undecided,
  targets,
  decide,
  act,
}: {
  period: FocusPeriodRecord;
  undecided: FocusPeriodSnapshotWork[];
  targets: FocusPeriodRecord[];
  decide: {
    mutateAsync: (
      input: Parameters<typeof client.decideFocusPeriodLeftovers>[0],
    ) => Promise<unknown>;
  };
  act: (
    action: () => Promise<unknown>,
    conflictMessage?: string,
  ) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const closeAttempts = useRef(new Map<string, CloseWorkCommand>());
  const table = useTable({
    columns: leftoverColumns,
    data: undecided,
    features: leftoverFeatures,
    getRowId: (work) => work.id,
  });
  const { getSelectedRowIds, setRowSelection } = table;
  const { rows, rowsById } = table.getRowModel();
  useEffect(() => {
    const selectedIds = getSelectedRowIds();
    const availableIds = selectedIds.filter((id) =>
      Object.hasOwn(rowsById, id),
    );
    if (availableIds.length !== selectedIds.length) {
      setRowSelection(Object.fromEntries(availableIds.map((id) => [id, true])));
    }
  }, [getSelectedRowIds, rowsById, setRowSelection]);

  const form = useForm({
    defaultValues: {
      destination: "Backlog",
      targetPeriodId: "",
      confirmAbandon: false,
      closeAnyway: false,
    } as LeftoverValues,
    onSubmit: ({ value }) => {
      const { rowsById: currentRowsById } = table.getRowModel();
      const selectedWorkIds = getSelectedRowIds().filter((id) =>
        Object.hasOwn(currentRowsById, id),
      );
      return act(() => sendDecisions(value, selectedWorkIds));
    },
  });
  function clearSelection(workId: string) {
    table.setRowSelection((selected) => {
      const remaining = { ...selected };
      delete remaining[workId];
      return remaining;
    });
  }
  async function sendDecisions(
    value: LeftoverValues,
    selectedWorkIds: string[],
  ) {
    const { closeAnyway, confirmAbandon, destination } = value;
    if (!selectedWorkIds.length) {
      return;
    }
    if (destination === "Abandon") {
      if (!confirmAbandon) {
        throw new Error("Confirm Abandon first.");
      }
      await abandonSelectedWork(
        queryClient,
        period.id,
        selectedWorkIds,
        closeAnyway,
        closeAttempts.current,
        decide.mutateAsync,
        clearSelection,
      );
      await Promise.all(invalidateSmartCollectionMembership(queryClient));
    } else {
      for (const selectedWorkId of selectedWorkIds) {
        const parsed = focusPeriodDecisionInputSchema.safeParse({
          periodId: period.id,
          workIds: [selectedWorkId],
          destination,
          ...(destination === "Another period"
            ? { targetPeriodId: value.targetPeriodId }
            : {}),
        });
        if (!parsed.success) {
          throw parsed.error;
        }
        // biome-ignore lint/performance/noAwaitInLoops: Each selected Work is recorded independently for recoverable partial sends.
        await decide.mutateAsync(parsed.data);
        clearSelection(selectedWorkId);
      }
    }
  }
  const { confirmAbandon, destination, targetPeriodId } = useSelector(
    form.store,
    (state) => state.values,
  );
  return period.status === "Closed" && rows.length ? (
    <section
      aria-label="Still-open Work decisions"
      className="space-y-3 rounded-md border p-4"
    >
      <h3 className="font-semibold">Still-open Work</h3>
      <p>Select Work and choose where it goes. Nothing moves automatically.</p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit().catch(() => undefined);
        }}
      >
        <VirtualList
          as="div"
          className="space-y-2"
          estimateSize={45}
          gap={8}
          getKey={virtualRowId}
          rows={rows}
        >
          {(row, rowProps) => (
            <label
              className="flex items-center gap-2"
              htmlFor={`focus-period-leftover-${row.id}`}
              {...rowProps}
            >
              <Checkbox
                checked={row.getIsSelected()}
                id={`focus-period-leftover-${row.id}`}
                onCheckedChange={(checked) =>
                  row.toggleSelected(checked === true)
                }
              />
              {row.original.title} · {row.original.key}
            </label>
          )}
        </VirtualList>
        <form.Field name="destination">
          {(field) => (
            <label
              className="flex flex-col gap-1"
              htmlFor="focus-period-leftover-destination"
            >
              Destination
              <NativeSelect
                className="w-full"
                id="focus-period-leftover-destination"
                name={field.name}
                onChange={(event) => {
                  const next = DESTINATIONS.find(
                    (option) => option === event.target.value,
                  );
                  if (next) {
                    field.handleChange(next);
                  }
                }}
                value={field.state.value}
              >
                {DESTINATIONS.map((option) => (
                  <NativeSelectOption key={option}>{option}</NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          )}
        </form.Field>
        {destination === "Another period" ? (
          <form.Field name="targetPeriodId">
            {(field) => (
              <label
                className="flex flex-col gap-1"
                htmlFor="focus-period-leftover-targetPeriodId"
              >
                Another period
                <NativeSelect
                  className="w-full"
                  id="focus-period-leftover-targetPeriodId"
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                >
                  <NativeSelectOption value="">
                    Select Focus Period
                  </NativeSelectOption>
                  {targets.map((target) => (
                    <NativeSelectOption key={target.id} value={target.id}>
                      {target.purpose}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            )}
          </form.Field>
        ) : null}
        {destination === "Abandon" ? (
          <div className="space-y-2">
            <form.Field name="confirmAbandon">
              {(field) => (
                <label
                  className="flex items-center gap-2"
                  htmlFor={`focus-period-confirm-abandon-${period.id}`}
                >
                  <Checkbox
                    checked={field.state.value}
                    id={`focus-period-confirm-abandon-${period.id}`}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked === true)
                    }
                  />
                  Confirm Abandon selected Work
                </label>
              )}
            </form.Field>
            <form.Field name="closeAnyway">
              {(field) => (
                <label
                  className="flex items-center gap-2"
                  htmlFor={`focus-period-close-anyway-${period.id}`}
                >
                  <Checkbox
                    checked={field.state.value}
                    id={`focus-period-close-anyway-${period.id}`}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked === true)
                    }
                  />
                  Close anyway if closure checks remain
                </label>
              )}
            </form.Field>
          </div>
        ) : null}
        <Button
          disabled={
            !table.getSelectedRowModel().rows.length ||
            (destination === "Another period" && !targetPeriodId) ||
            (destination === "Abandon" && !confirmAbandon)
          }
          type="submit"
        >
          Send
        </Button>
      </form>
    </section>
  ) : null;
}

const DESTINATIONS: LeftoverDestination[] = [
  "Next period",
  "Backlog",
  "Another period",
  "Abandon",
];
