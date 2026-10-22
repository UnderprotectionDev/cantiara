// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props require closures over current field handlers.
import type { ProjectProfile } from "@cantiara/api/project-shell";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { Check, LockKeyhole, Pencil, Save } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { useProjectShortCode } from "../../hooks/use-project-short-code";

export default function ProjectShortCodeForm({
  project,
}: {
  project: ProjectProfile;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const { clearError, error, isPending, saveShortCode } =
    useProjectShortCode(project);

  const form = useForm({
    defaultValues: { shortCode: project.shortCode },
    onSubmit: async ({ value }) => {
      const nextShortCode = value.shortCode.trim();
      if (!nextShortCode || nextShortCode === project.shortCode) {
        return;
      }
      if (await saveShortCode(nextShortCode)) {
        setIsEditing(false);
      }
    },
  });

  useEffect(() => {
    form.setFieldValue("shortCode", project.shortCode);
  }, [form, project.shortCode]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  function cancelEditing() {
    form.setFieldValue("shortCode", project.shortCode);
    setIsEditing(false);
    clearError();
  }

  const handleStartEditing = useCallback(() => {
    clearError();
    setIsEditing(true);
  }, [clearError]);

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">Short code</p>
          <p className="mt-1 flex items-center gap-2 font-medium text-sm">
            <span>{project.shortCode}</span>
            {project.shortCodeLocked ? (
              <LockKeyhole
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
              />
            ) : null}
          </p>
          {project.shortCodeLocked ? (
            <p
              className="mt-1 text-muted-foreground text-xs"
              id={`short-code-help-${project.id}`}
            >
              Short code is locked after the first Work.
            </p>
          ) : null}
        </div>
        {project.shortCodeLocked ? null : (
          <Button
            aria-label="Edit Short code"
            className="min-h-11"
            onClick={handleStartEditing}
            size="sm"
            type="button"
            variant="outline"
          >
            <Pencil aria-hidden="true" />
            Edit
          </Button>
        )}
      </div>
    );
  }

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <label
        className="font-medium text-xs"
        htmlFor={`short-code-${project.id}`}
      >
        Short code
      </label>
      <form.Field name="shortCode">
        {(field) => (
          <Input
            aria-label="Short code"
            disabled={isPending}
            id={`short-code-${project.id}`}
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <form.Subscribe selector={(state) => state.values.shortCode}>
          {(shortCode) => (
            <Button
              className="min-h-11"
              disabled={
                isPending ||
                !shortCode.trim() ||
                shortCode.trim() === project.shortCode
              }
              size="sm"
              type="submit"
            >
              {isPending ? (
                <Save aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
              Save Short code
            </Button>
          )}
        </form.Subscribe>
        <Button
          className="min-h-11"
          disabled={isPending}
          onClick={cancelEditing}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
