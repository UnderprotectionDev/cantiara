// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the picker fields.
import {
  WIREFRAME_LIVE_CARD_RECORD_TYPES,
  type WireframeLiveCardRecordType,
} from "@cantiara/api/wireframe-document";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";
import { placeLiveCardFormSchema } from "../../lib/screen-forms";

/**
 * `Place live card`: a read-only Work, Decision or Risk reference by record id.
 * Only the reference lands in the Wireframe; the title is read live and a
 * missing record paints as unavailable.
 */
export function LiveCardPicker({
  onPlace,
}: {
  onPlace: (record: {
    recordId: string;
    recordType: WireframeLiveCardRecordType;
  }) => void;
}) {
  const form = useForm({
    defaultValues: {
      recordId: "",
      recordType: "Work" as WireframeLiveCardRecordType,
    },
    onSubmit: ({ formApi, value }) => {
      const parsed = placeLiveCardFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      onPlace(parsed.data);
      formApi.setFieldValue("recordId", "");
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
      className="flex flex-wrap items-center gap-2"
      onSubmit={submit}
    >
      <label className="text-xs" htmlFor="live-card-type">
        Record type
      </label>
      <form.Field name="recordType">
        {(field) => (
          <NativeSelect
            id="live-card-type"
            name={field.name}
            onChange={(event) =>
              field.handleChange(
                event.target.value as WireframeLiveCardRecordType,
              )
            }
            value={field.state.value}
          >
            {WIREFRAME_LIVE_CARD_RECORD_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {type}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </form.Field>
      <label className="text-xs" htmlFor="live-card-record">
        Record id
      </label>
      <form.Field name="recordId">
        {(field) => (
          <Input
            className="w-48"
            id="live-card-record"
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      <Button size="sm" type="submit" variant="outline">
        Place live card
      </Button>
    </form>
  );
}
