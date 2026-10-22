// biome-ignore-all lint/performance/noJsxPropsBind: Focus Period controls act on the selected period and Work.
import {
  type FocusPeriodRecord,
  focusPeriodEvaluationInputSchema,
} from "@cantiara/api/focus-period";
import { Button } from "@cantiara/ui/components/button";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import type {
  FocusPeriodAction,
  FocusPeriodSaveEvaluation,
} from "../../lib/focus-period-actions";

export function PeriodEvaluationSection({
  period,
  saveEvaluation,
  act,
}: {
  period: FocusPeriodRecord;
  saveEvaluation: FocusPeriodSaveEvaluation;
  act: FocusPeriodAction;
}) {
  const form = useForm({
    defaultValues: {
      keep: period.evaluation?.keep ?? "",
      change: period.evaluation?.change ?? "",
      tryNext: period.evaluation?.tryNext ?? "",
    },
    onSubmit: ({ value }) => save(value),
  });
  function save(next: { keep: string; change: string; tryNext: string }) {
    return act(async () => {
      const parsed = focusPeriodEvaluationInputSchema.safeParse({
        periodId: period.id,
        evaluation: next,
      });
      if (!parsed.success) {
        throw parsed.error;
      }
      await saveEvaluation.mutateAsync(parsed.data);
    });
  }
  function skip() {
    form.setFieldValue("keep", "");
    form.setFieldValue("change", "");
    form.setFieldValue("tryNext", "");
    return save({ keep: "", change: "", tryNext: "" });
  }
  return (
    <section aria-label="Period evaluation" className="space-y-3">
      <h3 className="font-semibold">Period evaluation</h3>
      <p className="text-muted-foreground text-sm">
        Optional learning notes. Leave the fields blank to skip.
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit().catch(() => undefined);
        }}
      >
        <form.Field name="keep">
          {(field) => (
            <label
              className="flex flex-col gap-1"
              htmlFor="focus-period-evaluation-keep"
            >
              Keep
              <Textarea
                className="min-h-20"
                id="focus-period-evaluation-keep"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="change">
          {(field) => (
            <label
              className="flex flex-col gap-1"
              htmlFor="focus-period-evaluation-change"
            >
              Change
              <Textarea
                className="min-h-20"
                id="focus-period-evaluation-change"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="tryNext">
          {(field) => (
            <label
              className="flex flex-col gap-1"
              htmlFor="focus-period-evaluation-tryNext"
            >
              Try next
              <Textarea
                className="min-h-20"
                id="focus-period-evaluation-tryNext"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Save evaluation</Button>
          <Button onClick={skip} type="button" variant="outline">
            Skip
          </Button>
        </div>
      </form>
    </section>
  );
}
