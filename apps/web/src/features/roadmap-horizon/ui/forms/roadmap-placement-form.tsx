// biome-ignore-all lint/performance/noJsxPropsBind: Placement fields bind to the form and the selected Work.
import {
  ROADMAP_PLACEMENT_FIELD_LABELS,
  type RoadmapHorizon,
  type RoadmapPlacementChoice,
} from "@cantiara/api/roadmap-horizon";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";
import { DatePicker } from "@/components/date-picker";
import { roadmapPlacementFormSchema } from "../../lib/roadmap-placement-form";

const HORIZONS = ["Now", "Next", "Later"] as const;

/** Chooses the Roadmap field and value to place a Work on the plan, then previews it. */
export default function RoadmapPlacementForm({
  onCancel,
  onChange,
  onPreview,
  workId,
}: {
  onCancel: () => void;
  onChange: () => void;
  onPreview: (choice: RoadmapPlacementChoice) => void;
  workId: string;
}) {
  const form = useForm({
    defaultValues: {
      date: "",
      field: "horizon" as RoadmapPlacementChoice["field"],
      horizon: "" as RoadmapHorizon | "",
    },
    // Any edit invalidates the previewed placement.
    listeners: { onChange },
    onSubmit: ({ value }) => {
      const parsed = roadmapPlacementFormSchema.safeParse({
        field: value.field,
        value: value.field === "horizon" ? value.horizon : value.date,
      });
      if (parsed.success) {
        onPreview(parsed.data);
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form className="grid gap-3" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-[minmax(12rem,0.7fr)_minmax(12rem,1fr)]">
        <form.Field name="field">
          {(field) => (
            <label
              className="grid gap-1 text-sm"
              htmlFor={`placement-field-${workId}`}
            >
              Field to change
              <NativeSelect
                className="w-full"
                id={`placement-field-${workId}`}
                name={field.name}
                onChange={(event) =>
                  field.handleChange(
                    event.target.value as RoadmapPlacementChoice["field"],
                  )
                }
                value={field.state.value}
              >
                <NativeSelectOption value="horizon">Horizon</NativeSelectOption>
                <NativeSelectOption value="plannedStartDate">
                  Planned start date
                </NativeSelectOption>
                <NativeSelectOption value="targetDate">
                  Target date
                </NativeSelectOption>
              </NativeSelect>
            </label>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.field}>
          {(selectedField) =>
            selectedField === "horizon" ? (
              <form.Field name="horizon">
                {(field) => (
                  <label
                    className="grid gap-1 text-sm"
                    htmlFor={`placement-horizon-${workId}`}
                  >
                    Horizon
                    <NativeSelect
                      className="w-full"
                      id={`placement-horizon-${workId}`}
                      name={field.name}
                      onChange={(event) =>
                        field.handleChange(
                          event.target.value as RoadmapHorizon | "",
                        )
                      }
                      value={field.state.value}
                    >
                      <NativeSelectOption value="">
                        Choose a horizon
                      </NativeSelectOption>
                      {HORIZONS.map((value) => (
                        <NativeSelectOption key={value} value={value}>
                          {value}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                )}
              </form.Field>
            ) : (
              <form.Field name="date">
                {(field) => (
                  <label
                    className="grid gap-1 text-sm"
                    htmlFor={`placement-date-${workId}`}
                  >
                    {ROADMAP_PLACEMENT_FIELD_LABELS[selectedField]}
                    <DatePicker
                      ariaLabel={ROADMAP_PLACEMENT_FIELD_LABELS[selectedField]}
                      id={`placement-date-${workId}`}
                      onChange={field.handleChange}
                      value={field.state.value}
                    />
                  </label>
                )}
              </form.Field>
            )
          }
        </form.Subscribe>
      </div>
      <div className="flex flex-wrap gap-2">
        <form.Subscribe selector={(state) => state.values}>
          {(values) => (
            <Button
              disabled={
                !(values.field === "horizon" ? values.horizon : values.date)
              }
              size="sm"
              type="submit"
              variant="outline"
            >
              Preview
            </Button>
          )}
        </form.Subscribe>
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}
