// biome-ignore-all lint/performance/noJsxPropsBind: The form binds its own field state.
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { bindNodeFormSchema } from "../../lib/user-flow-forms";

/** `Bind` row of the outline: choose the node a node binds to, then bind. */
export function BindNodeForm({
  candidates,
  nodeLabel,
  onBind,
}: {
  candidates: readonly { id: string; label: string }[];
  nodeLabel: string;
  onBind: (target: string) => void;
}) {
  const form = useForm({
    defaultValues: { target: "" },
    onSubmit: ({ formApi, value }) => {
      const parsed = bindNodeFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      onBind(parsed.data.target);
      formApi.reset();
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
      <form.Field name="target">
        {(field) => (
          <NativeSelect
            aria-label={`Bind ${nodeLabel} to`}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          >
            <NativeSelectOption value="">Bind to…</NativeSelectOption>
            {candidates.map((candidate) => (
              <NativeSelectOption key={candidate.id} value={candidate.id}>
                {candidate.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.target}>
        {(target) => (
          <Button
            aria-label={`Bind ${nodeLabel}`}
            disabled={target === ""}
            size="sm"
            type="submit"
            variant="outline"
          >
            Bind
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
