// biome-ignore-all lint/performance/noJsxPropsBind: The form binds its own field state.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { linkedSourceLabelFormSchema } from "../../lib/screen-forms";

/** `Source label` of a linked block; submitting previews the change to every Screen that uses it. */
export function LinkedSourceLabelForm({
  initialLabel,
  onEdit,
  onPreview,
}: {
  initialLabel: string;
  /** Any edit makes a shown preview stale. */
  onEdit: () => void;
  onPreview: (label: string) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: { label: initialLabel },
    listeners: { onChange: onEdit },
    onSubmit: async ({ value }) => {
      const parsed = linkedSourceLabelFormSchema.safeParse(value);
      if (parsed.success) {
        await onPreview(parsed.data.label);
      }
    },
  });
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <label className="text-xs" htmlFor="linked-source-label">
        Source label
      </label>
      <form.Field name="label">
        {(field) => (
          <Input
            className="w-48"
            id="linked-source-label"
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      <Button size="sm" type="submit" variant="outline">
        Preview Change
      </Button>
    </form>
  );
}
