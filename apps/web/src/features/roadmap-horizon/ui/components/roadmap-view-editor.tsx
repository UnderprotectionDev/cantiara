// biome-ignore-all lint/performance/noJsxPropsBind: View fields bind to the form and its live preview.
import type {
  RoadmapHorizon,
  RoadmapView,
} from "@cantiara/api/roadmap-horizon";
import { WORK_TYPE_OPTIONS } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

const HORIZONS = ["Now", "Next", "Later"] as const;
const VIEW_FIELDS = ["Horizon", "Type", "Status"] as const;

interface ViewValues {
  groupBy: RoadmapView["groupBy"];
  horizon: string;
  markBy: RoadmapView["markBy"];
  name: string;
  type: string;
}

function viewValues(saved: RoadmapView | null): ViewValues {
  return {
    groupBy: saved?.groupBy ?? "Horizon",
    horizon: saved?.horizons[0] ?? "",
    markBy: saved?.markBy ?? "Type",
    name: saved?.name ?? "",
    type: saved?.types[0] ?? "",
  };
}

function viewFromValues(
  value: ViewValues,
  id: string,
  projectId: string,
): RoadmapView {
  return {
    groupBy: value.groupBy,
    horizons: value.horizon ? [value.horizon as RoadmapHorizon] : [],
    id,
    markBy: value.markBy,
    name: value.name || "All Work types",
    projectId,
    types: value.type ? [value.type as (typeof WORK_TYPE_OPTIONS)[number]] : [],
  };
}

export default function RoadmapViewEditor({
  projectId,
  renderResults,
  saved,
  onSaved,
}: {
  projectId: string;
  renderResults: (view: RoadmapView) => ReactNode;
  saved: RoadmapView | null;
  onSaved: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const saveView = useMutation({
    mutationFn: (value: ViewValues) =>
      runOnlineOnlyWrite(() =>
        client.saveRoadmapView({
          ...viewFromValues(value, saved?.id ?? draftId, projectId),
          name: value.name.trim(),
        }),
      ),
    onSuccess: async (view) => {
      await queryClient.invalidateQueries({
        queryKey: orpc.projectRoadmapViews.queryOptions({
          input: { projectId },
        }).queryKey,
      });
      onSaved(view.id);
      setDraftId(crypto.randomUUID());
    },
  });
  const form = useForm({
    defaultValues: viewValues(saved),
    onSubmit: ({ value }) => saveView.mutateAsync(value),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.handleSubmit().catch(() => undefined);
  }
  function chooseGroup(value: RoadmapView["groupBy"]) {
    form.setFieldValue("groupBy", value);
    if (form.state.values.markBy === value) {
      form.setFieldValue(
        "markBy",
        VIEW_FIELDS.find((field) => field !== value) ?? "Type",
      );
    }
  }
  return (
    <div className="space-y-5">
      <form
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={submit}
      >
        <form.Field name="type">
          {(field) => (
            <label className="grid gap-1 text-sm">
              Type
              <select
                className="min-h-10 rounded-md border bg-background px-2"
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              >
                <option value="">All Work types</option>
                {WORK_TYPE_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="horizon">
          {(field) => (
            <label className="grid gap-1 text-sm">
              Horizon
              <select
                className="min-h-10 rounded-md border bg-background px-2"
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              >
                <option value="">No filter</option>
                {HORIZONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="groupBy">
          {(field) => (
            <label className="grid gap-1 text-sm">
              Group by
              <select
                className="min-h-10 rounded-md border bg-background px-2"
                onChange={(event) =>
                  chooseGroup(event.target.value as RoadmapView["groupBy"])
                }
                value={field.state.value}
              >
                {VIEW_FIELDS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.groupBy}>
          {(groupBy) => (
            <form.Field name="markBy">
              {(field) => (
                <label className="grid gap-1 text-sm">
                  Mark by
                  <select
                    className="min-h-10 rounded-md border bg-background px-2"
                    onChange={(event) =>
                      field.handleChange(
                        event.target.value as RoadmapView["markBy"],
                      )
                    }
                    value={field.state.value}
                  >
                    {VIEW_FIELDS.filter((option) => option !== groupBy).map(
                      (option) => (
                        <option key={option}>{option}</option>
                      ),
                    )}
                  </select>
                </label>
              )}
            </form.Field>
          )}
        </form.Subscribe>
        <form.Field name="name">
          {(field) => (
            <label className="grid gap-1 text-sm sm:col-span-2">
              Named view
              <input
                className="min-h-10 rounded-md border bg-background px-2"
                maxLength={100}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
        <div className="flex items-end">
          <form.Subscribe selector={(state) => state.values.name}>
            {(name) => (
              <Button
                disabled={!name.trim() || saveView.isPending}
                type="submit"
              >
                Save named view
              </Button>
            )}
          </form.Subscribe>
        </div>
        {saveView.isError ? (
          <p className="text-destructive text-sm" role="alert">
            Named view could not be saved.
          </p>
        ) : null}
      </form>
      <form.Subscribe selector={(state) => state.values}>
        {(values) =>
          renderResults(viewFromValues(values, saved?.id ?? draftId, projectId))
        }
      </form.Subscribe>
    </div>
  );
}
