// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields and the displayed wall.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

import { createProjectWallFormSchema } from "../../lib/project-wall-forms";

export function CreateWallForm({
  onCreate,
}: {
  onCreate: (title: string) => Promise<boolean>;
}) {
  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ formApi, value }) => {
      const parsed = createProjectWallFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      if (await onCreate(parsed.data.title)) {
        // Only a persisted wall clears the draft; a failed write keeps it.
        formApi.reset();
      }
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label="Create Project Wall"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <div className="space-y-1">
        <Label htmlFor="project-wall-title">Project Wall name</Label>
        <form.Field name="title">
          {(field) => (
            <Input
              id="project-wall-title"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>
      <Button type="submit">Create Project Wall</Button>
    </form>
  );
}
