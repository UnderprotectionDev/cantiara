// biome-ignore-all lint/performance/noJsxPropsBind: Placement controls bind to the selected Work and preview.
import {
  createRoadmapPlacementPreview,
  ROADMAP_PLACEMENT_FIELD_LABELS,
  type RoadmapHorizon,
  type RoadmapPlacementChoice,
} from "@cantiara/api/roadmap-horizon";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, projectWorksQueryPrefix } from "@/utils/orpc";

const HORIZONS = ["Now", "Next", "Later"] as const;

function placementForSelection(
  field: RoadmapPlacementChoice["field"],
  horizon: RoadmapHorizon | "",
  date: string,
): RoadmapPlacementChoice | null {
  if (field === "horizon") {
    return horizon ? { field, value: horizon } : null;
  }
  return date ? { field, value: date } : null;
}

export default function RoadmapPlacementEditor({
  onCancel,
  onPlaced,
  work,
}: {
  onCancel: () => void;
  onPlaced: () => void;
  work: WorkProfile;
}) {
  const queryClient = useQueryClient();
  const [field, setField] =
    useState<RoadmapPlacementChoice["field"]>("horizon");
  const [horizon, setHorizon] = useState<RoadmapHorizon | "">("");
  const [date, setDate] = useState("");
  const [previewChoice, setPreviewChoice] =
    useState<RoadmapPlacementChoice | null>(null);
  const pendingCommand = useRef<{ fingerprint: string; key: string } | null>(
    null,
  );
  const mutation = useMutation({
    mutationFn: (choice: RoadmapPlacementChoice) => {
      const fingerprint = JSON.stringify({
        baseRevision: work.revision,
        choice,
      });
      const pending =
        pendingCommand.current?.fingerprint === fingerprint
          ? pendingCommand.current
          : { fingerprint, key: crypto.randomUUID() };
      pendingCommand.current = pending;
      return runOnlineOnlyWrite(() => {
        if (choice.field === "horizon") {
          return client.updateWorkHorizon({
            baseRevision: work.revision,
            clientIdempotencyKey: pending.key,
            horizon: choice.value,
            workId: work.id,
          });
        }
        return client.updateWorkPlannedDate({
          baseRevision: work.revision,
          clientIdempotencyKey: pending.key,
          field: choice.field,
          value: choice.value,
          workId: work.id,
        });
      });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: projectWorksQueryPrefix });
    },
    onSuccess: async () => {
      pendingCommand.current = null;
      await queryClient.invalidateQueries({
        queryKey: projectWorksQueryPrefix,
      });
      onPlaced();
    },
  });
  const placement = placementForSelection(field, horizon, date);
  const preview = previewChoice
    ? createRoadmapPlacementPreview(
        {
          horizon: work.roadmapHorizon ?? null,
          plannedStartDate: work.plannedStartDate ?? null,
          targetDate: work.targetDate,
        },
        previewChoice,
      )
    : null;
  const fieldLabel = ROADMAP_PLACEMENT_FIELD_LABELS[field];

  return (
    <section
      aria-label={`Place ${work.key} on plan`}
      className="mt-4 grid gap-3 rounded-md border bg-muted/20 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(12rem,0.7fr)_minmax(12rem,1fr)]">
        <label
          className="grid gap-1 text-sm"
          htmlFor={`placement-field-${work.id}`}
        >
          Field to change
          <select
            className="min-h-10 rounded-md border bg-background px-2"
            id={`placement-field-${work.id}`}
            onChange={(event) => {
              setField(event.target.value as RoadmapPlacementChoice["field"]);
              setPreviewChoice(null);
            }}
            value={field}
          >
            <option value="horizon">Horizon</option>
            <option value="plannedStartDate">Planned start date</option>
            <option value="targetDate">Target date</option>
          </select>
        </label>
        {field === "horizon" ? (
          <label
            className="grid gap-1 text-sm"
            htmlFor={`placement-horizon-${work.id}`}
          >
            Horizon
            <select
              className="min-h-10 rounded-md border bg-background px-2"
              id={`placement-horizon-${work.id}`}
              onChange={(event) => {
                setHorizon(event.target.value as RoadmapHorizon | "");
                setPreviewChoice(null);
              }}
              value={horizon}
            >
              <option value="">Choose a horizon</option>
              {HORIZONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label
            className="grid gap-1 text-sm"
            htmlFor={`placement-date-${work.id}`}
          >
            {fieldLabel}
            <input
              className="min-h-10 rounded-md border bg-background px-2"
              id={`placement-date-${work.id}`}
              onChange={(event) => {
                setDate(event.target.value);
                setPreviewChoice(null);
              }}
              type="date"
              value={date}
            />
          </label>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!placement}
          onClick={() => placement && setPreviewChoice(placement)}
          size="sm"
          type="button"
          variant="outline"
        >
          Preview
        </Button>
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
      {preview ? (
        <section aria-label="Preview" className="grid gap-3 border-t pt-3">
          <h4 className="font-medium text-sm">Preview</h4>
          <dl className="grid gap-1 text-sm">
            <dt className="text-muted-foreground">{preview.fieldLabel}</dt>
            <dd>
              {preview.previousValue} <span aria-hidden="true">→</span>{" "}
              {preview.nextValue}
            </dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={mutation.isPending}
              onClick={() => previewChoice && mutation.mutate(previewChoice)}
              size="sm"
              type="button"
            >
              {mutation.isPending ? "Saving…" : "Confirm"}
            </Button>
            <Button
              disabled={mutation.isPending}
              onClick={() => setPreviewChoice(null)}
              size="sm"
              type="button"
              variant="outline"
            >
              Change selection
            </Button>
          </div>
        </section>
      ) : null}
      {mutation.isError ? (
        <p className="text-destructive text-sm" role="alert">
          Plan could not be saved. Reload and try again.
        </p>
      ) : null}
    </section>
  );
}
