// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields.
import {
  type ScreenOption,
  USER_FLOW_NODE_KINDS,
  type UserFlowNodeKind,
} from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

import { addNode, type EditorState } from "../../lib/flow-editor";
import { createOutlineNodeFormSchema } from "../../lib/user-flow-forms";

export function CreateNodeForm({
  createId,
  onChange,
  screenOptions,
}: {
  createId: () => string;
  onChange: (change: (state: EditorState) => EditorState) => void;
  screenOptions: ScreenOption[];
}) {
  const form = useForm({
    defaultValues: {
      kind: "Action" as UserFlowNodeKind,
      screenId: "",
      text: "",
    },
    onSubmit: ({ formApi, value }) => {
      const parsed = createOutlineNodeFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      const { kind, screenId, text } = parsed.data;
      onChange((state) =>
        addNode(state, { id: createId(), kind, screenId, text }),
      );
      formApi.setFieldValue("text", "");
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      aria-label="Add a node to the outline"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <div className="space-y-1">
        <Label htmlFor="user-flow-outline-kind">Outline node type</Label>
        <form.Field name="kind">
          {(field) => (
            <NativeSelect
              id="user-flow-outline-kind"
              name={field.name}
              onChange={(event) =>
                field.handleChange(event.target.value as UserFlowNodeKind)
              }
              value={field.state.value}
            >
              {USER_FLOW_NODE_KINDS.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {option}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
      </div>
      <form.Subscribe selector={(state) => state.values.kind}>
        {(kind) =>
          kind === "Screen" ? (
            <div className="space-y-1">
              <Label htmlFor="user-flow-outline-screen">Outline Screen</Label>
              <form.Field name="screenId">
                {(field) => (
                  <NativeSelect
                    id="user-flow-outline-screen"
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  >
                    <NativeSelectOption value="">
                      Select a Screen
                    </NativeSelectOption>
                    {screenOptions.map((option) => (
                      <NativeSelectOption key={option.id} value={option.id}>
                        {option.title}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </form.Field>
            </div>
          ) : null
        }
      </form.Subscribe>
      <div className="space-y-1">
        <Label htmlFor="user-flow-outline-text">Outline node text</Label>
        <form.Field name="text">
          {(field) => (
            <Input
              className="h-8 px-2 text-sm"
              id="user-flow-outline-text"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>
      <Button size="sm" type="submit">
        Add to outline
      </Button>
    </form>
  );
}
