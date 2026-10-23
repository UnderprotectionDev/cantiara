// biome-ignore-all lint/performance/noJsxPropsBind: The select binds to its own form state.

import type { ProjectReleaseAudienceTarget } from "@cantiara/api/project-release-planning";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { z } from "zod";

const audienceFormSchema = z.object({ target: z.string().trim().min(1) });
const TYPES = ["Persona", "Contact", "Company"] as const;

/** Optional Persona, Contact or Company link for the hypothesis audience. */
export function ProjectReleaseAudienceForm({
  candidates,
  onAdd,
}: {
  candidates: readonly ProjectReleaseAudienceTarget[];
  onAdd: (target: ProjectReleaseAudienceTarget) => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { target: "" },
    onSubmit: async ({ value, formApi }) => {
      setError(null);
      const parsed = audienceFormSchema.safeParse(value);
      const target = parsed.success
        ? candidates.find(
            (candidate) =>
              `${candidate.type}:${candidate.id}` === parsed.data.target,
          )
        : undefined;
      if (!target) {
        setError("Choose a Persona, Contact or Company.");
        return;
      }
      try {
        await onAdd(target);
        formApi.reset();
      } catch {
        setError("Audience link could not be added. Reload and try again.");
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
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
        <p className="w-full text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
