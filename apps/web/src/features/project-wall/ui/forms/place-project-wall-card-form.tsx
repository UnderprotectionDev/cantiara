// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields and the displayed wall.
import type {
  ProjectWallSourceOption,
  ProjectWallSourceType,
} from "@cantiara/api/project-wall";
import { Button } from "@cantiara/ui/components/button";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

import {
  optionKey,
  placeProjectWallCardFormSchema,
} from "../../lib/project-wall-forms";

/** Picks an existing master record; the wall stores only its id and type. */
export function AddCardForm({
  onAddCard,
  options,
  placed,
}: {
  onAddCard: (source: {
    diagramViewId?: string;
    sourceId: string;
    sourceType: ProjectWallSourceType;
  }) => Promise<boolean>;
  options: ProjectWallSourceOption[];
  /** Records already on this wall: one live card per record per wall. */
  placed: ReadonlySet<string>;
}) {
  // One live card per record per wall, whichever Diagram View it selects.
  const available = options.filter(
    (option) => !placed.has(`${option.sourceType}:${option.id}`),
  );
  const form = useForm({
    defaultValues: { selected: "" },
    onSubmit: async ({ formApi, value }) => {
      const parsed = placeProjectWallCardFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      const option = available.find(
        (candidate) => optionKey(candidate) === parsed.data.selected,
      );
      if (!option) {
        return;
      }
      if (
        await onAddCard({
          ...(option.diagramViewId
            ? { diagramViewId: option.diagramViewId }
            : {}),
          sourceId: option.id,
          sourceType: option.sourceType,
        })
      ) {
        // Only a persisted card drops the selection; a failed write keeps it.
        formApi.reset();
      }
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label="Place live card"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <div className="space-y-1">
        <Label htmlFor="project-wall-source">Source record</Label>
        <form.Field name="selected">
          {(field) => (
            <NativeSelect
              id="project-wall-source"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">Select a record</NativeSelectOption>
              {available.map((option) => (
                <NativeSelectOption
                  key={optionKey(option)}
                  value={optionKey(option)}
                >
                  {option.sourceType} · {option.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
      </div>
      <form.Subscribe selector={(state) => state.values.selected}>
        {(selected) => (
          <Button disabled={!selected} type="submit">
            Place live card
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
