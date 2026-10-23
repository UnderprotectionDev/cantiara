// biome-ignore-all lint/performance/noJsxPropsBind: The select binds to its own form state.

import type { ProjectReleaseWork } from "@cantiara/api/project-release-planning";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { z } from "zod";

const scopeFormSchema = z.object({ workId: z.string().trim().min(1) });

/** `Add Work to scope`: one explicit Work of this Project at a time. */
export function ProjectReleaseScopeForm({
  candidates,
  onAdd,
}: {
  candidates: readonly ProjectReleaseWork[];
  onAdd: (workId: string) => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { workId: "" },
    onSubmit: async ({ value, formApi }) => {
      setError(null);
      const parsed = scopeFormSchema.safeParse(value);
      if (!parsed.success) {
        setError("Choose a Work to add.");
        return;
      }
      try {
        await onAdd(parsed.data.workId);
        formApi.reset();
      } catch {
        setError("Work could not be added. Reload and try again.");
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  if (!candidates.length) {
    return (
      <p className="text-muted-foreground text-sm">
        Every available Work of this Project is already in scope.
      </p>
    );
  }
  return (
    <form
      aria-label="Add Work to scope"
      className="flex flex-wrap items-end gap-3"
      onSubmit={submit}
    >
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <form.Field name="workId">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="project-release-scope-work"
                >
                  Work
                  <NativeSelect
                    disabled={isSubmitting}
                    id="project-release-scope-work"
                    name="workId"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  >
                    <NativeSelectOption value="">
                      Choose Work
                    </NativeSelectOption>
                    {candidates.map((work) => (
                      <NativeSelectOption key={work.id} value={work.id}>
                        {work.key} · {work.title}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              )}
            </form.Field>
            <Button disabled={isSubmitting} type="submit" variant="outline">
              Add Work to scope
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
