// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";
import { createGroupFormSchema } from "../../lib/project-wall-narrative-forms";

export default function CreateGroupForm({
  onCreateGroup,
}: {
  onCreateGroup: (title: string) => Promise<boolean>;
}) {
  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ formApi, value }) => {
      const parsed = createGroupFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      if (await onCreateGroup(parsed.data.title)) {
        // Only a persisted group clears the draft; a failed write keeps it.
        formApi.reset();
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label="Create Group"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <form.Field name="title">
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor="project-wall-group-title">Group name</Label>
            <Input
              id="project-wall-group-title"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      <Button type="submit" variant="outline">
        Create Group
      </Button>
    </form>
  );
}
