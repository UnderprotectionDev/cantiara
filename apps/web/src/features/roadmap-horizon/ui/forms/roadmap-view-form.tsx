// biome-ignore-all lint/performance/noJsxPropsBind: View fields bind to the form and its live preview.
import type {
  RoadmapHorizon,
  RoadmapView,
} from "@cantiara/api/roadmap-horizon";
import { saveRoadmapViewInputSchema } from "@cantiara/api/roadmap-horizon";
import { WORK_TYPE_OPTIONS } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormEvent, ReactNode } from "react";
import { useRef, useState } from "react";
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
  revision: number,
): RoadmapView {
  return {
    groupBy: value.groupBy,
    horizons: value.horizon ? [value.horizon as RoadmapHorizon] : [],
    id,
    markBy: value.markBy,
    name: value.name || "All Work types",
    projectId,
    revision,
    types: value.type ? [value.type as (typeof WORK_TYPE_OPTIONS)[number]] : [],
  };
}

export default function RoadmapViewEditor({
  presentationMode,
  projectId,
  renderResults,
  saved,
  onSaved,
}: {
  presentationMode: boolean;
  projectId: string;
  renderResults: (view: RoadmapView, presentationMode: boolean) => ReactNode;
  saved: RoadmapView | null;
  onSaved: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const pendingCommand = useRef<{
    clientIdempotencyKey: string;
    fingerprint: string;
  } | null>(null);
  const saveView = useMutation({
    mutationFn: (value: ViewValues) => {
      const baseRevision = saved?.revision ?? 0;
      const view = viewFromValues(
        value,
        saved?.id ?? draftId,
        projectId,
        baseRevision,
      );
      const command = {
        baseRevision,
        groupBy: view.groupBy,
        horizons: view.horizons,
        id: view.id,
        markBy: view.markBy,
        name: value.name.trim(),
        projectId: view.projectId,
        types: view.types,
      };
      const fingerprint = JSON.stringify(command);
      const pending =
        pendingCommand.current?.fingerprint === fingerprint
          ? pendingCommand.current
          : { clientIdempotencyKey: crypto.randomUUID(), fingerprint };
      pendingCommand.current = pending;
      const parsed = saveRoadmapViewInputSchema.safeParse({
        ...command,
        clientIdempotencyKey: pending.clientIdempotencyKey,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Check the form.");
      }
      return runOnlineOnlyWrite(() => client.saveRoadmapView(parsed.data));
    },
    onSuccess: async (view) => {
      await queryClient.invalidateQueries({
        queryKey: orpc.projectRoadmapViews.queryOptions({
          input: { projectId },
        }).queryKey,
      });
      onSaved(view.id);
      pendingCommand.current = null;
      setDraftId(crypto.randomUUID());
    },
  });
  const form = useForm({
    defaultValues: viewValues(saved),
    onSubmit: ({ value }) => saveView.mutateAsync(value),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
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
        hidden={presentationMode}
        onSubmit={submit}
      >
        <form.Field name="type">
          {(field) => (
            <label className="grid gap-1 text-sm" htmlFor="roadmap-view-type">
              Type
              <NativeSelect
                id="roadmap-view-type"
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              >
                <NativeSelectOption value="">All Work types</NativeSelectOption>
                {WORK_TYPE_OPTIONS.map((option) => (
                  <NativeSelectOption key={option}>{option}</NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          )}
        </form.Field>
        <form.Field name="horizon">
          {(field) => (
            <label
              className="grid gap-1 text-sm"
              htmlFor="roadmap-view-horizon"
            >
              Horizon
              <NativeSelect
                id="roadmap-view-horizon"
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              >
                <NativeSelectOption value="">No filter</NativeSelectOption>
                {HORIZONS.map((option) => (
                  <NativeSelectOption key={option}>{option}</NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          )}
        </form.Field>
        <form.Field name="groupBy">
          {(field) => (
            <label
              className="grid gap-1 text-sm"
              htmlFor="roadmap-view-group-by"
            >
              Group by
              <NativeSelect
                id="roadmap-view-group-by"
                onChange={(event) =>
                  chooseGroup(event.target.value as RoadmapView["groupBy"])
                }
                value={field.state.value}
              >
                {VIEW_FIELDS.map((option) => (
                  <NativeSelectOption key={option}>{option}</NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.groupBy}>
          {(groupBy) => (
            <form.Field name="markBy">
              {(field) => (
                <label
                  className="grid gap-1 text-sm"
                  htmlFor="roadmap-view-mark-by"
                >
                  Mark by
                  <NativeSelect
                    id="roadmap-view-mark-by"
                    onChange={(event) =>
                      field.handleChange(
                        event.target.value as RoadmapView["markBy"],
                      )
                    }
                    value={field.state.value}
                  >
                    {VIEW_FIELDS.filter((option) => option !== groupBy).map(
                      (option) => (
                        <NativeSelectOption key={option}>
                          {option}
                        </NativeSelectOption>
                      ),
                    )}
                  </NativeSelect>
                </label>
              )}
            </form.Field>
          )}
        </form.Subscribe>
        <form.Field name="name">
          {(field) => (
            <label
              className="grid gap-1 text-sm sm:col-span-2"
              htmlFor="roadmap-view-name"
            >
              Named view
              <Input
                id="roadmap-view-name"
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
          renderResults(
            viewFromValues(
              values,
              saved?.id ?? draftId,
              projectId,
              saved?.revision ?? 0,
            ),
            presentationMode,
          )
        }
      </form.Subscribe>
    </div>
  );
}
