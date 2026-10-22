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
import { useForm, useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, invalidateSmartCollectionMembership } from "@/utils/orpc";

async function abandonSelectedWork(
  periodId: string,
  workIds: string[],
  closeAnyway: boolean,
  decide: (
    input: Parameters<typeof client.decideFocusPeriodLeftovers>[0],
  ) => Promise<unknown>,
  afterEach: (workId: string) => void,
) {
  for (const selectedWorkId of workIds) {
    // biome-ignore lint/performance/noAwaitInLoops: Each Work closure precedes its individual decision for retry safety.
    const current = await client.work({ workId: selectedWorkId });
    if (current.status !== "Closed") {
      const preview = await client.workClosePreview({ workId: selectedWorkId });
      const hasChecks =
        preview.closureCheck.activeBlockers.length > 0 ||
        preview.closureCheck.incompleteChecklistItems.length > 0;
      if (hasChecks && !closeAnyway) {
        throw new Error("Review closure checks or select Close anyway.");
      }
      await runOnlineOnlyWrite(() =>
        client.closeWork({
          workId: selectedWorkId,
          baseRevision: current.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          closureResult: "Abandoned",
          ...(closeAnyway ? { closureCheck: "Close anyway" as const } : {}),
        }),
      );
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
  selectedWorkIds: string[];
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
  const form = useForm({
    defaultValues: {
      selectedWorkIds: [],
      destination: "Backlog",
      targetPeriodId: "",
      confirmAbandon: false,
      closeAnyway: false,
    } as LeftoverValues,
    onSubmit: ({ value }) => act(() => sendDecisions(value)),
  });
  async function sendDecisions(value: LeftoverValues) {
    const { closeAnyway, confirmAbandon, destination, selectedWorkIds } = value;
    if (!selectedWorkIds.length) {
      return;
    }
    if (destination === "Abandon") {
      if (!confirmAbandon) {
        throw new Error("Confirm Abandon first.");
      }
      await abandonSelectedWork(
        period.id,
        selectedWorkIds,
        closeAnyway,
        decide.mutateAsync,
        (decidedWorkId) =>
          form.setFieldValue("selectedWorkIds", (ids) =>
            ids.filter((id) => id !== decidedWorkId),
          ),
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
        form.setFieldValue("selectedWorkIds", (ids) =>
          ids.filter((id) => id !== selectedWorkId),
        );
      }
    }
    form.setFieldValue("selectedWorkIds", []);
  }
  const { confirmAbandon, destination, selectedWorkIds, targetPeriodId } =
    useStore(form.store, (state) => state.values);
  return period.status === "Closed" && undecided.length ? (
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
        <form.Field name="selectedWorkIds">
          {(field) => (
            <div className="space-y-2">
              {undecided.map((item) => (
                <label
                  className="flex items-center gap-2"
                  htmlFor={`focus-period-leftover-${item.id}`}
                  key={item.id}
                >
                  <Checkbox
                    checked={field.state.value.includes(item.id)}
                    id={`focus-period-leftover-${item.id}`}
                    onCheckedChange={(checked) =>
                      field.handleChange(
                        checked
                          ? [...field.state.value, item.id]
                          : field.state.value.filter((id) => id !== item.id),
                      )
                    }
                  />
                  {item.title} · {item.key}
                </label>
              ))}
            </div>
          )}
        </form.Field>
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
            !selectedWorkIds.length ||
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
