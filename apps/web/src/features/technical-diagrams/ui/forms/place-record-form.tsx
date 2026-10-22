// biome-ignore-all lint/performance/noJsxPropsBind: The form binds its own selection field.
import { Button } from "@cantiara/ui/components/button";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";

import { placeRecordSchema } from "../../lib/technical-diagram-form-schemas";
import type { Target } from "./convert-node-form";

export interface RecordCardOption {
  id: string;
  sourceType: Target;
  title: string;
}

export function PlaceRecordForm({
  disabled,
  free,
  onPlace,
}: {
  disabled: boolean;
  free: RecordCardOption[];
  onPlace: (option: RecordCardOption) => void;
}) {
  const placeId = useId();
  const form = useForm({
    defaultValues: { choice: "" },
    onSubmit: ({ value, formApi }) => {
      if (!placeRecordSchema.safeParse(value).success) {
        return;
      }
      const picked = free.find(
        ({ id, sourceType }) => `${sourceType}:${id}` === value.choice,
      );
      if (picked) {
        onPlace(picked);
        formApi.reset();
      }
    },
  });
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <form.Field name="choice">
        {(field) => (
          <>
            <Label htmlFor={placeId}>Existing record</Label>
            <NativeSelect
              id={placeId}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">Choose a record</NativeSelectOption>
              {free.map((option) => (
                <NativeSelectOption
                  key={`${option.sourceType}:${option.id}`}
                  value={`${option.sourceType}:${option.id}`}
                >
                  {option.sourceType} · {option.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.choice}>
        {(choice) => (
          <Button disabled={disabled || !choice} type="submit">
            Place live card
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
