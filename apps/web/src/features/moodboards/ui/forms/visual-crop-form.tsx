// biome-ignore-all lint/performance/noJsxPropsBind: Crop fields bind to the form and the displayed visual view.
import {
  cropToInsets,
  insetsToCrop,
  type VisualView,
  visualViewSchema,
} from "@cantiara/api/moodboard-view";
import { MOODBOARD_UI_LABELS } from "@cantiara/api/moodboards";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";

const BASIS_POINTS_PER_PERCENT = 100;
const INSET_EDGES = ["top", "right", "bottom", "left"] as const;

/** `Crop` inset fields for one visual: applies a validated crop to the view. */
export default function VisualCropForm({
  idPrefix,
  onApply,
  open,
  view,
}: {
  idPrefix: string;
  onApply: (view: VisualView) => void;
  open: boolean;
  view: VisualView;
}) {
  const [invalid, setInvalid] = useState(false);
  const form = useForm({
    defaultValues: cropToInsets(view.crop),
    onSubmit: ({ value }) => {
      const crop = insetsToCrop(value);
      const parsed =
        crop === "invalid"
          ? null
          : visualViewSchema.safeParse({ crop, rotation: view.rotation });
      if (!parsed?.success) {
        setInvalid(true);
        return;
      }
      setInvalid(false);
      onApply(parsed.data);
    },
  });

  function applyCrop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  if (!open) {
    return null;
  }
  return (
    <form onSubmit={applyCrop}>
      <fieldset className="grid grid-cols-4 gap-2">
        <legend className="text-sm">
          {MOODBOARD_UI_LABELS.crop} (percent cut from each edge)
        </legend>
        {INSET_EDGES.map((edge) => (
          <form.Field key={edge} name={edge}>
            {(field) => (
              <div className="space-y-1">
                <Label className="capitalize" htmlFor={`${idPrefix}-${edge}`}>
                  {edge}
                </Label>
                <Input
                  id={`${idPrefix}-${edge}`}
                  max={99}
                  min={0}
                  name={field.name}
                  onChange={(event) =>
                    field.handleChange(
                      Math.round(
                        Number(event.target.value) * BASIS_POINTS_PER_PERCENT,
                      ),
                    )
                  }
                  type="number"
                  value={field.state.value / BASIS_POINTS_PER_PERCENT}
                />
              </div>
            )}
          </form.Field>
        ))}
        <div className="col-span-4 flex items-center gap-2">
          <Button type="submit">Apply</Button>
          {invalid ? (
            <span role="alert">Crop must leave part of the image.</span>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}
