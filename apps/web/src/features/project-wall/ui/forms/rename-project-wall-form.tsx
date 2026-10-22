// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields and the displayed wall.
import type { ProjectWallView } from "@cantiara/api/project-wall";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

import { renameProjectWallFormSchema } from "../../lib/project-wall-forms";

export function RenameWallForm({
  onRename,
  wall,
}: {
  onRename: (wallId: string, title: string) => Promise<boolean>;
  wall: ProjectWallView;
}) {
  const form = useForm({
    defaultValues: { title: wall.title },
    onSubmit: async ({ value }) => {
      const parsed = renameProjectWallFormSchema.safeParse(value);
      if (parsed.success && parsed.data.title !== wall.title) {
        // A rename remounts this form with the saved title once it persists.
        await onRename(wall.id, parsed.data.title);
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
      aria-label="Rename Project Wall"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <div className="space-y-1">
        <Label htmlFor="project-wall-rename">Rename</Label>
        <form.Field name="title">
          {(field) => (
            <Input
              id="project-wall-rename"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>
      <Button type="submit" variant="outline">
        Rename
      </Button>
    </form>
  );
}
