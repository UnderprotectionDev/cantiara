// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields and the displayed link.
import type { ProjectWallCardView } from "@cantiara/api/project-wall";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";
import { drawVisualLinkFormSchema } from "../../lib/project-wall-narrative-forms";
import { cardOptionLabel } from "../../lib/project-wall-narrative-labels";
import type { ProjectWallNarrativeActions } from "../components/project-wall-narrative";

export default function DrawLinkForm({
  cards,
  onDrawLink,
}: {
  cards: ProjectWallCardView[];
  onDrawLink: ProjectWallNarrativeActions["onDrawLink"];
}) {
  const form = useForm({
    defaultValues: { fromCardId: "", label: "", toCardId: "" },
    onSubmit: async ({ formApi, value }) => {
      const parsed = drawVisualLinkFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      if (await onDrawLink(parsed.data)) {
        // Only a persisted link clears the label; endpoints stay selected.
        formApi.setFieldValue("label", "");
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
      aria-label="Add Visual link"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <form.Field name="fromCardId">
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor="project-wall-link-from">From</Label>
            <NativeSelect
              id="project-wall-link-from"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">Select a card</NativeSelectOption>
              {cards.map((card) => (
                <NativeSelectOption key={card.id} value={card.id}>
                  {cardOptionLabel(card)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </form.Field>
      <form.Field name="toCardId">
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor="project-wall-link-to">To</Label>
            <NativeSelect
              id="project-wall-link-to"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">Select a card</NativeSelectOption>
              {cards.map((card) => (
                <NativeSelectOption key={card.id} value={card.id}>
                  {cardOptionLabel(card)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </form.Field>
      <form.Field name="label">
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor="project-wall-link-label">Label</Label>
            <Input
              id="project-wall-link-label"
              maxLength={120}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <Button
            disabled={!drawVisualLinkFormSchema.safeParse(values).success}
            type="submit"
            variant="outline"
          >
            Add Visual link
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
