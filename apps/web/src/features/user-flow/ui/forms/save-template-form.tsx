// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields.
import type { UserFlowNodeView } from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";

import { saveUserFlowTemplateFormSchema } from "../../lib/user-flow-forms";

/** `Save as template`: the selected structure and placeholders only. */
export function SaveTemplateForm({
  disabled,
  nodes,
  onSave,
}: {
  disabled: boolean;
  nodes: UserFlowNodeView[];
  onSave: (name: string, nodeIds: string[]) => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { excluded: [] as string[], name: "" },
    onSubmit: async ({ formApi, value }) => {
      const nodeIds = nodes
        .filter(({ id }) => !value.excluded.includes(id))
        .map(({ id }) => id);
      const parsed = saveUserFlowTemplateFormSchema.safeParse({
        name: value.name,
        nodeIds,
      });
      if (!parsed.success) {
        return;
      }
      try {
        await onSave(parsed.data.name, parsed.data.nodeIds);
        formApi.setFieldValue("name", "");
        setError(null);
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "The template could not be saved.",
        );
      }
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form className="space-y-2" onSubmit={submit}>
      <form.Field name="excluded">
        {(field) => (
          <fieldset className="space-y-1">
            <legend className="text-sm">Nodes in the template</legend>
            {nodes.map((node) => (
              <label
                className="flex items-center gap-2 text-sm"
                htmlFor={`user-flow-template-node-${node.id}`}
                key={node.id}
              >
                <Checkbox
                  checked={!field.state.value.includes(node.id)}
                  id={`user-flow-template-node-${node.id}`}
                  onCheckedChange={() =>
                    field.handleChange(
                      field.state.value.includes(node.id)
                        ? field.state.value.filter((id) => id !== node.id)
                        : [...field.state.value, node.id],
                    )
                  }
                />
                {node.kind}
                {node.text ? ` · ${node.text.split("\n")[0]}` : ""}
              </label>
            ))}
          </fieldset>
        )}
      </form.Field>
      <Label htmlFor="user-flow-template-name">Template name</Label>
      <form.Field name="name">
        {(field) => (
          <Input
            id="user-flow-template-name"
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      {error ? <p role="alert">{error}</p> : null}
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <Button
            disabled={
              disabled ||
              values.name.trim() === "" ||
              nodes.every(({ id }) => values.excluded.includes(id))
            }
            type="submit"
          >
            Save as template
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
