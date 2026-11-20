// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields and the displayed bind.

import type {
  CardRecordOption,
  UserFlowCardKind,
} from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { submitForm } from "@/lib/submit-form";

import { placeCardFormSchema } from "../../lib/place-card-form";

export function PlaceCardForm({
  disabled,
  onPlace,
  options,
}: {
  disabled: boolean;
  onPlace: (kind: UserFlowCardKind, recordId: string) => Promise<unknown>;
  options: CardRecordOption[];
}) {
  const form = useForm({
    defaultValues: { recordId: "" },
    onSubmit: async ({ formApi, value }) => {
      const parsed = placeCardFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      const option = options.find(({ id }) => id === parsed.data.recordId);
      if (!option) {
        return;
      }
      try {
        await onPlace(option.kind, option.id);
        formApi.reset();
        form.setErrorMap({ onSubmit: undefined });
      } catch (failure) {
        form.setErrorMap({
          onSubmit: {
            form:
              failure instanceof Error
                ? failure.message
                : "The card could not be placed.",
            fields: {},
          },
        });
      }
    },
  });
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }
  return (
    <form className="space-y-2" onSubmit={submit}>
      <form.Field name="recordId">
        {(field) => (
          <>
            <Label htmlFor="user-flow-card-record">Record</Label>
            <NativeSelect
              id="user-flow-card-record"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">
                Select a Work, Decision or Risk
              </NativeSelectOption>
              {options.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {option.kind} · {option.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </>
        )}
      </form.Field>
      {error ? <p role="alert">{error}</p> : null}
      <form.Subscribe selector={(state) => state.values.recordId}>
        {(recordId) => (
          <Button disabled={disabled || recordId === ""} type="submit">
            Place live card
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
