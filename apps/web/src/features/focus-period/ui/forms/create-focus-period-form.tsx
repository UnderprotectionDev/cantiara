// biome-ignore-all lint/performance/noJsxPropsBind: Focus Period controls act on the selected period and Work.
import { createFocusPeriodInputSchema } from "@cantiara/api/focus-period";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";
import { DatePicker } from "@/components/date-picker";

export function CreateFocusPeriodForm({
  error,
  isPending,
  onCreate,
  onError,
}: {
  error: string | null;
  isPending: boolean;
  onCreate: (input: {
    purpose: string;
    startDate: string;
    endDate: string;
  }) => Promise<unknown>;
  onError: (message: string | null) => void;
}) {
  const form = useForm({
    defaultValues: { purpose: "", startDate: "", endDate: "" },
    onSubmit: async ({ value }) => {
      const parsed = createFocusPeriodInputSchema.safeParse(value);
      if (!parsed.success) {
        onError(
          value.purpose.trim()
            ? "Focus Period must be 1–8 weeks."
            : "Purpose is required.",
        );
        return;
      }
      onError(null);
      try {
        await onCreate(parsed.data);
        form.reset();
      } catch {
        onError("Focus Period could not be created.");
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <section aria-label="Create Focus Period" className="space-y-4">
      <h2 className="font-semibold text-xl">Create Focus Period</h2>
      <form className="grid gap-4 sm:grid-cols-3" onSubmit={submit}>
        <form.Field name="purpose">
          {(field) => (
            <label
              className="flex flex-col gap-1 text-sm"
              htmlFor="focus-period-create-purpose"
            >
              Purpose
              <Input
                aria-describedby={
                  error === "Purpose is required."
                    ? "focus-period-purpose-error"
                    : undefined
                }
                id="focus-period-create-purpose"
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
              {error === "Purpose is required." ? (
                <span
                  className="text-destructive"
                  id="focus-period-purpose-error"
                >
                  {error}
                </span>
              ) : null}
            </label>
          )}
        </form.Field>
        <form.Field name="startDate">
          {(field) => (
            <label
              className="flex flex-col gap-1 text-sm"
              htmlFor="focus-period-create-startDate"
            >
              Start date
              <DatePicker
                aria-describedby={
                  error === "Focus Period must be 1–8 weeks."
                    ? "focus-period-dates-error"
                    : undefined
                }
                ariaLabel="Start date"
                id="focus-period-create-startDate"
                onChange={field.handleChange}
                required
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="endDate">
          {(field) => (
            <label
              className="flex flex-col gap-1 text-sm"
              htmlFor="focus-period-create-endDate"
            >
              End date
              <DatePicker
                aria-describedby={
                  error === "Focus Period must be 1–8 weeks."
                    ? "focus-period-dates-error"
                    : undefined
                }
                ariaLabel="End date"
                id="focus-period-create-endDate"
                onChange={field.handleChange}
                required
                value={field.state.value}
              />
              {error === "Focus Period must be 1–8 weeks." ? (
                <span
                  className="text-destructive"
                  id="focus-period-dates-error"
                >
                  {error}
                </span>
              ) : null}
            </label>
          )}
        </form.Field>
        <div>
          <Button disabled={isPending} type="submit">
            Create Focus Period
          </Button>
        </div>
      </form>
    </section>
  );
}
