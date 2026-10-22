// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

import { recordTablePasteCorrectionFormSchema } from "../../lib/record-table-paste-form";

export function recordTablePasteCorrectionFormId(rowIndex: number) {
  return `record-table-correction-form-${rowIndex}`;
}

/**
 * The `Correct row` form of one pasted row. The row's `Correct row` button
 * submits it through its id; `onCorrect` receives only the edited fields.
 */
export default function RecordTablePasteCorrectionForm({
  fields,
  onCorrect,
  rowIndex,
}: {
  fields: readonly {
    choices: readonly string[] | undefined;
    currentValue: string;
    field: string;
    label: string;
  }[];
  onCorrect: (values: Record<string, string>) => void;
  rowIndex: number;
}) {
  const form = useForm({
    defaultValues: {} as Record<string, string>,
    onSubmit: ({ value }) => {
      const parsed = recordTablePasteCorrectionFormSchema.safeParse(value);
      if (parsed.success) {
        onCorrect(parsed.data);
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      className="space-y-2"
      id={recordTablePasteCorrectionFormId(rowIndex)}
      onSubmit={submit}
    >
      {fields.map(({ choices, currentValue, field, label }) => {
        const id = `record-table-correction-${rowIndex}-${field}`;
        return (
          <form.Field key={field} name={field}>
            {(state) => {
              const value = state.state.value ?? currentValue;
              return (
                <label
                  className="flex flex-wrap items-center gap-2"
                  htmlFor={id}
                >
                  <span>{label}</span>
                  {choices ? (
                    <NativeSelect
                      aria-label={`Correct ${label} in row ${rowIndex + 1}`}
                      id={id}
                      onChange={(event) =>
                        state.handleChange(event.target.value)
                      }
                      value={value}
                    >
                      <NativeSelectOption value="">
                        Select a value
                      </NativeSelectOption>
                      {choices.map((choice) => (
                        <NativeSelectOption key={choice} value={choice}>
                          {choice}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Input
                      aria-label={`Correct ${label} in row ${rowIndex + 1}`}
                      className="min-w-40"
                      id={id}
                      onChange={(event) =>
                        state.handleChange(event.target.value)
                      }
                      value={value}
                    />
                  )}
                </label>
              );
            }}
          </form.Field>
        );
      })}
    </form>
  );
}
