// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

import { recordTablePasteTextFormSchema } from "../../lib/record-table-paste-form";

/** The `Paste rows` form: the pasted text that `Preview paste` turns into reviewable rows. */
export default function RecordTablePasteForm({
  onReview,
}: {
  onReview: (text: string) => void;
}) {
  const form = useForm({
    defaultValues: { pasteText: "" },
    onSubmit: ({ value }) => {
      const parsed = recordTablePasteTextFormSchema.safeParse(value);
      if (parsed.success) {
        onReview(parsed.data.pasteText);
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form className="space-y-3" onSubmit={submit}>
      <form.Field name="pasteText">
        {(field) => (
          <label className="block space-y-1" htmlFor="record-table-paste">
            <span>Paste rows</span>
            <Textarea
              aria-label="Paste rows"
              className="min-h-28 font-mono text-sm"
              id="record-table-paste"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Title&#9;Decision&#10;Launch timing&#9;Ship in June"
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      <button className="rounded border px-3 py-2" type="submit">
        Preview paste
      </button>
    </form>
  );
}
