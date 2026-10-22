// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  CAPTURE_CONVERSION_TARGETS,
  type CaptureConversionTarget,
  type CaptureConvertPreviewInput,
  captureConvertPreviewInputSchema,
} from "@cantiara/api/capture-triage";
import type { ProjectProfile } from "@cantiara/api/project-shell";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

export interface CaptureConversionSetupValues {
  projectId: string;
  recordType: CaptureConversionTarget | "";
}

function optionalProjectId(projectId: string) {
  return projectId.trim() || undefined;
}

export function CaptureConversionSetupForm({
  initialValues,
  isOnline,
  itemId,
  onCancel,
  onPreview,
  previewPending,
  projects,
  sourceProjectId,
}: {
  initialValues: CaptureConversionSetupValues;
  isOnline: boolean;
  itemId: string;
  onCancel: () => void;
  onPreview: (input: CaptureConvertPreviewInput) => void;
  previewPending: boolean;
  projects:
    | readonly Pick<ProjectProfile, "id" | "name" | "shortCode">[]
    | undefined;
  sourceProjectId: string | null;
}) {
  const availableProjects = projects ?? [];
  const form = useForm({
    defaultValues: initialValues,
    onSubmit: ({ value }) => {
      const parsed = captureConvertPreviewInputSchema.safeParse({
        itemId,
        projectId: optionalProjectId(value.projectId),
        recordType: value.recordType,
      });
      if (!parsed.success) {
        return;
      }
      onPreview(parsed.data);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      className="space-y-3 border border-border/70 bg-muted/15 p-4"
      onSubmit={submit}
    >
      <h3 className="font-semibold text-sm">Choose conversion target</h3>
      <form.Field name="recordType">
        {(field) => (
          <NativeSelect
            aria-label="Conversion target"
            name={field.name}
            onChange={(event) =>
              field.handleChange(event.target.value as CaptureConversionTarget)
            }
            value={field.state.value}
          >
            <NativeSelectOption value="">Choose a target</NativeSelectOption>
            {CAPTURE_CONVERSION_TARGETS.map((target) => (
              <NativeSelectOption key={target} value={target}>
                {target}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </form.Field>
      {sourceProjectId ? null : (
        <form.Field name="projectId">
          {(field) => (
            <NativeSelect
              aria-label="Project"
              disabled={availableProjects.length === 0}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">
                Workspace Capture Inbox
              </NativeSelectOption>
              {availableProjects.map((project) => (
                <NativeSelectOption key={project.id} value={project.id}>
                  {project.name} ({project.shortCode})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
      )}
      <form.Subscribe selector={(state) => state.values}>
        {({ projectId, recordType }) => {
          const requiresProject =
            recordType === "Work" && !sourceProjectId && !projectId.trim();
          return (
            <>
              {requiresProject ? (
                <p className="text-destructive text-xs">
                  Work conversion requires a Project.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={
                    !(isOnline && recordType) ||
                    requiresProject ||
                    previewPending
                  }
                  type="submit"
                >
                  Preview
                </Button>
                <Button onClick={onCancel} type="button" variant="outline">
                  Cancel
                </Button>
              </div>
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
