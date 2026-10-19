// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields.
import type {
  ScreenOption,
  UserFlowNodeView,
  UserFlowTemplateView,
} from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { type FormEvent, useState } from "react";

export type PromoteChoice =
  | { mode: "create"; title: string }
  | { mode: "link"; screenId: string };

const CREATE_NEW = "__create__";

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
  const [choice, setChoice] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const creating = choice === CREATE_NEW;
  const ready = creating ? title.trim() !== "" : choice !== "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) {
      return;
    }
    try {
      await onPromote(
        node.id,
        creating
          ? { mode: "create", title: title.trim() }
          : { mode: "link", screenId: choice },
      );
      setChoice("");
      setTitle("");
      setError(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The node could not be promoted.",
      );
    }
  }
  return (
    <form className="space-y-2" onSubmit={submit}>
      <Label htmlFor={`promote-screen-${node.id}`}>Screen</Label>
      <NativeSelect
        id={`promote-screen-${node.id}`}
        onChange={(event) => setChoice(event.target.value)}
        value={choice}
      >
        <NativeSelectOption value="">Select a Screen</NativeSelectOption>
        {screens.map((option) => (
          <NativeSelectOption key={option.id} value={option.id}>
            {option.title}
          </NativeSelectOption>
        ))}
        <NativeSelectOption value={CREATE_NEW}>
          Create a new Screen
        </NativeSelectOption>
      </NativeSelect>
      {creating ? (
        <div className="space-y-1">
          <Label htmlFor={`promote-title-${node.id}`}>Screen title</Label>
          <Input
            id={`promote-title-${node.id}`}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <Button disabled={disabled || !ready} size="sm" type="submit">
        Promote to Screen
      </Button>
    </form>
  );
}

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
  const [name, setName] = useState("");
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const nodeIds = nodes
    .filter(({ id }) => !excluded.has(id))
    .map(({ id }) => id);

  function toggle(id: string) {
    setExcluded((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await onSave(name, nodeIds);
      setName("");
      setError(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The template could not be saved.",
      );
    }
  }
  return (
    <form className="space-y-2" onSubmit={submit}>
      <fieldset className="space-y-1">
        <legend className="text-sm">Nodes in the template</legend>
        {nodes.map((node) => (
          <label className="flex items-center gap-2 text-sm" key={node.id}>
            <input
              checked={!excluded.has(node.id)}
              onChange={() => toggle(node.id)}
              type="checkbox"
            />
            {node.kind}
            {node.text ? ` · ${node.text.split("\n")[0]}` : ""}
          </label>
        ))}
      </fieldset>
      <Label htmlFor="user-flow-template-name">Template name</Label>
      <Input
        id="user-flow-template-name"
        onChange={(event) => setName(event.target.value)}
        value={name}
      />
      {error ? <p role="alert">{error}</p> : null}
      <Button
        disabled={disabled || name.trim() === "" || nodeIds.length === 0}
        type="submit"
      >
        Save as template
      </Button>
    </form>
  );
}

/** `Create from template`: a new, independent User Flow with no live bind to the source. */
export function CreateFromTemplateForm({
  onCreate,
  readOnly,
  templates,
}: {
  onCreate: (templateId: string, title: string) => Promise<unknown>;
  readOnly: boolean;
  templates: UserFlowTemplateView[];
}) {
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (templates.length === 0) {
    return null;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await onCreate(templateId, title);
      setTemplateId("");
      setTitle("");
      setError(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The User Flow could not be created.",
      );
    }
  }
  return (
    <form className="space-y-2" onSubmit={submit}>
      <Label htmlFor="user-flow-from-template">Template</Label>
      <NativeSelect
        id="user-flow-from-template"
        onChange={(event) => setTemplateId(event.target.value)}
        value={templateId}
      >
        <NativeSelectOption value="">Select a template</NativeSelectOption>
        {templates.map((template) => (
          <NativeSelectOption key={template.id} value={template.id}>
            {template.name} ({template.structure.nodes.length} nodes)
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Label htmlFor="user-flow-from-template-title">Title</Label>
      <Input
        id="user-flow-from-template-title"
        onChange={(event) => setTitle(event.target.value)}
        value={title}
      />
      {error ? <p role="alert">{error}</p> : null}
      <Button
        disabled={readOnly || templateId === "" || title.trim() === ""}
        type="submit"
      >
        Create from template
      </Button>
    </form>
  );
}
