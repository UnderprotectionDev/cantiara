// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props require closures over current field handlers.
import {
  type DailyFocusWork,
  dailyFocusMembershipInputSchema,
} from "@cantiara/api/daily-focus";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

export default function DailyFocusAddForm({
  available,
  focusDate,
  onAdd,
  pending,
}: {
  available: DailyFocusWork[];
  focusDate: string;
  onAdd: (workId: string) => Promise<unknown>;
  pending: boolean;
}) {
  const form = useForm({
    defaultValues: { workId: "" },
    onSubmit: async ({ value }) => {
      const parsed = dailyFocusMembershipInputSchema.safeParse({
        focusDate,
        workId: value.workId,
      });
      if (!parsed.success) {
        return;
      }
      try {
        await onAdd(parsed.data.workId);
        form.reset();
      } catch {
        // The view reports the failed update; the selected Work stays.
      }
    },
  });
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={handleSubmit}
    >
      <form.Field name="workId">
        {(field) => (
          <label
            className="flex min-w-0 flex-1 flex-col gap-2 text-sm"
            htmlFor="daily-focus-work"
          >
            <span className="font-medium">Work</span>
            <NativeSelect
              className="w-full"
              id="daily-focus-work"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">Select Work</NativeSelectOption>
              {available.map((work) => (
                <NativeSelectOption key={work.id} value={work.id}>
                  {work.projectName} · {work.key} · {work.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.workId}>
        {(workId) => (
          <Button
            className="min-h-11"
            disabled={!workId || pending}
            type="submit"
          >
            Add to Daily Focus
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
