// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { submitForm } from "@/lib/submit-form";
import {
  EMPTY_PROJECT_RELEASE_CREATE_DRAFT,
  projectReleaseCreateFormSchema,
} from "../../lib/project-release-planning-form";

export interface ProjectReleaseCreateValues {
  description: string | null;
  name: string;
  versionLabel: string | null;
}

/** 16.3 Create Project Release: Name, Version label, Description; starts `Draft`, no date. */
export function ProjectReleaseCreateForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (values: ProjectReleaseCreateValues) => Promise<unknown>;
}) {
  const form = useForm({
    defaultValues: EMPTY_PROJECT_RELEASE_CREATE_DRAFT,
    onSubmit: async ({ value }) => {
      form.setErrorMap({ onSubmit: undefined });
      const parsed = projectReleaseCreateFormSchema.safeParse(value);
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: { form: "Enter a Name before creating.", fields: {} },
        });
        return;
      }
      try {
        await onCreate(parsed.data);
      } catch {
        form.setErrorMap({
          onSubmit: {
            form: "Project Release could not be created. Retry; your text is kept here.",
            fields: {},
          },
        });
      }
    },
  });
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }
  return (
    <form className="space-y-4" onSubmit={submit}>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <form.Field name="name">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="project-release-name"
                >
                  Name
                  <Input
                    disabled={isSubmitting}
                    id="project-release-name"
                    maxLength={255}
                    name="name"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
            <form.Field name="versionLabel">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="project-release-version-label"
                >
                  Version label (optional)
                  <Input
                    disabled={isSubmitting}
                    id="project-release-version-label"
                    maxLength={255}
                    name="versionLabel"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
            <form.Field name="description">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="project-release-description"
                >
                  Description (optional)
                  <Textarea
                    disabled={isSubmitting}
                    id="project-release-description"
                    maxLength={20_000}
                    name="description"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
            <p className="text-sm text-muted-foreground">
              Starts as Draft. A Project Release is the publishable scope; it is
              not a Milestone or a Focus Period.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Creating…" : "Create Project Release"}
              </Button>
              <Button
                disabled={isSubmitting}
                onClick={onCancel}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
