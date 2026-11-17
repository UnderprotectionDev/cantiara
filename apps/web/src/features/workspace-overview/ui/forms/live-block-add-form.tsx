// biome-ignore-all lint/performance/noJsxPropsBind: The field binds to its own form state.
import { Button } from "@cantiara/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cantiara/ui/components/select";
import { useForm } from "@tanstack/react-form";
import { Plus } from "lucide-react";
import type { FormEvent } from "react";
import {
  liveBlockFormSchema,
  MAX_LIVE_BLOCKS,
} from "../../lib/live-block-form";

export interface LiveBlockChoice {
  key: string;
  title: string;
  type: string;
}

/** Pins one existing Document or named Smart Collection view as a live block. */
export function LiveBlockAddForm({
  addable,
  onAdd,
  selectedCount,
}: {
  addable: readonly LiveBlockChoice[];
  onAdd: (key: string) => void;
  selectedCount: number;
}) {
  const form = useForm({
    defaultValues: { choice: "" },
    onSubmit: ({ value }) => {
      const parsed = liveBlockFormSchema(
        new Set(addable.map((block) => block.key)),
        selectedCount,
      ).safeParse(value);
      if (!parsed.success) {
        return;
      }
      onAdd(parsed.data.choice);
      form.reset();
    },
  });
  const full = selectedCount >= MAX_LIVE_BLOCKS;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
      <form.Field name="choice">
        {(field) => (
          <div className="grid gap-1 text-muted-foreground text-xs">
            <span id="workspace-overview-live-block-source-label">
              Existing source
            </span>
            <Select
              disabled={addable.length === 0 || full}
              onValueChange={(value) => field.handleChange(value ?? "")}
              value={field.state.value === "" ? null : field.state.value}
            >
              <SelectTrigger
                aria-labelledby="workspace-overview-live-block-source-label"
                className="w-full min-w-52"
                size="sm"
              >
                <SelectValue
                  placeholder={
                    addable.length === 0
                      ? "No existing source records"
                      : "Choose a source"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {addable.map((block) => (
                  <SelectItem key={block.key} value={block.key}>
                    {block.title} · {block.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.choice}>
        {(choice) => (
          <Button
            disabled={!choice || full}
            size="sm"
            type="submit"
            variant="outline"
          >
            <Plus aria-hidden="true" />
            Add live block
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
