// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields.
import type { ScreenOption, UserFlowNodeView } from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";

import {
  PROMOTE_CREATE_NEW,
  promoteToScreenFormSchema,
} from "../../lib/user-flow-forms";

export type PromoteChoice =
  | { mode: "create"; title: string }
  | { mode: "link"; screenId: string };

/**
 * `Promote to Screen`: a separate action from `Convert and Bind`. It links an
 * existing Screen (a live reference) or creates one Screen master; it never
 * copies a Screen.
 */
export function PromoteToScreenForm({
  disabled,
  node,
  onPromote,
  screens,
}: {
  disabled: boolean;
  node: UserFlowNodeView;
  onPromote: (nodeId: string, choice: PromoteChoice) => Promise<unknown>;
  screens: ScreenOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { choice: "", title: "" },
    onSubmit: async ({ formApi, value }) => {
      const parsed = promoteToScreenFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      try {
        await onPromote(node.id, parsed.data);
        formApi.reset();
        setError(null);
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "The node could not be promoted.",
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
      <Label htmlFor={`promote-screen-${node.id}`}>Screen</Label>
      <form.Field name="choice">
        {(field) => (
          <NativeSelect
            id={`promote-screen-${node.id}`}
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          >
            <NativeSelectOption value="">Select a Screen</NativeSelectOption>
            {screens.map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {option.title}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value={PROMOTE_CREATE_NEW}>
              Create a new Screen
            </NativeSelectOption>
          </NativeSelect>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.choice}>
        {(choice) =>
          choice === PROMOTE_CREATE_NEW ? (
            <div className="space-y-1">
              <Label htmlFor={`promote-title-${node.id}`}>Screen title</Label>
              <form.Field name="title">
                {(field) => (
                  <Input
                    id={`promote-title-${node.id}`}
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                )}
              </form.Field>
            </div>
          ) : null
        }
      </form.Subscribe>
      {error ? <p role="alert">{error}</p> : null}
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <Button
            disabled={
              disabled || !promoteToScreenFormSchema.safeParse(values).success
            }
            size="sm"
            type="submit"
          >
            Promote to Screen
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
