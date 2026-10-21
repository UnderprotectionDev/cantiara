// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the chosen version and form fields.
import type { ScreenRecord } from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { type FormEvent, useState } from "react";

export interface ScreenTemplateSummary {
  createdAt: string;
  id: string;
  name: string;
}

export interface ScreenTemplateActions {
  /** Creates a Screen in the current Project from a Workspace template. */
  create: (templateId: string, title: string) => Promise<unknown>;
  /** Stamps the chosen saved version into a Workspace template. */
  save: (
    screen: ScreenRecord,
    wireframeVersion: number,
    name: string,
  ) => Promise<unknown>;
  templates: ScreenTemplateSummary[];
}

/** `Save as Template` for the Screen's chosen saved version; the Screen is untouched. */
export function SaveAsTemplate({
  actions,
  screen,
}: {
  actions: Pick<ScreenTemplateActions, "save">;
  screen: ScreenRecord;
}) {
  const versions = screen.wireframeVersions;
  const [version, setVersion] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const chosen: number | undefined = version ?? versions.at(-1)?.version;
  if (versions.length === 0 || chosen === undefined) {
    return null;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setMessage(undefined);
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }
    try {
      await actions.save(screen, chosen as number, name.trim());
      setMessage(`Saved template ${name.trim()} from v${chosen}.`);
      setName("");
    } catch {
      setError("Template could not be saved.");
    }
  }
  return (
    <form
      aria-label="Save as Template"
      className="flex flex-wrap items-center gap-2 text-sm"
      onSubmit={submit}
    >
      <label htmlFor={`template-version-${screen.id}`}>Saved version</label>
      <NativeSelect
        id={`template-version-${screen.id}`}
        onChange={(event) => setVersion(Number(event.target.value))}
        value={chosen}
      >
        {versions.map((item) => (
          <NativeSelectOption key={item.version} value={item.version}>
            {`v${item.version}`}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <label htmlFor={`template-name-${screen.id}`}>Template name</label>
      <Input
        className="w-48"
        id={`template-name-${screen.id}`}
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
        value={name}
      />
      <Button size="sm" type="submit" variant="outline">
        Save as Template
      </Button>
      {message ? <span role="status">{message}</span> : null}
      {error ? (
        <span className="text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}

/** `Create Screen from Template` into the current Project. */
export function CreateScreenFromTemplate({
  actions,
}: {
  actions: Pick<ScreenTemplateActions, "create" | "templates">;
}) {
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string>();
  const chosen = templateId || actions.templates[0]?.id;
  if (!chosen) {
    return null;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    try {
      await actions.create(chosen as string, title.trim());
      setTitle("");
    } catch {
      setError("Screen could not be created from the template.");
    }
  }
  return (
    <form
      aria-label="Create Screen from Template"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 p-5 text-sm"
      onSubmit={submit}
    >
      <label htmlFor="screen-template">Template</label>
      <NativeSelect
        id="screen-template"
        onChange={(event) => setTemplateId(event.target.value)}
        value={chosen}
      >
        {actions.templates.map((item) => (
          <NativeSelectOption key={item.id} value={item.id}>
            {item.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <label htmlFor="screen-from-template-title">Title</label>
      <Input
        className="w-56"
        id="screen-from-template-title"
        maxLength={255}
        onChange={(event) => setTitle(event.target.value)}
        value={title}
      />
      <Button type="submit">Create Screen from Template</Button>
      {error ? (
        <span className="text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}
