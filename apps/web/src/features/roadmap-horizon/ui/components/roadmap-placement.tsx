// biome-ignore-all lint/performance/noJsxPropsBind: Placement controls bind to the selected Work and preview.
import {
  createRoadmapPlacementPreview,
  type RoadmapPlacementChoice,
} from "@cantiara/api/roadmap-horizon";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";
import RoadmapPlacementForm from "../forms/roadmap-placement-form";

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
  const [previewChoice, setPreviewChoice] =
    useState<RoadmapPlacementChoice | null>(null);
  const placementKey = orpc.projectWorks.queryKey({
    input: { projectId: work.projectId },
  });
  const mutation = usePreparedMutation(
    {
      mutationFn: ({
        choice,
        ...command
      }: {
        choice: RoadmapPlacementChoice;
        baseRevision: number;
        workId: string;
        clientIdempotencyKey: string;
      }) => {
        if (choice.field === "horizon") {
          return client.updateWorkHorizon({
            ...command,
            horizon: choice.value,
          });
        }
        return client.updateWorkPlannedDate({
          ...command,
          field: choice.field,
          value: choice.value,
        });
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: placementKey });
        onPlaced();
      },
    },
    (choice: RoadmapPlacementChoice) => ({
      baseRevision: work.revision,
      choice,
      workId: work.id,
    }),
  );
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

  return (
    <section
      aria-label={`Place ${work.key} on plan`}
      className="mt-4 grid gap-3 rounded-md border bg-muted/20 p-4"
    >
      <RoadmapPlacementForm
        onCancel={onCancel}
        onChange={() => setPreviewChoice(null)}
        onPreview={setPreviewChoice}
        workId={work.id}
      />
      {preview ? (
        <section aria-label="Preview" className="grid gap-3 border-t pt-3">
          <h4 className="text-sm font-medium">Preview</h4>
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
        <p className="text-sm text-destructive" role="alert">
          Plan could not be saved. Reload and try again.
        </p>
      ) : null}
    </section>
  );
}
