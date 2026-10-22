// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  type ScreenOption,
  USER_FLOW_NODE_KINDS,
  type UserFlowNodeKind,
} from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";
import type { PlaceNodeDraft } from "../../lib/place-node-draft";
import { createOutlineNodeFormSchema } from "../../lib/user-flow-forms";

export function PlaceNodeForm({
  disabled,
  onPlaceNode,
  screens,
}: {
  disabled: boolean;
  onPlaceNode: (draft: PlaceNodeDraft) => Promise<unknown>;
  screens: ScreenOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      kind: "Action" as UserFlowNodeKind,
      screenId: "",
      text: "",
    },
    onSubmit: async ({ formApi, value }) => {
      const parsed = createOutlineNodeFormSchema.safeParse(value);
      if (!parsed.success) {
        setError("Choose a Screen for a Screen node.");
        return;
      }
      try {
        await onPlaceNode({
          kind: parsed.data.kind,
          screenId: parsed.data.kind === "Screen" ? parsed.data.screenId : null,
          text: parsed.data.text,
        });
        formApi.setFieldValue("text", "");
        setError(null);
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Node could not be placed.",
        );
      }
    },
  });
  const needsScreen =
    useStore(form.store, (state) => state.values.kind) === "Screen";

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="user-flow-node-kind">Node type</Label>
        <form.Field name="kind">
          {(field) => (
            <NativeSelect
              id="user-flow-node-kind"
              name={field.name}
              onChange={(event) => {
                const next = USER_FLOW_NODE_KINDS.find(
                  (option) => option === event.target.value,
                );
                if (next) {
                  field.handleChange(next);
                }
              }}
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
      {needsScreen ? (
        <div className="space-y-1">
          <Label htmlFor="user-flow-node-screen">Screen</Label>
          <form.Field name="screenId">
            {(field) => (
              <NativeSelect
                id="user-flow-node-screen"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              >
                <NativeSelectOption value="">
                  Select a Screen
                </NativeSelectOption>
                {screens.map((screen) => (
                  <NativeSelectOption key={screen.id} value={screen.id}>
                    {screen.title}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </form.Field>
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="user-flow-node-text">Node text</Label>
        <form.Field name="text">
          {(field) => (
            <Textarea
              id="user-flow-node-text"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <Button disabled={disabled} type="submit">
        Place node
      </Button>
    </form>
  );
}
