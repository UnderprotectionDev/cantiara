// biome-ignore-all lint/performance/noJsxPropsBind: The select binds to its own form state.

import type { ProjectReleaseAudienceTarget } from "@cantiara/api/project-release-planning";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { submitForm } from "@/lib/submit-form";
import { projectReleaseAudienceFormSchema } from "../../lib/project-release-planning-form";

const TYPES = ["Persona", "Contact", "Company"] as const;

/** Optional Persona, Contact or Company link for the hypothesis audience. */
export function ProjectReleaseAudienceForm({
  candidates,
  onAdd,
}: {
  candidates: readonly ProjectReleaseAudienceTarget[];
  onAdd: (target: ProjectReleaseAudienceTarget) => Promise<unknown>;
}) {
  const form = useForm({
    defaultValues: { target: "" },
    onSubmit: async ({ value, formApi }) => {
      form.setErrorMap({ onSubmit: undefined });
      const parsed = projectReleaseAudienceFormSchema.safeParse(value);
      const target = parsed.success
        ? candidates.find(
            (candidate) =>
              `${candidate.type}:${candidate.id}` === parsed.data.target,
          )
        : undefined;
      if (!target) {
        form.setErrorMap({
          onSubmit: {
            form: "Choose a Persona, Contact or Company.",
            fields: {},
          },
        });
        return;
      }
      try {
        await onAdd(target);
        formApi.reset();
      } catch {
        form.setErrorMap({
          onSubmit: {
            form: "Audience link could not be added. Reload and try again.",
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
  if (!candidates.length) {
    return null;
  }
  return (
    <form
      aria-label="Link audience"
      className="flex flex-wrap items-end gap-3"
      onSubmit={submit}
    >
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <form.Field name="target">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="project-release-audience-target"
                >
                  Persona, Contact or Company
                  <NativeSelect
                    disabled={isSubmitting}
                    id="project-release-audience-target"
                    name="target"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  >
                    <NativeSelectOption value="">
                      Choose a record
                    </NativeSelectOption>
                    {TYPES.map((type) => {
                      const options = candidates.filter(
                        (candidate) => candidate.type === type,
                      );
                      return options.length ? (
                        <NativeSelectOptGroup key={type} label={type}>
                          {options.map((candidate) => (
                            <NativeSelectOption
                              key={candidate.id}
                              value={`${candidate.type}:${candidate.id}`}
                            >
                              {candidate.title}
                            </NativeSelectOption>
                          ))}
                        </NativeSelectOptGroup>
                      ) : null;
                    })}
                  </NativeSelect>
                </label>
              )}
            </form.Field>
            <Button disabled={isSubmitting} type="submit" variant="outline">
              Link
            </Button>
          </>
        )}
      </form.Subscribe>
      {error ? (
        <p className="w-full text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
