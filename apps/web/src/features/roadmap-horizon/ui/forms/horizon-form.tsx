// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current Work and field handlers.
import {
  type RoadmapHorizon,
  roadmapHorizonSchema,
  updateWorkHorizonInputSchema,
} from "@cantiara/api/roadmap-horizon";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, projectWorksQueryPrefix } from "@/utils/orpc";

const HORIZONS = ["Now", "Next", "Later"] as const;

export function HorizonForm({ work }: { work: WorkProfile }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof client.updateWorkHorizon>[0]) =>
      runOnlineOnlyWrite(() => client.updateWorkHorizon(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectWorksQueryPrefix }),
  });
  const form = useForm({
    defaultValues: {
      horizon: (work.roadmapHorizon ?? "") as RoadmapHorizon | "",
    },
    onSubmit: ({ value }) => {
      const parsed = updateWorkHorizonInputSchema.safeParse({
        baseRevision: work.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        horizon: value.horizon || null,
        workId: work.id,
      });
      if (!parsed.success) {
        return;
      }
      mutation.mutate(parsed.data);
    },
  });
  const horizon = useStore(form.store, (state) => state.values.horizon);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <label className="grid gap-1 text-xs" htmlFor={`horizon-${work.id}`}>
        Horizon
        <form.Field name="horizon">
          {(field) => (
            <NativeSelect
              id={`horizon-${work.id}`}
              name={field.name}
              onChange={(event) => {
                const next = roadmapHorizonSchema.safeParse(event.target.value);
                field.handleChange(next.success ? next.data : "");
              }}
              value={field.state.value}
            >
              <NativeSelectOption value="">No horizon</NativeSelectOption>
              {HORIZONS.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {value}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
      </label>
      <Button
        disabled={mutation.isPending || (work.roadmapHorizon ?? "") === horizon}
        size="sm"
        type="submit"
        variant="outline"
      >
        Place on horizon
      </Button>
      {mutation.isError ? (
        <p className="text-destructive text-xs" role="alert">
          Horizon could not be saved. Reload and try again.
        </p>
      ) : null}
    </form>
  );
}
