// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  CAPTURE_CONVERSION_TARGETS,
  type CaptureConversionTarget,
} from "@cantiara/api/capture-triage";
import type { ProjectProfile } from "@cantiara/api/project-shell";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import type { SubmitEvent } from "react";
import type { useCaptureConversionSetupForm } from "../../hooks/use-capture-setup-forms";

export function CaptureConversionSetupForm({
  form,
  isOnline,
  onCancel,
  previewPending,
  projects,
  sourceProjectId,
}: {
  form: ReturnType<typeof useCaptureConversionSetupForm>;
  isOnline: boolean;
  onCancel: () => void;
  previewPending: boolean;
  projects:
    | readonly Pick<ProjectProfile, "id" | "name" | "shortCode">[]
    | undefined;
  sourceProjectId: string | null;
}) {
  const availableProjects = projects ?? [];

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.setErrorMap({ onSubmit: undefined });
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      className="space-y-3 border border-border/70 bg-muted/15 p-4"
      onSubmit={submit}
    >
      <form.Subscribe selector={(state): unknown => state.errorMap.onSubmit}>
        {(error) =>
          typeof error === "string" ? <p role="alert">{error}</p> : null
        }
      </form.Subscribe>
      <h3 className="text-sm font-semibold">Choose conversion target</h3>
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
                <p className="text-xs text-destructive">
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
