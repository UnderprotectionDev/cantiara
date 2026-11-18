// biome-ignore-all lint/performance/noJsxPropsBind: Form fields close over the current session's addable Work.
import { createPrioritizationSessionInputSchema } from "@cantiara/api/prioritization-sessions";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

export default function PrioritizationSessionAddWorkForm({
  addableWorks,
  busy,
  onAddWork,
  sessionId,
}: {
  addableWorks: readonly WorkProfile[];
  busy: boolean;
  onAddWork: (workId: string) => Promise<unknown>;
  sessionId: string;
}) {
  const form = useForm({
    defaultValues: { workToAdd: "" },
    onSubmit: async ({ value }) => {
      const parsed =
        createPrioritizationSessionInputSchema.shape.workIds.safeParse([
          value.workToAdd,
        ]);
      const [workId] = parsed.success ? parsed.data : [];
      if (!workId) {
        return;
      }
      try {
        await onAddWork(workId);
      } catch {
        // The failed write is reported by the mutation; keep the choice.
        return;
      }
      form.reset();
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t border-border/70 pt-3"
      onSubmit={handleSubmit}
    >
      <form.Field name="workToAdd">
        {(field) => (
          <label
            className="grid min-w-52 gap-1 text-xs"
            htmlFor={`add-work-${sessionId}`}
          >
            <span>Work to add</span>
            <NativeSelect
              id={`add-work-${sessionId}`}
              name={field.name}
              onChange={(event) =>
                field.handleChange(event.currentTarget.value)
              }
              size="sm"
              value={field.state.value}
            >
              <NativeSelectOption value="">Select Work</NativeSelectOption>
              {addableWorks.map((work) => (
                <NativeSelectOption key={work.id} value={work.id}>
                  {work.key} {work.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.workToAdd}>
        {(workToAdd) => (
          <Button
            disabled={busy || !workToAdd}
            size="sm"
            type="submit"
            variant="outline"
          >
            Add Work
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
