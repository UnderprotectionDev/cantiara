// biome-ignore-all lint/performance/noJsxPropsBind: Focus Period controls act on the selected period and Work.
import {
  type FocusPeriodRecord,
  focusPeriodMembershipInputSchema,
} from "@cantiara/api/focus-period";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import type {
  FocusPeriodAction,
  FocusPeriodMembershipMutation,
} from "../../lib/focus-period-actions";

export function FocusPeriodMembershipControl({
  period,
  periods,
  add,
  move,
  act,
}: {
  period: FocusPeriodRecord;
  periods: FocusPeriodRecord[];
  add: FocusPeriodMembershipMutation;
  move: FocusPeriodMembershipMutation;
  act: FocusPeriodAction;
}) {
  function findActiveSource(selectedWorkId: string) {
    return period.status === "Active" && selectedWorkId
      ? periods.find(
          (item) =>
            item.id !== period.id &&
            item.status === "Active" &&
            item.members.some((member) => member.id === selectedWorkId),
        )
      : undefined;
  }
  const form = useForm({
    defaultValues: { workId: "" },
    onSubmit: ({ formApi, value }) =>
      act(async () => {
        const parsed = focusPeriodMembershipInputSchema.safeParse({
          periodId: period.id,
          workId: value.workId,
        });
        if (!parsed.success) {
          throw parsed.error;
        }
        const mutation = findActiveSource(value.workId) ? move : add;
        await mutation.mutateAsync(parsed.data);
        formApi.reset();
      }),
  });
  const workId = useStore(form.store, (state) => state.values.workId);
  const activeSource = findActiveSource(workId);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <div className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
        <label htmlFor={`focus-period-work-${period.id}`}>Select Work</label>
        <form.Field name="workId">
          {(field) => (
            <NativeSelect
              className="w-full"
              id={`focus-period-work-${period.id}`}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">Select Work</NativeSelectOption>
              {period.available.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.projectName} · {item.key} · {item.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
      </div>
      <Button disabled={!workId} type="submit">
        {activeSource ? "Move" : "Add Work"}
      </Button>
    </form>
  );
}
