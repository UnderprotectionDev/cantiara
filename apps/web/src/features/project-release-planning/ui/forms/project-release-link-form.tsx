// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import {
  PROJECT_RELEASE_LINK_KINDS,
  type ProjectReleaseLinkKind,
  type ProjectReleaseRepository,
} from "@cantiara/api/project-release-planning";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { submitForm } from "@/lib/submit-form";
import {
  EMPTY_PROJECT_RELEASE_LINK_DRAFT,
  projectReleaseLinkFormSchema,
} from "../../lib/project-release-planning-form";

const LINK_ERRORS = {
  label: "Enter a label.",
  repositoryLinkId: "Choose one of this Project's repositories.",
  url: "Enter a valid http(s) URL; an Environment link needs one.",
} as const;

export interface ProjectReleaseLinkValues {
  kind: ProjectReleaseLinkKind;
  label: string;
  repositoryLinkId: string | null;
  url: string | null;
}

/**
 * Adds a `Tag`, `Release` or `Environment link` reference from this Project's
 * repositories. A reference is context only; it never changes the status.
 */
export function ProjectReleaseLinkForm({
  onAdd,
  repositories,
}: {
  onAdd: (values: ProjectReleaseLinkValues) => Promise<unknown>;
  repositories: readonly ProjectReleaseRepository[];
}) {
  const form = useForm({
    defaultValues: EMPTY_PROJECT_RELEASE_LINK_DRAFT,
    onSubmit: async ({ value, formApi }) => {
      form.setErrorMap({ onSubmit: undefined });
      const parsed = projectReleaseLinkFormSchema.safeParse(value);
      if (!parsed.success) {
        const field = parsed.error.issues[0]?.path[0];
        form.setErrorMap({
          onSubmit: {
            form:
              LINK_ERRORS[field as keyof typeof LINK_ERRORS] ??
              LINK_ERRORS.label,
            fields: {},
          },
        });
        return;
      }
      try {
        await onAdd(parsed.data);
        formApi.reset();
      } catch {
        form.setErrorMap({
          onSubmit: {
            form: "Reference could not be added. Reload and try again.",
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
    <form
      aria-label="Add reference"
      className="grid gap-3 rounded-lg border border-border/70 p-4"
      onSubmit={submit}
    >
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <form.Field name="kind">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="project-release-link-kind"
                >
                  Reference
                  <NativeSelect
                    disabled={isSubmitting}
                    id="project-release-link-kind"
                    name="kind"
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(
                        event.target.value as ProjectReleaseLinkKind,
                      )
                    }
                    value={field.state.value}
                  >
                    {PROJECT_RELEASE_LINK_KINDS.map((kind) => (
                      <NativeSelectOption key={kind} value={kind}>
                        {kind}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              )}
            </form.Field>
            <form.Field name="repositoryLinkId">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="project-release-link-repository"
                >
                  Repository
                  <NativeSelect
                    disabled={isSubmitting}
                    id="project-release-link-repository"
                    name="repositoryLinkId"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  >
                    <NativeSelectOption value="">
                      No repository
                    </NativeSelectOption>
                    {repositories.map((repository) => (
                      <NativeSelectOption
                        key={repository.id}
                        value={repository.id}
                      >
                        {repository.owner}/{repository.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              )}
            </form.Field>
            <form.Field name="label">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="project-release-link-label"
                >
                  Label
                  <Input
                    disabled={isSubmitting}
                    id="project-release-link-label"
                    maxLength={255}
                    name="label"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="v1.1.0"
                    required
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
            <form.Field name="url">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="project-release-link-url"
                >
                  URL
                  <Input
                    disabled={isSubmitting}
                    id="project-release-link-url"
                    maxLength={2048}
                    name="url"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    type="url"
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
            <div>
              <Button disabled={isSubmitting} type="submit" variant="outline">
                Add reference
              </Button>
            </div>
          </>
        )}
      </form.Subscribe>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
