// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields and the inspected card.
import type { ProjectWallCardView } from "@cantiara/api/project-wall";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useId } from "react";
import { drawVisualLinkFormSchema } from "../../lib/project-wall-narrative-forms";
import { cardTitle } from "../../lib/project-wall-outline";

export default function BindLinkForm({
  onDrawLink,
  card,
  cards,
}: {
  onDrawLink: (input: {
    fromCardId: string;
    label: string;
    toCardId: string;
  }) => Promise<boolean>;
  card: ProjectWallCardView;
  cards: ProjectWallCardView[];
}) {
  const toId = useId();
  const labelId = useId();
  const form = useForm({
    defaultValues: { label: "", to: "" },
    onSubmit: async ({ formApi, value }) => {
      const parsed = drawVisualLinkFormSchema.safeParse({
        fromCardId: card.id,
        label: value.label,
        toCardId: value.to,
      });
      if (!parsed.success) {
        return;
      }
      await onDrawLink(parsed.data);
      formApi.setFieldValue("label", "");
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label="Bind Visual link"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <p className="text-xs">From: {cardTitle(card)}</p>
      <form.Field name="to">
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor={toId}>To</Label>
            <NativeSelect
              id={toId}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">Select a card</NativeSelectOption>
              {cards
                .filter(({ id }) => id !== card.id)
                .map((other) => (
                  <NativeSelectOption key={other.id} value={other.id}>
                    {other.sourceType} · {cardTitle(other)}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </div>
        )}
      </form.Field>
      <form.Field name="label">
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor={labelId}>Label</Label>
            <Input
              id={labelId}
              maxLength={120}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values}>
        {({ label, to }) => (
          <Button
            disabled={to === "" || to === card.id || label.trim() === ""}
            type="submit"
            variant="outline"
          >
            Bind
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
